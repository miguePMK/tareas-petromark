/* ==========================================================
   vistaInformes.js - Informes y KPI para auditoria
   Visible para administrador y editor.
   ========================================================== */

import {
  el, vaciar, ordenarPor, estadoPorId, prioridadPorId,
  fechaCorta, haceCuanto, recortar
} from '../util.js';

import * as met from '../datos/metricas.js';
import * as repoTareas from '../datos/repoTareas.js';
import * as repoAvances from '../datos/repoAvances.js';

import { campoSelector, estadoVacio, chipTenue, avisoError } from './componentes.js';
import { dona, barras, tramos, evolucion, cifra } from './graficos.js';

const PERIODOS = [
  { valor: '30', texto: 'Ultimos 30 dias', dias: 30 },
  { valor: '90', texto: 'Ultimos 90 dias', dias: 90 },
  { valor: '180', texto: 'Ultimos 6 meses', dias: 180 },
  { valor: '365', texto: 'Ultimo ano', dias: 365 },
  { valor: '', texto: 'Todo el historico', dias: null }
];

export function montarVistaInformes(contenedor, ctx) {
  const { almacen, ir } = ctx;

  let tareas = [];
  let conteoAvances = {};
  let cortarEscucha = null;

  const filtros = { periodo: '90', cuencaId: '', baseId: '', categoriaId: '' };
  let dimension = 'base';

  const zonaBarra = el('div.barra-herramientas');
  const zonaCuerpo = el('div');

  contenedor.appendChild(
    el('div', {}, [
      el('div.cabecera-vista', {}, [
        el('div', {}, [
          el('h1', { texto: 'Informes' }),
          el('p.descripcion', { texto: 'Indicadores de gestion y cumplimiento.' })
        ]),
        el('div.acciones', {}, [
          el('button.btn', { texto: 'Actualizar', on: { click: cargarAvances } })
        ])
      ]),
      zonaBarra,
      zonaCuerpo
    ])
  );

  /* ==========================================================
     Datos
     ========================================================== */

  async function cargarAvances() {
    try {
      conteoAvances = await repoAvances.contarPorTarea();
      dibujarCuerpo();
    } catch (error) {
      console.error(error);
      avisoError('No se pudo leer la bitacora de avances.');
    }
  }

  /** Tareas del periodo y del recorte de base o cuenca. */
  function seleccionadas() {
    const periodo = PERIODOS.find(p => p.valor === filtros.periodo);
    let lista = met.filtrarPorPeriodo(tareas, periodo && periodo.dias ? met.haceDias(periodo.dias) : null);

    if (filtros.baseId) {
      lista = lista.filter(t => t.baseId === filtros.baseId);
    } else if (filtros.cuencaId) {
      const suyas = almacen.bases.filter(b => b.cuencaId === filtros.cuencaId).map(b => b.id);
      lista = lista.filter(t => suyas.includes(t.baseId));
    }

    if (filtros.categoriaId) lista = lista.filter(t => t.categoriaId === filtros.categoriaId);
    return lista;
  }

  /* ==========================================================
     Filtros
     ========================================================== */

  function dibujarBarra() {
    vaciar(zonaBarra);

    const selPeriodo = campoSelector({
      etiqueta: 'Periodo',
      nombre: 'periodo',
      opciones: PERIODOS.map(p => ({ valor: p.valor, texto: p.texto })),
      valor: filtros.periodo
    });
    selPeriodo.entrada.addEventListener('change', () => {
      filtros.periodo = selPeriodo.valor();
      dibujar();
    });

    const selCuenca = campoSelector({
      etiqueta: 'Cuenca',
      nombre: 'cuenca',
      opciones: almacen.cuencas.map(c => ({ valor: c.id, texto: c.nombre })),
      valor: filtros.cuencaId,
      vacio: 'Todas'
    });
    selCuenca.entrada.addEventListener('change', () => {
      filtros.cuencaId = selCuenca.valor();
      filtros.baseId = '';
      dibujar();
    });

    const basesDisponibles = filtros.cuencaId
      ? almacen.bases.filter(b => b.cuencaId === filtros.cuencaId)
      : almacen.bases;

    const selBase = campoSelector({
      etiqueta: 'Base',
      nombre: 'base',
      opciones: basesDisponibles.map(b => ({ valor: b.id, texto: `${b.codigo} - ${b.nombre}` })),
      valor: filtros.baseId,
      vacio: 'Todas'
    });
    selBase.entrada.addEventListener('change', () => {
      filtros.baseId = selBase.valor();
      dibujar();
    });

    const selCategoria = campoSelector({
      etiqueta: 'Categoria',
      nombre: 'categoria',
      opciones: almacen.categorias.map(c => ({ valor: c.id, texto: c.nombre })),
      valor: filtros.categoriaId,
      vacio: 'Todas'
    });
    selCategoria.entrada.addEventListener('change', () => {
      filtros.categoriaId = selCategoria.valor();
      dibujar();
    });

    zonaBarra.appendChild(selPeriodo.nodo);
    zonaBarra.appendChild(selCuenca.nodo);
    zonaBarra.appendChild(selBase.nodo);
    zonaBarra.appendChild(selCategoria.nodo);
    zonaBarra.appendChild(
      el('span.conteo', { texto: `${seleccionadas().length} de ${tareas.length} tareas` })
    );
  }

  /* ==========================================================
     Secciones
     ========================================================== */

  function panel(titulo, aclaracion, contenido) {
    return el('section.panel.bloque-informe', {}, [
      el('div.panel-titulo', {}, [
        el('h2', { texto: titulo }),
        aclaracion ? el('span.aclaracion', { texto: aclaracion }) : null
      ]),
      contenido
    ]);
  }

  /** Lista compacta de tareas, clickeable. */
  function listaTareas(lista, formatoDerecha) {
    if (!lista.length) return el('p.sin-datos', { texto: 'Ninguna.' });
    const zona = el('div.lista-informe');
    for (const tarea of lista) {
      zona.appendChild(
        el('button.fila-informe', {
          on: { click: () => ir('detalle', { id: tarea.id }) }
        }, [
          el('span.marca-prioridad', {
            estilo: { background: prioridadPorId(tarea.prioridad).color, height: '15px' }
          }),
          el('span.t', { texto: recortar(tarea.titulo, 62) }),
          el('span.b', { texto: (almacen.basePorId[tarea.baseId] || {}).codigo || '' }),
          el('span.d', { texto: formatoDerecha(tarea) })
        ])
      );
    }
    return zona;
  }

  /* ---------- 1. Cumplimiento ---------- */
  function seccionCumplimiento(lista) {
    const c = met.cumplimiento(lista);
    const color = c.pct === null ? 'var(--tinta-tenue)'
      : c.pct >= 80 ? 'var(--ok)'
      : c.pct >= 50 ? 'var(--alerta)' : 'var(--error)';

    return panel(
      'Cumplimiento de plazos',
      'sobre las finalizadas que tenian vencimiento',
      el('div', {}, [
        el('div.fila-indicadores', {}, [
          dona({
            porcentaje: c.pct,
            color,
            titulo: 'Cerradas en plazo',
            leyenda: c.medibles ? `${c.aTiempo} de ${c.medibles}` : 'sin tareas medibles'
          }),
          el('div.cifras', {}, [
            cifra({ valor: c.aTiempo, etiqueta: 'En plazo', color: 'var(--ok)' }),
            cifra({ valor: c.tarde, etiqueta: 'Fuera de plazo', color: 'var(--error)' }),
            cifra({ valor: c.vencidasAbiertas.length, etiqueta: 'Vencidas sin cerrar', color: 'var(--error)' }),
            cifra({ valor: c.sinPlazo, etiqueta: 'Sin vencimiento', detalle: 'no computan' })
          ])
        ]),

        c.vencidasAbiertas.length
          ? el('div.sub-bloque', {}, [
              el('h3', { texto: 'Vencidas y todavia abiertas' }),
              listaTareas(
                ordenarPor(c.vencidasAbiertas, t => t.vencimiento).slice(0, 8),
                t => `vencio ${fechaCorta(t.vencimiento)}`
              )
            ])
          : null,

        c.tardias.length
          ? el('div.sub-bloque', {}, [
              el('h3', { texto: 'Cerradas con mayor demora' }),
              listaTareas(
                c.tardias.slice(0, 5).map(x => x.tarea),
                t => {
                  const registro = c.tardias.find(x => x.tarea.id === t.id);
                  return `${registro.diasTarde} d tarde`;
                }
              )
            ])
          : null
      ])
    );
  }

  /* ---------- 2. Tiempos de resolucion ---------- */
  function seccionTiempos(lista) {
    const global = met.tiemposResolucion(lista);
    const porPrioridad = met.tiemposResolucion(lista, t => t.prioridad);
    const porBase = met.tiemposResolucion(lista, t => t.baseId);

    const itemsPrioridad = ordenarPor(
      porPrioridad.porGrupo,
      g => -prioridadPorId(g.clave).peso
    ).map(g => ({
      etiqueta: `${prioridadPorId(g.clave).nombre} (${g.cantidad})`,
      total: g.mediana,
      color: prioridadPorId(g.clave).color
    }));

    const itemsBase = ordenarPor(porBase.porGrupo, g => -g.mediana).map(g => ({
      etiqueta: `${(almacen.basePorId[g.clave] || {}).codigo || '?'} (${g.cantidad})`,
      total: g.mediana,
      color: 'var(--acento)'
    }));

    return panel(
      'Tiempos de resolucion',
      'dias entre creacion y cierre',
      el('div', {}, [
        el('div.cifras', {}, [
          cifra({ valor: global.mediana, etiqueta: 'Mediana', detalle: 'dias' }),
          cifra({ valor: global.promedio, etiqueta: 'Promedio', detalle: 'dias' }),
          cifra({ valor: global.minimo, etiqueta: 'Mas rapida', detalle: 'dias' }),
          cifra({ valor: global.maximo, etiqueta: 'Mas lenta', detalle: 'dias' }),
          cifra({ valor: global.cantidad, etiqueta: 'Cerradas', detalle: 'en el periodo' })
        ]),
        el('p.nota-informe', {
          texto: 'La mediana es la referencia mas honesta: una sola tarea de varios meses corre el promedio y da una lectura falsa.'
        }),
        itemsPrioridad.length
          ? el('div.dos-columnas', {}, [
              el('div.sub-bloque', {}, [
                el('h3', { texto: 'Mediana por prioridad' }),
                barras({ items: itemsPrioridad, sufijo: ' d', mostrarAbiertas: false })
              ]),
              el('div.sub-bloque', {}, [
                el('h3', { texto: 'Mediana por base' }),
                barras({ items: itemsBase.slice(0, 8), sufijo: ' d', mostrarAbiertas: false })
              ])
            ])
          : el('p.sin-datos', { texto: 'Todavia no hay tareas cerradas en el periodo.' })
      ])
    );
  }

  /* ---------- 3. Antiguedad del backlog ---------- */
  function seccionAntiguedad(lista) {
    const a = met.antiguedadBacklog(lista);

    return panel(
      'Antiguedad del backlog',
      'tiempo que llevan abiertas',
      el('div', {}, [
        el('div.cifras', {}, [
          cifra({ valor: a.total, etiqueta: 'Abiertas' }),
          cifra({ valor: a.promedioDias, etiqueta: 'Antiguedad media', detalle: 'dias' }),
          cifra({
            valor: a.tramos[3].cantidad,
            etiqueta: 'Mas de 90 dias',
            color: a.tramos[3].cantidad ? 'var(--error)' : 'var(--tinta)'
          })
        ]),
        tramos({ items: a.tramos, total: a.total }),
        a.masViejas.length
          ? el('div.sub-bloque', {}, [
              el('h3', { texto: 'Las mas antiguas sin cerrar' }),
              listaTareas(a.masViejas, t => `${met.diasAbierta(t)} dias`)
            ])
          : null
      ])
    );
  }

  /* ---------- 4. Evolucion mensual ---------- */
  function seccionEvolucion(lista) {
    const e = met.evolucionMensual(lista, 12);
    const ultimo = e.meses[e.meses.length - 1];
    const anterior = e.meses[e.meses.length - 2];
    let tendencia = null;

    if (ultimo && anterior) {
      const delta = ultimo.acumulado - anterior.acumulado;
      tendencia = delta === 0
        ? 'El pendiente se mantuvo respecto del mes anterior.'
        : delta > 0
          ? `El pendiente crecio en ${delta} tarea(s) respecto del mes anterior.`
          : `El pendiente bajo en ${Math.abs(delta)} tarea(s) respecto del mes anterior.`;
    }

    return panel(
      'Evolucion mensual',
      'creadas, cerradas y pendiente acumulado',
      el('div', {}, [
        evolucion(e),
        tendencia ? el('p.nota-informe', { texto: tendencia }) : null
      ])
    );
  }

  /* ---------- 5. Distribucion de carga ---------- */
  function seccionDistribucion(lista) {
    const selector = el('div.segmentado');
    for (const dim of met.DIMENSIONES) {
      selector.appendChild(el('button', {
        texto: dim.nombre,
        clase: dimension === dim.id ? 'activo' : '',
        on: { click: () => { dimension = dim.id; dibujarCuerpo(); } }
      }));
    }

    const d = met.distribucion(lista, met.clavesDe(dimension));

    const nombrar = (clave) => {
      switch (dimension) {
        case 'base': {
          const b = almacen.basePorId[clave];
          return b ? `${b.codigo} - ${b.nombre}` : 'Base eliminada';
        }
        case 'categoria': return (almacen.categoriaPorId[clave] || {}).nombre || 'Categoria eliminada';
        case 'prioridad': return prioridadPorId(clave).nombre;
        case 'estado': return estadoPorId(clave).nombre;
        case 'interno': return almacen.nombreUsuario(clave);
        case 'externo': return almacen.nombreExterno(clave);
        default: return clave;
      }
    };

    const colorear = (clave) => {
      if (dimension === 'prioridad') return prioridadPorId(clave).color;
      if (dimension === 'estado') return estadoPorId(clave).color;
      if (dimension === 'categoria') return (almacen.categoriaPorId[clave] || {}).color || 'var(--acento)';
      return 'var(--acento)';
    };

    const items = d.items.slice(0, 14).map(i => ({
      etiqueta: nombrar(i.clave),
      total: i.total,
      abiertas: i.abiertas,
      color: colorear(i.clave),
      clave: i.clave
    }));

    return panel(
      'Distribucion de carga',
      `${d.items.length} valores distintos`,
      el('div', {}, [
        selector,
        el('div', { estilo: { marginTop: '12px' } }, [
          barras({
            items,
            alClick: (item) => {
              if (dimension === 'base') { filtros.baseId = item.clave; dibujar(); }
            }
          })
        ]),
        d.sinDato
          ? el('p.nota-informe', { texto: `${d.sinDato} tarea(s) sin dato en esta dimension.` })
          : null,
        d.items.length > 14
          ? el('p.nota-informe', { texto: `Se muestran los 14 valores con mas carga de ${d.items.length}.` })
          : null
      ])
    );
  }

  /* ---------- 6. Trazabilidad ---------- */
  function seccionTrazabilidad(lista) {
    const t = met.trazabilidad(lista, conteoAvances);

    return panel(
      'Trazabilidad',
      'documentacion de los avances',
      el('div', {}, [
        el('div.cifras', {}, [
          cifra({
            valor: t.pctDocumentadas === null ? null : `${t.pctDocumentadas}%`,
            etiqueta: 'Con avances propios',
            detalle: 'ademas del automatico'
          }),
          cifra({
            valor: t.sinAvances.length,
            etiqueta: 'Sin ningun avance',
            color: t.sinAvances.length ? 'var(--error)' : 'var(--tinta)'
          }),
          cifra({
            valor: t.quietas.length,
            etiqueta: 'Abiertas sin movimiento',
            detalle: 'mas de 30 dias',
            color: t.quietas.length ? 'var(--alerta)' : 'var(--tinta)'
          }),
          cifra({
            valor: t.cerradasSinComentario.length,
            etiqueta: 'Cerradas sin explicacion',
            color: t.cerradasSinComentario.length ? 'var(--error)' : 'var(--tinta)'
          })
        ]),
        el('p.nota-informe', {
          texto: 'Una tarea cerrada sin comentario es un hallazgo tipico de auditoria: cambio de estado sin registro de que se hizo.'
        }),
        t.quietas.length
          ? el('div.sub-bloque', {}, [
              el('h3', { texto: 'Abiertas sin movimiento reciente' }),
              listaTareas(t.quietas.slice(0, 8), x => haceCuanto(x.ultimaActividad || x.creadaEn))
            ])
          : null,
        t.cerradasSinComentario.length
          ? el('div.sub-bloque', {}, [
              el('h3', { texto: 'Cerradas sin comentario' }),
              listaTareas(t.cerradasSinComentario.slice(0, 8), x => estadoPorId(x.estado).nombre)
            ])
          : null
      ])
    );
  }

  /* ==========================================================
     Dibujo
     ========================================================== */

  function dibujarCuerpo() {
    vaciar(zonaCuerpo);
    const lista = seleccionadas();

    if (!tareas.length) {
      zonaCuerpo.appendChild(
        el('div.panel', {}, [
          estadoVacio('Todavia no hay tareas', 'Los indicadores aparecen cuando haya datos cargados.')
        ])
      );
      return;
    }

    if (!lista.length) {
      zonaCuerpo.appendChild(
        el('div.panel', {}, [
          estadoVacio('Ninguna tarea en este recorte', 'Proba con un periodo mas amplio u otra base.')
        ])
      );
      return;
    }

    const r = met.resumen(lista);

    zonaCuerpo.appendChild(
      el('div.panel.bloque-informe', {}, [
        el('div.cifras.cifras-cabecera', {}, [
          cifra({ valor: r.total, etiqueta: 'Tareas en el recorte' }),
          cifra({ valor: r.abiertas, etiqueta: 'Abiertas', color: 'var(--acento)' }),
          cifra({ valor: r.finalizadas, etiqueta: 'Finalizadas', color: 'var(--ok)' }),
          cifra({ valor: r.canceladas, etiqueta: 'Canceladas', color: 'var(--tinta-tenue)' }),
          cifra({ valor: `${r.pctAvance}%`, etiqueta: 'Avance', detalle: 'sin contar canceladas' })
        ]),
        tramos({
          items: r.porEstado.map(e => ({ etiqueta: e.nombre, cantidad: e.cantidad, color: e.color })),
          total: r.total
        })
      ])
    );

    zonaCuerpo.appendChild(seccionCumplimiento(lista));
    zonaCuerpo.appendChild(seccionTiempos(lista));
    zonaCuerpo.appendChild(seccionAntiguedad(lista));
    zonaCuerpo.appendChild(seccionEvolucion(lista));
    zonaCuerpo.appendChild(seccionDistribucion(lista));
    zonaCuerpo.appendChild(seccionTrazabilidad(lista));
  }

  function dibujar() {
    dibujarBarra();
    dibujarCuerpo();
  }

  dibujar();

  cortarEscucha = repoTareas.escucharTodas(lista => {
    tareas = lista;
    dibujar();
  });

  cargarAvances();

  return {
    actualizar: dibujar,
    desmontar: () => { if (cortarEscucha) cortarEscucha(); }
  };
}
