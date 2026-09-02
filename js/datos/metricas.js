/* ==========================================================
   metricas.js - Calculo de indicadores para los informes
   Sin dependencias de interfaz: recibe tareas, devuelve numeros.
   ========================================================== */

import { estadoPorId, clavesActivas, hoyISO, diasHasta } from '../util.js';
import { ESTADO, ESTADOS, PRIORIDADES } from '../constantes.js';

const DIA_MS = 86400000;

/* ==========================================================
   Filtros de periodo
   ========================================================== */

/**
 * Recorta por fecha de creacion.
 * @param {number|null} desdeMs  inicio del periodo, null para todo
 */
export function filtrarPorPeriodo(tareas, desdeMs) {
  if (!desdeMs) return tareas;
  return tareas.filter(t => (t.creadaEn || 0) >= desdeMs);
}

/** Marca de tiempo de hace n dias, a las 00:00. */
export function haceDias(dias) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime() - dias * DIA_MS;
}

/* ==========================================================
   Cumplimiento de plazos
   ========================================================== */

/**
 * Compara la fecha de cierre contra el vencimiento.
 * Distinto del avance general: no mide cuantas se cerraron,
 * mide cuantas se cerraron cuando correspondia.
 */
export function cumplimiento(tareas) {
  const finalizadas = tareas.filter(t => t.estado === ESTADO.FINALIZADA);
  const conPlazo = finalizadas.filter(t => t.vencimiento && t.cerradaEn);

  let aTiempo = 0;
  let tarde = 0;
  const tardias = [];

  for (const tarea of conPlazo) {
    /* El vencimiento vence al final del dia */
    const limite = new Date(`${tarea.vencimiento}T23:59:59`).getTime();
    if (tarea.cerradaEn <= limite) {
      aTiempo++;
    } else {
      tarde++;
      tardias.push({
        tarea,
        diasTarde: Math.max(1, Math.ceil((tarea.cerradaEn - limite) / DIA_MS))
      });
    }
  }

  /* Abiertas que ya pasaron el vencimiento: incumplimiento en curso */
  const vencidasAbiertas = tareas.filter(t => {
    if (!estadoPorId(t.estado).abierto || !t.vencimiento) return false;
    return diasHasta(t.vencimiento) < 0;
  });

  return {
    finalizadas: finalizadas.length,
    sinPlazo: finalizadas.length - conPlazo.length,
    medibles: conPlazo.length,
    aTiempo,
    tarde,
    pct: conPlazo.length ? Math.round((aTiempo / conPlazo.length) * 100) : null,
    vencidasAbiertas,
    tardias: tardias.sort((a, b) => b.diasTarde - a.diasTarde)
  };
}

/* ==========================================================
   Tiempos de resolucion
   ========================================================== */

/** Dias entre creacion y cierre. */
export function diasResolucion(tarea) {
  if (!tarea.creadaEn || !tarea.cerradaEn) return null;
  const dias = (tarea.cerradaEn - tarea.creadaEn) / DIA_MS;
  return dias < 0 ? null : Math.round(dias * 10) / 10;
}

export function mediana(numeros) {
  if (!numeros.length) return null;
  const orden = [...numeros].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  const valor = orden.length % 2
    ? orden[medio]
    : (orden[medio - 1] + orden[medio]) / 2;
  return Math.round(valor * 10) / 10;
}

export function promedio(numeros) {
  if (!numeros.length) return null;
  const suma = numeros.reduce((a, b) => a + b, 0);
  return Math.round((suma / numeros.length) * 10) / 10;
}

/**
 * Tiempos de resolucion del conjunto y por grupo.
 * Se informa mediana ademas de promedio: una sola tarea de un ano
 * distorsiona el promedio y da una lectura falsa.
 */
export function tiemposResolucion(tareas, agrupar) {
  const cerradas = tareas.filter(t => t.estado === ESTADO.FINALIZADA && diasResolucion(t) !== null);
  const dias = cerradas.map(diasResolucion);

  const grupos = new Map();
  if (agrupar) {
    for (const tarea of cerradas) {
      for (const clave of [].concat(agrupar(tarea))) {
        if (clave === null || clave === undefined) continue;
        if (!grupos.has(clave)) grupos.set(clave, []);
        grupos.get(clave).push(diasResolucion(tarea));
      }
    }
  }

  return {
    cantidad: cerradas.length,
    promedio: promedio(dias),
    mediana: mediana(dias),
    minimo: dias.length ? Math.min(...dias) : null,
    maximo: dias.length ? Math.max(...dias) : null,
    porGrupo: [...grupos.entries()].map(([clave, valores]) => ({
      clave,
      cantidad: valores.length,
      promedio: promedio(valores),
      mediana: mediana(valores)
    }))
  };
}

