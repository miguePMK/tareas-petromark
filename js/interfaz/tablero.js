/* ==========================================================
   tablero.js - Indicadores del listado de tareas
   Las tarjetas son filtros: al tocarlas acotan la lista.
   ========================================================== */

import {
  el, ordenarPor, estadoPorId, prioridadPorId, diasHasta,
  fechaCorta, recortar
} from '../util.js';

import { ESTADO, PRIORIDAD, DIAS_AVISO_VENCIMIENTO } from '../constantes.js';
import { esOperador } from '../auth/sesion.js';

/* ----------------------------------------------------------
   Calculo de indicadores
   ---------------------------------------------------------- */

export function calcularIndicadores(tareas) {
  const abiertas = tareas.filter(t => estadoPorId(t.estado).abierto);

  const vencidas = abiertas.filter(t => {
    const d = diasHasta(t.vencimiento);
    return d !== null && d < 0;
  });

  const proximas = abiertas.filter(t => {
    const d = diasHasta(t.vencimiento);
    return d !== null && d >= 0 && d <= DIAS_AVISO_VENCIMIENTO;
  });

  const urgentes = abiertas.filter(
    t => t.prioridad === PRIORIDAD.CRITICA || t.prioridad === PRIORIDAD.ALTA
  );

  const finalizadas = tareas.filter(t => t.estado === ESTADO.FINALIZADA);
  const canceladas = tareas.filter(t => t.estado === ESTADO.CANCELADA);

  /* Las canceladas no cuentan para el avance: no son trabajo pendiente */
  const universo = tareas.length - canceladas.length;
  const porcentaje = universo > 0 ? Math.round((finalizadas.length / universo) * 100) : 0;

  return {
    total: tareas.length,
    abiertas,
    vencidas,
    proximas,
    urgentes,
    finalizadas,
    canceladas,
    universo,
    porcentaje
  };
}

/* ----------------------------------------------------------
   Construccion del tablero
   ---------------------------------------------------------- */

/**
 * @param {Array}  tareas    tareas visibles para el usuario, sin filtrar
 * @param {object} ctx       contexto de la vista
 * @param {object} opciones  { filtroActivo, alFiltrar(clave), alAbrirTarea(id) }
 */
