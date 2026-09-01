/* ==========================================================
   vistaTareas.js - Listado principal de tareas
   ========================================================== */

import {
  el, vaciar, contiene, ordenarPor, clavesActivas,
  estadoPorId, prioridadPorId, textoVencimiento, claseVencimiento,
  haceCuanto, recortar, debounce
} from '../util.js';

import { ESTADOS, PRIORIDADES, ROL } from '../constantes.js';
import { puedeGestionarTareas, esOperador } from '../auth/sesion.js';
import * as repoTareas from '../datos/repoTareas.js';

import {
  chipEstado, chipCategoria, chipTenue, marcaPrioridad,
  estadoVacio, campoSelector, campoTexto, confirmar, avisoOk, avisoError
} from './componentes.js';

import { abrirFormularioTarea } from './formTarea.js';

export function montarVistaTareas(contenedor, ctx) {
  const { usuario, almacen, ir } = ctx;

  let tareas = [];
  let cortarEscucha = null;

  /* ---------- Estado de los filtros ---------- */
  const filtros = {
    texto: '',
    estado: 'abiertas',
    baseId: '',
    categoriaId: '',
    prioridad: '',
    asignadoUid: esOperador(usuario) ? usuario.uid : ''
  };

  /* ---------- Estructura de la vista ---------- */
  const zonaResumen = el('div.resumen');
  const zonaBarra = el('div.barra-herramientas');
  const zonaTabla = el('div');

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
        botonNueva ? el('div.acciones', {}, [botonNueva]) : null
      ]),
      zonaResumen,
      zonaBarra,
      zonaTabla
    ])
  );

  /* ---------- Barra de filtros ---------- */
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
      dibujarTabla();
      dibujarResumen();
    }, 220));

    const selBase = campoSelector({
      etiqueta: 'Base',
      nombre: 'fBase',
      opciones: almacen.opcionesBases(false),
      valor: filtros.baseId,
      vacio: 'Todas'
    });
    selBase.entrada.addEventListener('change', () => {
      filtros.baseId = selBase.valor();
      dibujarTabla();
      dibujarResumen();
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
      dibujarTabla();
      dibujarResumen();
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
      dibujarTabla();
      dibujarResumen();
    });

    zonaBarra.appendChild(buscador.nodo);
    zonaBarra.appendChild(selBase.nodo);
    zonaBarra.appendChild(selCategoria.nodo);
    zonaBarra.appendChild(selPrioridad.nodo);

    if (!esOperador(usuario)) {
      const selAsignado = campoSelector({
        etiqueta: 'Asignada a',
        nombre: 'fAsig',
        opciones: almacen.usuarios
          .filter(u => u.rol !== ROL.ADMIN)
          .map(u => ({ valor: u.id, texto: u.nombre })),
        valor: filtros.asignadoUid,
        vacio: 'Cualquiera'
      });
      selAsignado.entrada.addEventListener('change', () => {
        filtros.asignadoUid = selAsignado.valor();
        dibujarTabla();
        dibujarResumen();
      });
      zonaBarra.appendChild(selAsignado.nodo);
    }

    zonaBarra.appendChild(el('span.conteo', { texto: `${filtrar().length} / ${visibles().length}` }));
  }

  /* ---------- Resumen por estado ---------- */
  function dibujarResumen() {
    vaciar(zonaResumen);
    const base = visibles();

    const items = [
      { id: 'abiertas', nombre: 'Abiertas', color: 'var(--acento)' },
      ...ESTADOS.map(e => ({ id: e.id, nombre: e.nombre, color: e.color })),
      { id: '', nombre: 'Todas', color: 'var(--texto-tenue)' }
    ];

    for (const item of items) {
      const cantidad = base.filter(t => {
        if (item.id === '') return true;
        if (item.id === 'abiertas') return estadoPorId(t.estado).abierto;
        return t.estado === item.id;
      }).length;

      zonaResumen.appendChild(
        el('button.resumen-item', {
          clase: filtros.estado === item.id ? 'activo' : '',
          estilo: { borderTopColor: item.color },
          on: {
            click: () => {
              filtros.estado = item.id;
              dibujarResumen();
              dibujarTabla();
              dibujarBarra();
            }
          }
        }, [
          el('div.n', { texto: String(cantidad) }),
          el('div.e', { texto: item.nombre })
        ])
      );
    }
  }

  /* ---------- Filtrado ---------- */

  /** Tareas que el usuario tiene derecho a ver. */
  function visibles() {
    if (esOperador(usuario)) return repoTareas.soloAsignadasA(tareas, usuario.uid);
    return tareas;
  }

  function filtrar() {
    return visibles().filter(t => {
      if (filtros.estado === 'abiertas' && !estadoPorId(t.estado).abierto) return false;
      if (filtros.estado && filtros.estado !== 'abiertas' && t.estado !== filtros.estado) return false;
      if (filtros.baseId && t.baseId !== filtros.baseId) return false;
      if (filtros.categoriaId && t.categoriaId !== filtros.categoriaId) return false;
      if (filtros.prioridad && t.prioridad !== filtros.prioridad) return false;
      if (filtros.asignadoUid && !(t.asignados && t.asignados[filtros.asignadoUid] === true)) return false;
      if (filtros.texto && !(contiene(t.titulo, filtros.texto) || contiene(t.descripcion, filtros.texto))) return false;
      return true;
    });
  }

  /* ---------- Tabla ---------- */
  function dibujarTabla() {
    vaciar(zonaTabla);
    const lista = ordenarPor(
      filtrar(),
      t => -prioridadPorId(t.prioridad).peso,
      t => t.vencimiento || '9999-99-99',
      t => -(t.ultimaActividad || 0)
    );

    if (!lista.length) {
      zonaTabla.appendChild(
        el('div.tabla-marco', {}, [
          estadoVacio(
            tareas.length ? 'Ninguna tarea coincide con los filtros' : 'Todavia no hay tareas',
            tareas.length
              ? 'Proba con otro estado o limpia la busqueda.'
              : (puedeGestionarTareas(usuario)
                  ? 'Crea la primera con el boton Nueva tarea.'
                  : 'Cuando te asignen una tarea, va a aparecer aca.')
          )
        ])
      );
      return;
    }

    const cuerpo = el('tbody');

    for (const tarea of lista) {
      const estado = estadoPorId(tarea.estado);
      const asignadosUid = clavesActivas(tarea.asignados);

      const fila = el('tr.clickeable', {
        on: { click: () => ir('detalle', { id: tarea.id }) }
      }, [
        el('td', {}, [
          el('div.tit-tarea', {}, [
            marcaPrioridad(tarea.prioridad),
            el('div', {}, [
              el('div.principal', { texto: tarea.titulo }),
              tarea.descripcion
                ? el('div.secundario', { texto: recortar(tarea.descripcion, 78) })
                : null
            ])
          ])
        ]),
        el('td', {}, [
          el('div', {}, [
            el('span.codigo-base', { texto: (almacen.basePorId[tarea.baseId] || {}).codigo || '?' }),
            el('span', { texto: ' ' + almacen.textoBase(tarea.baseId) })
          ]),
          el('div.secundario', { texto: almacen.textoCuencaDeBase(tarea.baseId) })
        ]),
        el('td', {}, [chipCategoria(almacen.categoriaPorId[tarea.categoriaId])]),
        el('td', {}, [chipEstado(tarea.estado)]),
        el('td', {}, [
          el('div.asignados', {},
            asignadosUid.length
              ? asignadosUid.map(uid => chipTenue(almacen.nombreUsuario(uid)))
              : [chipTenue('Sin asignar')]
          )
        ]),
        el('td', {}, [
          el('span', {
            texto: textoVencimiento(tarea.vencimiento),
            clase: claseVencimiento(tarea.vencimiento, estado.abierto)
          })
        ]),
        el('td', {}, [
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
                on: {
                  click: async (ev) => {
                    ev.stopPropagation();
                    const ok = await confirmar({
                      titulo: 'Borrar tarea',
                      mensaje: `Se elimina "${tarea.titulo}" con todos sus avances. No se puede deshacer.`,
                      textoOk: 'Borrar',
                      peligro: true
                    });
                    if (!ok) return;
                    try {
                      await repoTareas.eliminar(tarea.id, asignadosUid);
                      avisoOk('Tarea borrada.');
                    } catch (error) {
                      avisoError('No se pudo borrar la tarea.');
                      console.error(error);
                    }
                  }
                }
              })
            : null
        ])
      ]);

      cuerpo.appendChild(fila);
    }

    zonaTabla.appendChild(
      el('div.tabla-marco', {}, [
        el('table.tabla', {}, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', { texto: 'Tarea' }),
              el('th', { texto: 'Base' }),
              el('th', { texto: 'Categoria' }),
              el('th', { texto: 'Estado' }),
              el('th', { texto: 'Asignada a' }),
              el('th', { texto: 'Vencimiento' }),
              el('th', { texto: 'Actividad' }),
              el('th', { texto: '' })
            ])
          ]),
          cuerpo
        ])
      ])
    );
  }

  /* ---------- Arranque ---------- */
  function redibujar() {
    dibujarResumen();
    dibujarBarra();
    dibujarTabla();
  }

  cortarEscucha = repoTareas.escucharTodas(lista => {
    tareas = lista;
    redibujar();
  });

  redibujar();

  return {
    actualizar: redibujar,
    desmontar: () => { if (cortarEscucha) cortarEscucha(); }
  };
}