/* ==========================================================
   Antiguedad del backlog
   ========================================================== */

export const TRAMOS_ANTIGUEDAD = [
  { id: 'reciente', etiqueta: 'Hasta 7 dias', hasta: 7, color: '#1F9254' },
  { id: 'media', etiqueta: '8 a 30 dias', hasta: 30, color: '#0E7490' },
  { id: 'vieja', etiqueta: '31 a 90 dias', hasta: 90, color: '#B87503' },
  { id: 'muyVieja', etiqueta: 'Mas de 90 dias', hasta: Infinity, color: '#B23A28' }
];

/** Dias que lleva abierta una tarea. */
export function diasAbierta(tarea) {
  if (!tarea.creadaEn) return 0;
  return Math.floor((Date.now() - tarea.creadaEn) / DIA_MS);
}

export function antiguedadBacklog(tareas) {
  const abiertas = tareas.filter(t => estadoPorId(t.estado).abierto);

  const tramos = TRAMOS_ANTIGUEDAD.map(t => ({ ...t, tareas: [] }));
  for (const tarea of abiertas) {
    const dias = diasAbierta(tarea);
    const tramo = tramos.find(t => dias <= t.hasta);
    tramo.tareas.push(tarea);
  }

  const masViejas = [...abiertas]
    .sort((a, b) => (a.creadaEn || 0) - (b.creadaEn || 0))
    .slice(0, 8);

  return {
    total: abiertas.length,
    tramos: tramos.map(t => ({ ...t, cantidad: t.tareas.length })),
    masViejas,
    promedioDias: promedio(abiertas.map(diasAbierta))
  };
}

/* ==========================================================
   Evolucion mensual
   ========================================================== */

