/* ==========================================================
   importador.js - Lectura e interpretacion de planillas
   Sin dependencias de interfaz: recibe datos, devuelve datos.
   ========================================================== */

import { normalizar } from '../util.js';
import {
  ENCABEZADOS_CONOCIDOS, SINONIMOS_ESTADO, SINONIMOS_PRIORIDAD,
  ESTADO, PRIORIDAD_POR_DEFECTO
} from '../constantes.js';

/* URL del lector de xlsx. Si la red lo bloquea, queda solo CSV. */
const URL_SHEETJS = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';

/* ==========================================================
   Lectura del archivo
   ========================================================== */

/**
 * Lee un archivo y devuelve { encabezados, filas }.
 * filas es un array de arrays, en el mismo orden que los encabezados.
 */
export async function leerPlanilla(archivo) {
  const nombre = (archivo.name || '').toLowerCase();

  if (nombre.endsWith('.csv') || nombre.endsWith('.txt')) {
    const texto = await archivo.text();
    return parsearCSV(texto);
  }

  let XLSX;
  try {
    XLSX = await import(/* @vite-ignore */ URL_SHEETJS);
  } catch (error) {
    throw new Error(
      'No se pudo cargar el lector de Excel (puede estar bloqueado por la red de la empresa). ' +
      'Guarda la planilla como CSV y volve a intentar.'
    );
  }

  const buffer = await archivo.arrayBuffer();
  const libro = XLSX.read(buffer, { type: 'array', cellDates: false });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  if (!hoja) throw new Error('La planilla no tiene ninguna hoja con datos.');

  const matriz = XLSX.utils.sheet_to_json(hoja, { header: 1, blankrows: false, defval: '' });
  return desdeMatriz(matriz);
}

/** Convierte una matriz cruda en { encabezados, filas }. */
function desdeMatriz(matriz) {
  const limpias = matriz.filter(f => f.some(c => String(c ?? '').trim() !== ''));
  if (!limpias.length) throw new Error('La planilla esta vacia.');

  const encabezados = limpias[0].map(c => String(c ?? '').trim());
  const filas = limpias.slice(1).map(f => {
    const completa = [];
    for (let i = 0; i < encabezados.length; i++) completa.push(f[i] ?? '');
    return completa;
  });

  return { encabezados, filas };
}

/**
 * Parser de CSV propio: detecta el separador, respeta comillas
 * y soporta saltos de linea dentro de una celda.
 */
export function parsearCSV(texto) {
  const limpio = texto.replace(/^\uFEFF/, '');
  const separador = detectarSeparador(limpio);
  const matriz = [];
  let fila = [];
  let celda = '';
  let entreComillas = false;

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];

    if (entreComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') { celda += '"'; i++; }
        else entreComillas = false;
      } else celda += c;
      continue;
    }

    if (c === '"') { entreComillas = true; continue; }
    if (c === separador) { fila.push(celda); celda = ''; continue; }
    if (c === '\n') { fila.push(celda); matriz.push(fila); fila = []; celda = ''; continue; }
    if (c === '\r') continue;
    celda += c;
  }
  if (celda !== '' || fila.length) { fila.push(celda); matriz.push(fila); }

  return desdeMatriz(matriz);
}

function detectarSeparador(texto) {
  const muestra = texto.split('\n').slice(0, 5).join('\n');
  const conteo = { ';': 0, ',': 0, '\t': 0 };
  let entreComillas = false;
  for (const c of muestra) {
    if (c === '"') entreComillas = !entreComillas;
    else if (!entreComillas && conteo[c] !== undefined) conteo[c]++;
  }
  return Object.entries(conteo).sort((a, b) => b[1] - a[1])[0][0] || ',';
}

/* ==========================================================
   Deteccion de columnas
   ========================================================== */

/** Devuelve { campo: indiceDeColumna } segun los nombres de encabezado. */
export function detectarMapeo(encabezados) {
  const mapeo = {};
  const usadas = new Set();

  for (const [campo, alias] of Object.entries(ENCABEZADOS_CONOCIDOS)) {
    for (let i = 0; i < encabezados.length; i++) {
      if (usadas.has(i)) continue;
      const enc = normalizar(encabezados[i]);
      if (!enc) continue;
      if (alias.includes(enc)) { mapeo[campo] = i; usadas.add(i); break; }
    }
    /* Segunda pasada mas permisiva: coincidencia parcial */
    if (mapeo[campo] === undefined) {
      for (let i = 0; i < encabezados.length; i++) {
        if (usadas.has(i)) continue;
        const enc = normalizar(encabezados[i]);
        if (!enc) continue;
        if (alias.some(a => enc.includes(a) || a.includes(enc))) {
          mapeo[campo] = i; usadas.add(i); break;
        }
      }
    }
  }
  return mapeo;
}

