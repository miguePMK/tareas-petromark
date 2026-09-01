/* ==========================================================
   vistaTareas.js - Listado unico de tareas
   Dos modos de lectura: agrupadas por base (predeterminado)
   o como lista plana. Comparten tablero y filtros.
   ========================================================== */

import {
  el, vaciar, contiene, ordenarPor, clavesActivas,
  estadoPorId, prioridadPorId, textoVencimiento, claseVencimiento,
  haceCuanto, recortar, debounce
} from '../util.js';

import { ESTADOS, PRIORIDADES } from '../constantes.js';
import { puedeGestionarTareas, esOperador } from '../auth/sesion.js';
import * as repoTareas from '../datos/repoTareas.js';

import {
  chipEstado, chipCategoria, chipTenue, marcaPrioridad,
  estadoVacio, campoSelector, campoTexto, confirmar, avisoOk, avisoError
} from './componentes.js';

import { abrirFormularioTarea } from './formTarea.js';
import { construirTablero, aplicarFiltroTablero } from './tablero.js';

/* Se conservan entre navegaciones dentro de la misma sesion */
let modoGuardado = 'bases';
const basesAbiertas = new Set();
let basesInicializadas = false;

export function montarVistaTareas(contenedor, ctx) {
  const { usuario, almacen, ir } = ctx;

  let tareas = [];
  let cortarEscucha = null;
  let modo = modoGuardado;

  const filtros = {
    texto: '',
    estado: '',
    baseId: '',
    categoriaId: '',
    prioridad: '',
    asignadoUid: '',
    externoId: '',
    tablero: esOperador(usuario) ? 'abiertas' : 'abiertas'
  };

  /* ---------- Estructura ---------- */
  const zonaTablero = el('div');
  const zonaBarra = el('div.barra-herramientas');
  const zonaLista = el('div');

  const segmentado = el('div.segmentado');
  const botonNueva = puedeGestionarTareas(usuario)
    ? el('button.btn.btn-primario', {
        texto: 'Nueva tarea',
        on: { click: () => abrirFormularioTarea(ctx, null, (id) => ir('detalle', { id })) }
      })
    : null;

  contenedor.appendChild(
    el('div', {}, [
      el('div.cabecera-vista', {}, [
        el('div', {}, [
          el('h1', { texto: 'Tareas' }),
          el('p.descripcion', {
            texto: esOperador(usuario)
              ? 'Las tareas que tenes asignadas.'
              : 'Todas las tareas de la empresa.'
          })
        ]),
        el('div.acciones', {}, [segmentado, botonNueva].filter(Boolean))
      ]),
      zonaTablero,
      zonaBarra,
      zonaLista
    ])
  );

  /* ---------- Selector de modo ---------- */
  function dibujarSegmentado() {
    vaciar(segmentado);
    for (const opcion of [{ id: 'bases', texto: 'Por base' }, { id: 'lista', texto: 'Lista' }]) {
      segmentado.appendChild(el('button', {
        texto: opcion.texto,
        clase: modo === opcion.id ? 'activo' : '',
        on: {
          click: () => {
            modo = opcion.id;
            modoGuardado = opcion.id;
            dibujarSegmentado();
            dibujarLista();
          }
        }
      }));
    }
  }

  /* ---------- Tablero ---------- */
  function dibujarTablero() {
    vaciar(zonaTablero);
    zonaTablero.appendChild(
      construirTablero(visibles(), ctx, {
        filtroActivo: filtros.tablero,
        alFiltrar: (clave) => {
          filtros.tablero = clave;
          redibujar();
        },
        alAbrirTarea: (id) => ir('detalle', { id })
      })
    );
  }

  /* ---------- Filtros ---------- */
  function dibujarBarra() {
    vaciar(zonaBarra);

    const buscador = campoTexto({
      etiqueta: 'Buscar',
      nombre: 'buscar',
      valor: filtros.texto,
      placeholder: 'Titulo o descripcion'
    });
    buscador.nodo.classList.add('buscador');
    buscador.entrada.addEventListener('input', debounce(() => {
      filtros.texto = buscador.entrada.value;
      dibujarLista();
      actualizarConteo();
    }, 220));

    const selEstado = campoSelector({
      etiqueta: 'Estado',
      nombre: 'fEstado',
      opciones: ESTADOS.map(e => ({ valor: e.id, texto: e.nombre })),
      valor: filtros.estado,
      vacio: 'Todos'
    });
    selEstado.entrada.addEventListener('change', () => {
      filtros.estado = selEstado.valor();
      redibujar();
    });

    const selBase = campoSelector({
      etiqueta: 'Base',
      nombre: 'fBase',
      opciones: almacen.opcionesBases(false),
      valor: filtros.baseId,
      vacio: 'Todas'
    });
    selBase.entrada.addEventListener('change', () => {
      filtros.baseId = selBase.valor();
      dibujarLista();
      actualizarConteo();
    });

    const selCategoria = campoSelector({
      etiqueta: 'Categoria',
      nombre: 'fCat',
      opciones: almacen.categorias.map(c => ({ valor: c.id, texto: c.nombre })),
      valor: filtros.categoriaId,
      vacio: 'Todas'
    });
    selCategoria.entrada.addEventListener('change', () => {
      filtros.categoriaId = selCategoria.valor();
      dibujarLista();
      actualizarConteo();
    });

    const selPrioridad = campoSelector({
      etiqueta: 'Prioridad',
      nombre: 'fPri',
      opciones: PRIORIDADES.map(p => ({ valor: p.id, texto: p.nombre })),
      valor: filtros.prioridad,
      vacio: 'Todas'
    });
    selPrioridad.entrada.addEventListener('change', () => {
      filtros.prioridad = selPrioridad.valor();
      dibujarLista();
      actualizarConteo();
    });

    zonaBarra.appendChild(buscador.nodo);
    zonaBarra.appendChild(selEstado.nodo);
    zonaBarra.appendChild(selBase.nodo);
    zonaBarra.appendChild(selCategoria.nodo);
    zonaBarra.appendChild(selPrioridad.nodo);

    if (!esOperador(usuario)) {
      const selAsignado = campoSelector({
        etiqueta: 'Asignada a',
        nombre: 'fAsig',
        opciones: almacen.asignables().map(u => ({ valor: u.id, texto: u.nombre })),
        valor: filtros.asignadoUid,
        vacio: 'Cualquiera'
      });
      selAsignado.entrada.addEventListener('change', () => {
        filtros.asignadoUid = selAsignado.valor();
        dibujarLista();
        actualizarConteo();
      });
      zonaBarra.appendChild(selAsignado.nodo);

      if (almacen.externos.length) {
        const selExterno = campoSelector({
          etiqueta: 'Ejecuta',
          nombre: 'fExt',
          opciones: almacen.externos.map(e => ({ valor: e.id, texto: e.nombre })),
          valor: filtros.externoId,
          vacio: 'Cualquiera'
        });
        selExterno.entrada.addEventListener('change', () => {
          filtros.externoId = selExterno.valor();
          dibujarLista();
          actualizarConteo();
        });
        zonaBarra.appendChild(selExterno.nodo);
      }
    }

    if (hayFiltros()) {
      zonaBarra.appendChild(
        el('button.btn.btn-chico.btn-plano', {
          texto: 'Limpiar filtros',
          on: {
            click: () => {
              filtros.texto = '';
              filtros.estado = '';
              filtros.baseId = '';
              filtros.categoriaId = '';
              filtros.prioridad = '';
              filtros.asignadoUid = '';
              filtros.externoId = '';
              filtros.tablero = '';
              redibujar();
            }
          }
        })
      );
    }

    zonaBarra.appendChild(el('span.conteo', { texto: '' }));
    actualizarConteo();
  }

  function hayFiltros() {
    return !!(filtros.texto || filtros.estado || filtros.baseId ||
      filtros.categoriaId || filtros.prioridad || filtros.asignadoUid || filtros.tablero);
  }

  function actualizarConteo() {
    const nodo = zonaBarra.querySelector('.conteo');
    if (nodo) nodo.textContent = `${filtrar().length} / ${visibles().length}`;
  }

  /* ---------- Datos ---------- */
  function visibles() {
    if (esOperador(usuario)) return repoTareas.soloAsignadasA(tareas, usuario.uid);
    return tareas;
  }

  function filtrar() {
    let lista = aplicarFiltroTablero(visibles(), filtros.tablero);
    return lista.filter(t => {
      if (filtros.estado && t.estado !== filtros.estado) return false;
      if (filtros.baseId && t.baseId !== filtros.baseId) return false;
      if (filtros.categoriaId && t.categoriaId !== filtros.categoriaId) return false;
      if (filtros.prioridad && t.prioridad !== filtros.prioridad) return false;
      if (filtros.asignadoUid && !(t.asignados && t.asignados[filtros.asignadoUid] === true)) return false;
      if (filtros.externoId && !(t.externos && t.externos[filtros.externoId] === true)) return false;
      if (filtros.texto && !(contiene(t.titulo, filtros.texto) || contiene(t.descripcion, filtros.texto))) return false;
      return true;
    });
  }

  function ordenar(lista) {
    return ordenarPor(
      lista,
      t => -prioridadPorId(t.prioridad).peso,
      t => t.vencimiento || '9999-99-99',
      t => -(t.ultimaActividad || 0)
    );
  }

  /* ---------- Borrado ---------- */
  async function borrarTarea(tarea, ev) {
    if (ev) ev.stopPropagation();
    const ok = await confirmar({
      titulo: 'Borrar tarea',
      mensaje: `Se elimina "${tarea.titulo}" con todos sus avances. No se puede deshacer.`,
      textoOk: 'Borrar',
      peligro: true
    });
    if (!ok) return;
    try {
      await repoTareas.eliminar(tarea.id, clavesActivas(tarea.asignados));
      avisoOk('Tarea borrada.');
    } catch (error) {
      avisoError('No se pudo borrar la tarea.');
      console.error(error);
    }
  }

  /* ==========================================================
     Modo lista
     ========================================================== */
  function dibujarTabla(lista) {
    const cuerpo = el('tbody');

    for (const tarea of lista) {
      const estado = estadoPorId(tarea.estado);
      const asignadosUid = clavesActivas(tarea.asignados);

      cuerpo.appendChild(
        el('tr.clickeable', { on: { click: () => ir('detalle', { id: tarea.id }) } }, [
          el('td.celda-principal', {}, [
            el('div.tit-tarea', {}, [
              marcaPrioridad(tarea.prioridad),
              el('div', {}, [
                el('div.principal', { texto: tarea.titulo }),
                tarea.solicitante
                  ? el('div.secundario', { texto: `Solicita: ${tarea.solicitante}` })
                  : null,
                tarea.descripcion ? el('div.secundario', { texto: recortar(tarea.descripcion, 78) }) : null
              ])
            ])
          ]),
          el('td', { dataset: { etiqueta: 'Base' } }, [
            el('div', {}, [
              el('span.codigo-base', { texto: (almacen.basePorId[tarea.baseId] || {}).codigo || '?' }),
              el('span', { texto: ' ' + almacen.textoBase(tarea.baseId) })
            ]),
            el('div.secundario', { texto: almacen.textoCuencaDeBase(tarea.baseId) })
          ]),
          el('td', { dataset: { etiqueta: 'Categoria' } }, [chipCategoria(almacen.categoriaPorId[tarea.categoriaId])]),
          el('td', { dataset: { etiqueta: 'Estado' } }, [chipEstado(tarea.estado)]),
          el('td', { dataset: { etiqueta: 'Responsables' } }, [
            el('div.asignados', {}, [
              ...(asignadosUid.length
                ? asignadosUid.map(uid => chipTenue(almacen.nombreUsuario(uid)))
                : [chipTenue('Sin asignar')]),
              ...clavesActivas(tarea.externos).map(id =>
                el('span.chip.chip-externo', { texto: almacen.nombreExterno(id) }))
            ])
          ]),
          el('td', { dataset: { etiqueta: 'Vence' } }, [
            el('span', {
              texto: textoVencimiento(tarea.vencimiento),
              clase: claseVencimiento(tarea.vencimiento, estado.abierto)
            })
          ]),
          el('td', { dataset: { etiqueta: 'Actividad' } }, [
            el('span.secundario', { texto: haceCuanto(tarea.ultimaActividad || tarea.creadaEn) })
          ]),
          el('td.col-acciones', {}, [
            el('button.btn.btn-chico', {
              texto: 'Abrir',
              on: { click: (ev) => { ev.stopPropagation(); ir('detalle', { id: tarea.id }); } }
            }),
            puedeGestionarTareas(usuario)
              ? el('button.btn.btn-chico.btn-peligro', {
                  texto: 'Borrar',
                  estilo: { marginLeft: '6px' },
                  on: { click: (ev) => borrarTarea(tarea, ev) }
                })
              : null
          ])
        ])
      );
    }

    return el('div.tabla-marco', {}, [
      el('table.tabla.tabla-tarjetas', {}, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', { texto: 'Tarea' }),
            el('th', { texto: 'Base' }),
            el('th', { texto: 'Categoria' }),
            el('th', { texto: 'Estado' }),
            el('th', { texto: 'Responsables' }),
            el('th', { texto: 'Vence' }),
            el('th', { texto: 'Actividad' }),
            el('th', { texto: '' })
          ])
        ]),
        cuerpo
      ])
    ]);
  }

  /* ==========================================================
     Modo por base
     ========================================================== */
  function filaMini(tarea) {
    const estado = estadoPorId(tarea.estado);
    const asignadosUid = clavesActivas(tarea.asignados);

    return el('button.tarea-mini', {
      on: { click: () => ir('detalle', { id: tarea.id }) }
    }, [
      marcaPrioridad(tarea.prioridad),
      el('span.t', {}, [
        el('span.titulo', { texto: tarea.titulo }),
        el('span.meta', {
          texto: [
            asignadosUid.length
              ? asignadosUid.map(uid => almacen.nombreUsuario(uid)).join(', ')
              : 'Sin asignar',
            ...clavesActivas(tarea.externos).map(id => `ejecuta ${almacen.nombreExterno(id)}`)
          ].join(' \u00b7 ')
        })
      ]),
      el('span', {}, [chipEstado(tarea.estado)]),
      el('span.venc', {
        texto: textoVencimiento(tarea.vencimiento),
        clase: claseVencimiento(tarea.vencimiento, estado.abierto)
      })
    ]);
  }

  /**
   * @param base
   * @param listadas  tareas que pasan los filtros, son las que se muestran
   * @param todas     todas las tareas de la base: de aca salen avance y contadores,
   *                  para que el porcentaje no dependa del filtro activo
   */
  function acordeonBase(base, listadas, todas) {
    const finalizadas = todas.filter(t => t.estado === 'finalizada').length;
    const canceladas = todas.filter(t => t.estado === 'cancelada').length;
    const universo = todas.length - canceladas;
    const pct = universo > 0 ? Math.round((finalizadas / universo) * 100) : 0;
    const abiertas = todas.filter(t => estadoPorId(t.estado).abierto).length;

    const contadores = el('div.conteos');
    for (const estado of ESTADOS) {
      if (!estado.abierto) continue;
      const cantidad = todas.filter(t => t.estado === estado.id).length;
      if (!cantidad) continue;
      contadores.appendChild(
        el('span.contador', { title: estado.nombre }, [
          el('span.punto', { estilo: { background: estado.color } }),
          document.createTextNode(String(cantidad))
        ])
      );
    }

    const cuerpo = el('div.cuerpo');
    for (const tarea of ordenar(listadas)) cuerpo.appendChild(filaMini(tarea));

    /* Cuantas quedaron fuera por los filtros */
    const ocultas = todas.length - listadas.length;

    const detalle = el('details.acordeon', {
      open: basesAbiertas.has(base.id) ? '' : null
    }, [
      el('summary', {}, [
        el('span.flecha', { texto: '\u25B6' }),
        el('span.codigo-base', { texto: base.codigo }),
        el('span.datos-base', {}, [
          el('span.nombre-base', { texto: base.nombre }),
          !abiertas
            ? el('span.sin-abiertas', { texto: '  sin tareas abiertas' })
            : (ocultas > 0 ? el('span.sin-abiertas', { texto: `  ${listadas.length} de ${todas.length}` }) : null)
        ]),
        contadores,
        el('div.avance-base', {}, [
          el('span.pct', { texto: `${pct}%`, clase: pct === 0 ? 'cero' : '' }),
          el('div', { estilo: { flex: '1', minWidth: '0' } }, [
            el('div.progreso.fina', {}, [el('span', { estilo: { width: `${pct}%` } })]),
            el('div.fraccion', { texto: `${finalizadas}/${universo}` })
          ])
        ])
      ]),
      cuerpo
    ]);

    detalle.addEventListener('toggle', () => {
      if (detalle.open) basesAbiertas.add(base.id);
      else basesAbiertas.delete(base.id);
    });

    return detalle;
  }

  function dibujarAgrupado(lista) {
    const zona = el('div');

    const agrupar = (coleccion) => {
      const mapa = new Map();
      for (const tarea of coleccion) {
        if (!mapa.has(tarea.baseId)) mapa.set(tarea.baseId, []);
        mapa.get(tarea.baseId).push(tarea);
      }
      return mapa;
    };

    const porBase = agrupar(lista);
    const porBaseTodas = agrupar(visibles());

    const cuencas = ordenarPor(almacen.cuencas, c => c.orden ?? 99, c => c.nombre);
    const grupos = [
      ...cuencas.map(c => ({
        titulo: c.nombre,
        codigo: c.codigo,
        bases: almacen.bases.filter(b => b.cuencaId === c.id)
      })),
      {
        titulo: 'Sin cuenca asignada',
        codigo: '',
        bases: almacen.bases.filter(b => !almacen.cuencaPorId[b.cuencaId])
      }
    ];

    for (const grupo of grupos) {
      const conTareas = ordenarPor(
        grupo.bases.filter(b => (porBase.get(b.id) || []).length),
        b => b.orden ?? 99,
        b => b.nombre
      );
      if (!conTareas.length) continue;

      const total = conTareas.reduce((n, b) => n + porBase.get(b.id).length, 0);

      const seccion = el('section.cuenca-bloque', {}, [
        el('h2.cuenca-titulo', {}, [
          el('span', { texto: grupo.titulo }),
          grupo.codigo ? el('span.codigo', { texto: grupo.codigo }) : null,
          el('span.total', { texto: `${total} tarea${total === 1 ? '' : 's'}` })
        ])
      ]);

      for (const base of conTareas) {
        seccion.appendChild(acordeonBase(base, porBase.get(base.id), porBaseTodas.get(base.id) || []));
      }
      zona.appendChild(seccion);
    }

    return zona;
  }

  /* ---------- Dibujo de la lista ---------- */
  function dibujarLista() {
    vaciar(zonaLista);
    const lista = ordenar(filtrar());

    if (!lista.length) {
      zonaLista.appendChild(
        el('div.tabla-marco', {}, [
          estadoVacio(
            tareas.length ? 'Ninguna tarea coincide con los filtros' : 'Todavia no hay tareas',
            tareas.length
              ? 'Proba con otro estado o limpia los filtros.'
              : (puedeGestionarTareas(usuario)
                  ? 'Crea la primera con el boton Nueva tarea.'
                  : 'Cuando te asignen una tarea, va a aparecer aca.')
          )
        ])
      );
      return;
    }

    zonaLista.appendChild(modo === 'bases' ? dibujarAgrupado(lista) : dibujarTabla(lista));
  }

  /* ---------- Arranque ---------- */
  function redibujar() {
    dibujarSegmentado();
    dibujarTablero();
    dibujarBarra();
    dibujarLista();
  }

  cortarEscucha = repoTareas.escucharTodas(lista => {
    tareas = lista;

    /* La primera vez se abren las bases que tengan algo abierto */
    if (!basesInicializadas && almacen.bases.length) {
      basesInicializadas = true;
      for (const base of almacen.bases) {
        const hay = visibles().some(t => t.baseId === base.id && estadoPorId(t.estado).abierto);
        if (hay) basesAbiertas.add(base.id);
      }
    }

    redibujar();
  });

  redibujar();

  return {
    actualizar: redibujar,
    desmontar: () => { if (cortarEscucha) cortarEscucha(); }
  };
}