function claveMes(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const NOMBRES_MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function etiquetaMes(clave) {
  const [anio, mes] = clave.split('-');
  return `${NOMBRES_MES[Number(mes) - 1]} ${anio.slice(2)}`;
}

/**
 * Creadas y cerradas por mes, con el pendiente acumulado.
 * El acumulado arranca del saldo previo al primer mes mostrado,
 * si no la curva empezaria en cero y mentiria.
 */
export function evolucionMensual(tareas, mesesMaximos = 12) {
  if (!tareas.length) return { meses: [], maximo: 0 };

  const conFecha = tareas.filter(t => t.creadaEn);
  if (!conFecha.length) return { meses: [], maximo: 0 };

  const primera = Math.min(...conFecha.map(t => t.creadaEn));
  const cursor = new Date(primera);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);

  const claves = [];
  const fin = new Date();
  while (cursor <= fin) {
    claves.push(claveMes(cursor.getTime()));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const recortadas = claves.slice(-mesesMaximos);
  const primeraMostrada = recortadas[0];

  /* Saldo de tareas abiertas antes del primer mes mostrado */
  let acumulado = 0;
  for (const tarea of conFecha) {
    if (claveMes(tarea.creadaEn) >= primeraMostrada) continue;
    acumulado++;
    if (tarea.cerradaEn && claveMes(tarea.cerradaEn) < primeraMostrada) acumulado--;
  }

  const meses = [];
  for (const clave of recortadas) {
    const creadas = conFecha.filter(t => claveMes(t.creadaEn) === clave).length;
    const cerradas = conFecha.filter(t => t.cerradaEn && claveMes(t.cerradaEn) === clave).length;
    acumulado += creadas - cerradas;
    meses.push({
      clave,
      etiqueta: etiquetaMes(clave),
      creadas,
      cerradas,
      acumulado: Math.max(0, acumulado)
    });
  }

  const maximo = Math.max(1, ...meses.map(m => Math.max(m.creadas, m.cerradas, m.acumulado)));
  return { meses, maximo };
}

/* ==========================================================
   Distribucion de carga
   ========================================================== */

/**
 * Cuenta tareas por clave. La funcion puede devolver una clave o
 * un array, para dimensiones con varios valores por tarea
 * (asignados, externos).
 */
export function distribucion(tareas, obtenerClaves) {
  const conteo = new Map();
  let sinDato = 0;

  for (const tarea of tareas) {
    const claves = [].concat(obtenerClaves(tarea)).filter(c => c !== null && c !== undefined && c !== '');
    if (!claves.length) { sinDato++; continue; }
    for (const clave of claves) {
      if (!conteo.has(clave)) conteo.set(clave, { total: 0, abiertas: 0, cerradas: 0 });
      const registro = conteo.get(clave);
      registro.total++;
      if (estadoPorId(tarea.estado).abierto) registro.abiertas++;
      else registro.cerradas++;
    }
  }

  const items = [...conteo.entries()]
    .map(([clave, valores]) => ({ clave, ...valores }))
    .sort((a, b) => b.total - a.total);

  return { items, sinDato, maximo: Math.max(1, ...items.map(i => i.total)) };
}

/** Dimensiones disponibles para la distribucion. */
export const DIMENSIONES = [
  { id: 'base', nombre: 'Base' },
  { id: 'categoria', nombre: 'Categoria' },
  { id: 'prioridad', nombre: 'Prioridad' },
  { id: 'estado', nombre: 'Estado' },
  { id: 'interno', nombre: 'Interno' },
  { id: 'externo', nombre: 'Externo' },
  { id: 'solicitante', nombre: 'Solicitante' }
];

/** Devuelve la funcion de agrupamiento de cada dimension. */
export function clavesDe(dimension) {
  switch (dimension) {
    case 'base': return t => t.baseId;
    case 'categoria': return t => t.categoriaId;
    case 'prioridad': return t => t.prioridad;
    case 'estado': return t => t.estado;
    case 'interno': return t => clavesActivas(t.asignados);
    case 'externo': return t => clavesActivas(t.externos);
    case 'solicitante': return t => (t.solicitante || '').trim();
    default: return () => null;
  }
}

/* ==========================================================
   Trazabilidad
   ========================================================== */

/**
 * Huecos de documentacion. Para una auditoria, una tarea que
 * cambio de estado sin que nadie explique por que es un hallazgo.
 *
 * @param {object} conteoAvances { tareaId: cantidad }
 */
export function trazabilidad(tareas, conteoAvances = {}) {
  const abiertas = tareas.filter(t => estadoPorId(t.estado).abierto);

  /* La importacion y el alta dejan un avance automatico, asi que
     "un solo avance" equivale a que nadie documento nada despues. */
  const sinAvances = tareas.filter(t => (conteoAvances[t.id] || 0) === 0);
  const soloElInicial = tareas.filter(t => (conteoAvances[t.id] || 0) === 1);

  const limite = haceDias(30);
  const quietas = abiertas.filter(t => (t.ultimaActividad || t.creadaEn || 0) < limite);

  const cerradasSinComentario = tareas.filter(
    t => !estadoPorId(t.estado).abierto && (conteoAvances[t.id] || 0) <= 1
  );

  const conAvances = tareas.filter(t => (conteoAvances[t.id] || 0) > 1).length;

  return {
    total: tareas.length,
    sinAvances,
    soloElInicial,
    quietas: quietas.sort((a, b) =>
      (a.ultimaActividad || a.creadaEn || 0) - (b.ultimaActividad || b.creadaEn || 0)),
    cerradasSinComentario,
    pctDocumentadas: tareas.length ? Math.round((conAvances / tareas.length) * 100) : null
  };
}

/* ==========================================================
   Resumen general
   ========================================================== */

export function resumen(tareas) {
  const abiertas = tareas.filter(t => estadoPorId(t.estado).abierto);
  const finalizadas = tareas.filter(t => t.estado === ESTADO.FINALIZADA);
  const canceladas = tareas.filter(t => t.estado === ESTADO.CANCELADA);
  const universo = tareas.length - canceladas.length;

  return {
    total: tareas.length,
    abiertas: abiertas.length,
    finalizadas: finalizadas.length,
    canceladas: canceladas.length,
    universo,
    pctAvance: universo ? Math.round((finalizadas.length / universo) * 100) : 0,
    porEstado: ESTADOS.map(e => ({
      ...e,
      cantidad: tareas.filter(t => t.estado === e.id).length
    })),
    porPrioridad: PRIORIDADES.map(p => ({
      ...p,
      cantidad: tareas.filter(t => t.prioridad === p.id).length,
      abiertas: abiertas.filter(t => t.prioridad === p.id).length
    }))
  };
}

export { hoyISO };