export const CAMPOS_IMPORTABLES = [
  { id: 'baseId', nombre: 'Base', requerido: true },
  { id: 'titulo', nombre: 'Titulo de la tarea', requerido: true },
  { id: 'solicitante', nombre: 'Solicitante', requerido: false },
  { id: 'asignados', nombre: 'Responsable', requerido: false },
  { id: 'prioridad', nombre: 'Prioridad', requerido: false },
  { id: 'estado', nombre: 'Estado', requerido: false },
  { id: 'categoriaId', nombre: 'Categoria', requerido: false },
  { id: 'vencimiento', nombre: 'Vencimiento', requerido: false },
  { id: 'descripcion', nombre: 'Observaciones', requerido: false }
];

/* ==========================================================
   Conversion de valores
   ========================================================== */

/** Busca la base por codigo o por nombre, tolerando variantes. */
export function buscarBase(valor, bases) {
  const v = normalizar(valor);
  if (!v) return null;

  let base = bases.find(b => normalizar(b.codigo) === v);
  if (base) return base;

  base = bases.find(b => normalizar(b.nombre) === v);
  if (base) return base;

  /* "CERRO DRAGON" contra "Base Cerro Dragon" */
  base = bases.find(b => normalizar(b.nombre).replace(/^base /, '') === v);
  if (base) return base;

  if (v.length >= 4) {
    base = bases.find(b => normalizar(b.nombre).includes(v));
    if (base) return base;
  }
  return null;
}

/** Busca la persona por nombre completo o correo. */
export function buscarUsuario(valor, usuarios) {
  const v = normalizar(valor);
  if (!v) return null;

  let u = usuarios.find(x => normalizar(x.email) === v);
  if (u) return u;

  u = usuarios.find(x => normalizar(x.nombre) === v);
  if (u) return u;

  /* "Garcia, Carlos" contra "Carlos Garcia" */
  const partes = v.split(/[\s,]+/).filter(Boolean);
  if (partes.length >= 2) {
    u = usuarios.find(x => {
      const suyas = normalizar(x.nombre).split(/\s+/).filter(Boolean);
      return partes.every(p => suyas.includes(p)) && partes.length === suyas.length;
    });
    if (u) return u;
  }
  return null;
}

export function buscarCategoria(valor, categorias) {
  const v = normalizar(valor);
  if (!v) return null;
  return categorias.find(c => normalizar(c.nombre) === v)
      || categorias.find(c => normalizar(c.nombre).includes(v) && v.length >= 4)
      || null;
}

function porSinonimo(valor, tabla) {
  const v = normalizar(valor);
  if (!v) return null;
  for (const [id, alias] of Object.entries(tabla)) {
    if (id === v || alias.includes(v)) return id;
  }
  return null;
}

export const estadoDesde = (v) => porSinonimo(v, SINONIMOS_ESTADO);
export const prioridadDesde = (v) => porSinonimo(v, SINONIMOS_PRIORIDAD);

/**
 * Interpreta una celda de fecha. Acepta dd/mm/aaaa, aaaa-mm-dd
 * y el numero de serie que Excel guarda internamente.
 * Devuelve 'aaaa-mm-dd' o null, o lanza si no se entiende.
 */
export function fechaDesdeCelda(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;

  if (valor instanceof Date && !isNaN(valor)) return aISO(valor);

  const texto = String(valor).trim();

  /* Numero de serie de Excel: dias desde el 30/12/1899 */
  if (/^\d+(\.\d+)?$/.test(texto)) {
    const serie = Number(texto);
    if (serie > 0 && serie < 60000) {
      return aISO(new Date(Date.UTC(1899, 11, 30) + serie * 86400000));
    }
    throw new Error('fecha fuera de rango');
  }

  let m = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return validarPartes(m[1], m[2], m[3]);

  m = texto.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const anio = m[3].length === 2 ? `20${m[3]}` : m[3];
    return validarPartes(anio, m[2], m[1]);
  }

  throw new Error('formato de fecha no reconocido');
}

function validarPartes(a, m, d) {
  const anio = Number(a), mes = Number(m), dia = Number(d);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) throw new Error('fecha invalida');
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  if (f.getUTCMonth() !== mes - 1) throw new Error('fecha inexistente');
  return aISO(f);
}