export function construirTablero(tareas, ctx, opciones = {}) {
  const { usuario, almacen } = ctx;
  const { filtroActivo = '', alFiltrar, alAbrirTarea } = opciones;
  const ind = calcularIndicadores(tareas);
  const compacto = esOperador(usuario);

  const zona = el('div.tablero');

  /* ---------- Tarjetas ---------- */
  const definiciones = [
    {
      clave: 'abiertas',
      etiqueta: 'Abiertas',
      valor: ind.abiertas.length,
      color: 'var(--acento)',
      tinte: 'var(--info-tinte)'
    },
    {
      clave: 'vencidas',
      etiqueta: 'Vencidas',
      valor: ind.vencidas.length,
      color: 'var(--error)',
      tinte: 'var(--error-tinte)'
    },
    {
      clave: 'proximas',
      etiqueta: `Vencen en ${DIAS_AVISO_VENCIMIENTO} dias`,
      valor: ind.proximas.length,
      color: 'var(--alerta)',
      tinte: 'var(--alerta-tinte)'
    },
    {
      clave: 'urgentes',
      etiqueta: 'Alta y critica',
      valor: ind.urgentes.length,
      color: '#8E44AD',
      tinte: '#F4ECF9'
    },
    {
      clave: 'finalizadas',
      etiqueta: 'Finalizadas',
      valor: ind.finalizadas.length,
      color: 'var(--ok)',
      tinte: 'var(--ok-tinte)'
    }
  ];

  /* El operador ve solo lo que le sirve para priorizar el dia */
  const visibles = compacto
    ? definiciones.filter(d => ['abiertas', 'vencidas', 'proximas'].includes(d.clave))
    : definiciones;

  const tarjetas = el('div.kpis');
  for (const def of visibles) {
    tarjetas.appendChild(
      el('button.kpi', {
        clase: [
          filtroActivo === def.clave ? 'activo' : '',
          def.valor === 0 ? 'vacio-kpi' : ''
        ].filter(Boolean).join(' '),
        estilo: {
          color: def.color,
          borderColor: def.valor === 0 ? 'var(--borde)' : def.color,
          background: def.valor === 0 ? 'var(--panel)' : def.tinte
        },
        title: filtroActivo === def.clave ? 'Tocar para quitar el filtro' : 'Tocar para filtrar',
        on: { click: () => alFiltrar && alFiltrar(filtroActivo === def.clave ? '' : def.clave) }
      }, [
        el('span.n', { texto: String(def.valor) }),
        el('span.e', { texto: def.etiqueta })
      ])
    );
  }
  zona.appendChild(tarjetas);

  /* ---------- Avance general ---------- */
  zona.appendChild(
    el('div.panel-avance', {}, [
      el('span.pct', { texto: `${ind.porcentaje}%` }),
      el('div.detalle-avance', {}, [
        el('div.progreso', {}, [
          el('span', { estilo: { width: `${ind.porcentaje}%` } })
        ]),
        el('div.leyenda', {
          texto: ind.universo
            ? `${ind.finalizadas.length} de ${ind.universo} tareas completadas` +
              (ind.canceladas.length ? ` (${ind.canceladas.length} cancelada${ind.canceladas.length === 1 ? '' : 's'} aparte)` : '')
            : 'Todavia no hay tareas cargadas'
        })
      ])
    ])
  );

  /* ---------- Proximos vencimientos ---------- */
  if (!compacto) {
    const conVencimiento = ordenarPor(
      ind.abiertas.filter(t => t.vencimiento),
      t => t.vencimiento
    ).slice(0, 5);

    if (conVencimiento.length) {
      const lista = el('div.vencimientos');

      for (const tarea of conVencimiento) {
        const dias = diasHasta(tarea.vencimiento);
        let texto;
        let color = 'var(--tinta-media)';

        if (dias < 0) {
          texto = `vencida hace ${Math.abs(dias)} d`;
          color = 'var(--error)';
        } else if (dias === 0) {
          texto = 'vence hoy';
          color = 'var(--error)';
        } else if (dias === 1) {
          texto = 'vence manana';
          color = 'var(--alerta)';
        } else if (dias <= DIAS_AVISO_VENCIMIENTO) {
          texto = `en ${dias} dias`;
          color = 'var(--alerta)';
        } else {
          texto = fechaCorta(tarea.vencimiento);
        }

        lista.appendChild(
          el('button.fila-venc', {
            on: { click: () => alAbrirTarea && alAbrirTarea(tarea.id) }
          }, [
            el('span.marca-prioridad', {
              estilo: { background: prioridadPorId(tarea.prioridad).color, height: '15px' }
            }),
            el('span.t', { texto: recortar(tarea.titulo, 70) }),
            el('span.b', { texto: (almacen.basePorId[tarea.baseId] || {}).codigo || '' }),
            el('span.d', { texto, estilo: { color } })
          ])
        );
      }

      zona.appendChild(
        el('div.panel.vencimientos', { estilo: { marginTop: '10px', padding: '11px 6px 6px' } }, [
          el('div.panel-titulo', { estilo: { margin: '0 9px 6px', paddingBottom: '7px' } }, [
            el('h2', { texto: 'Proximos vencimientos' })
          ]),
          lista
        ])
      );
    }
  }

  return zona;
}

/* ----------------------------------------------------------
   Filtros derivados de las tarjetas
   ---------------------------------------------------------- */

/** Aplica el filtro rapido elegido en el tablero. */
export function aplicarFiltroTablero(tareas, clave) {
  if (!clave) return tareas;
  const ind = calcularIndicadores(tareas);
  const mapa = {
    abiertas: ind.abiertas,
    vencidas: ind.vencidas,
    proximas: ind.proximas,
    urgentes: ind.urgentes,
    finalizadas: ind.finalizadas
  };
  const seleccion = mapa[clave];
  if (!seleccion) return tareas;
  const ids = new Set(seleccion.map(t => t.id));
  return tareas.filter(t => ids.has(t.id));
}