function aISO(fecha) {
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}-${String(fecha.getUTCDate()).padStart(2, '0')}`;
}

/* ==========================================================
   Interpretacion de las filas
   ========================================================== */

/**
 * Convierte las filas crudas en tareas listas para guardar.
 *
 * @param {Array}  filas     filas crudas
 * @param {object} mapeo     { campo: indiceColumna }
 * @param {object} contexto  { bases, usuarios, categorias, tareasExistentes }
 * @returns {object} { resultados, resumen }
 */
export function interpretar(filas, mapeo, contexto) {
  const { bases = [], usuarios = [], categorias = [], tareasExistentes = [] } = contexto;

  /* Indice de lo que ya existe, para detectar repetidos */
  const yaCargadas = new Set(
    tareasExistentes.map(t => `${t.baseId}|${normalizar(t.titulo)}`)
  );
  const vistasEnPlanilla = new Set();

  const celda = (fila, campo) => {
    const i = mapeo[campo];
    if (i === undefined || i === null || i === '') return '';
    return String(fila[i] ?? '').trim();
  };

  const resultados = filas.map((fila, indice) => {
    const errores = [];
    const avisos = [];
    const datos = {};

    /* Base */
    const textoBase = celda(fila, 'baseId');
    if (!textoBase) {
      errores.push('falta la base');
    } else {
      const base = buscarBase(textoBase, bases);
      if (!base) errores.push(`la base "${textoBase}" no existe en el sistema`);
      else datos.baseId = base.id;
    }

    /* Titulo */
    const titulo = celda(fila, 'titulo');
    if (!titulo) errores.push('falta el titulo de la tarea');
    else datos.titulo = titulo;

    /* Solicitante y observaciones: texto libre */
    datos.solicitante = celda(fila, 'solicitante');
    datos.descripcion = celda(fila, 'descripcion');

    /* Responsables */
    const textoResp = celda(fila, 'asignados');
    datos.asignados = [];
    if (textoResp) {
      const nombres = textoResp.split(/[,;/]|\band\b|\by\b/).map(n => n.trim()).filter(Boolean);
      for (const nombre of nombres) {
        const usuario = buscarUsuario(nombre, usuarios);
        if (usuario) datos.asignados.push(usuario.id);
        else errores.push(`no existe el usuario "${nombre}"`);
      }
    } else {
      avisos.push('sin responsable asignado');
    }

    /* Prioridad */
    const textoPri = celda(fila, 'prioridad');
    if (textoPri) {
      const pri = prioridadDesde(textoPri);
      if (pri) datos.prioridad = pri;
      else { datos.prioridad = PRIORIDAD_POR_DEFECTO; avisos.push(`prioridad "${textoPri}" no reconocida, queda media`); }
    } else {
      datos.prioridad = PRIORIDAD_POR_DEFECTO;
    }

    /* Estado */
    const textoEstado = celda(fila, 'estado');
    if (textoEstado) {
      const est = estadoDesde(textoEstado);
      if (est) datos.estado = est;
      else { datos.estado = ESTADO.PENDIENTE; avisos.push(`estado "${textoEstado}" no reconocido, queda pendiente`); }
    } else {
      datos.estado = ESTADO.PENDIENTE;
    }

    /* Categoria */
    const textoCat = celda(fila, 'categoriaId');
    if (textoCat) {
      const cat = buscarCategoria(textoCat, categorias);
      if (cat) datos.categoriaId = cat.id;
      else avisos.push(`categoria "${textoCat}" no encontrada, queda sin categoria`);
    }

    /* Vencimiento */
    const textoFecha = celda(fila, 'vencimiento');
    if (textoFecha) {
      try {
        datos.vencimiento = fechaDesdeCelda(textoFecha);
      } catch (error) {
        errores.push(`vencimiento "${textoFecha}": ${error.message}`);
      }
    }

    /* Repetidos */
    let duplicado = false;
    if (datos.baseId && datos.titulo) {
      const clave = `${datos.baseId}|${normalizar(datos.titulo)}`;
      if (yaCargadas.has(clave)) duplicado = 'ya existe en el sistema';
      else if (vistasEnPlanilla.has(clave)) duplicado = 'repetida dentro de la planilla';
      vistasEnPlanilla.add(clave);
    }

    return {
      numero: indice + 2, /* +2: fila 1 son los encabezados */
      cruda: fila,
      datos,
      errores,
      avisos,
      duplicado,
      valida: errores.length === 0
    };
  });

  const resumen = {
    total: resultados.length,
    validas: resultados.filter(r => r.valida && !r.duplicado).length,
    duplicadas: resultados.filter(r => r.valida && r.duplicado).length,
    conError: resultados.filter(r => !r.valida).length,
    conAviso: resultados.filter(r => r.valida && r.avisos.length).length
  };

  return { resultados, resumen };
}

/* ==========================================================
   Plantilla de ejemplo
   ========================================================== */

export function generarPlantillaCSV() {
  const filas = [
    ['BASE OP', 'DESCRIPCION DE TAREA', 'SOLICITANTE', 'RESPONSABLE', 'PRIORIDAD', 'ESTADO', 'VENCIMIENTO', 'OBSERVACIONES'],
    ['CERRO DRAGON', 'Refacciones vestuarios y banos', 'Carlos Garcia', 'Juan Cruz', 'ALTA', 'EN PROCESO', '30/09/2026', 'Estado al 90%'],
    ['CO', 'Reponer toner impresora administracion', 'Ana Diaz', '', 'MEDIA', 'PENDIENTE', '', 'Modelo HP 26A']
  ];
  const texto = filas.map(f => f.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  return '\uFEFF' + texto;
}
