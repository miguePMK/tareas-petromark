/* ==========================================================
   vistaDetalle.js - Detalle de una tarea y su bitacora
   ========================================================== */

import {
  el, vaciar, clavesActivas, estadoPorId, textoVencimiento,
  claseVencimiento, fechaHora, haceCuanto, mensajeErrorAuth
} from '../util.js';

import { ESTADOS, ESTADOS_CIERRE } from '../constantes.js';
import { puedeGestionarTareas, puedeIntervenirEnTarea } from '../auth/sesion.js';

import * as repoTareas from '../datos/repoTareas.js';
import * as repoAvances from '../datos/repoAvances.js';

import {
  chipEstado, chipCategoria, chipPrioridad, chipTenue,
  estadoVacio, campoArea, campoSelector, bloqueError,
  confirmar, avisoOk, avisoError
} from './componentes.js';

import { abrirFormularioTarea } from './formTarea.js';

export function montarVistaDetalle(contenedor, ctx) {
  const { usuario, almacen, ir, params } = ctx;
  const tareaId = params.id;

  let tarea = null;
  let avances = [];
  let cortarTarea = null;
  let cortarAvances = null;

  const zonaPrincipal = el('div');
  const zonaLateral = el('div');
  const zonaCabecera = el('div.cabecera-vista');

  contenedor.appendChild(
    el('div', {}, [
      zonaCabecera,
      el('div.detalle', {}, [zonaPrincipal, zonaLateral])
    ])
  );

  /* ---------- Cabecera ---------- */
  function dibujarCabecera() {
    vaciar(zonaCabecera);
    zonaCabecera.appendChild(
      el('div', {}, [
        el('button.btn.btn-plano.btn-chico', {
          texto: '\u2190 Volver a tareas',
          on: { click: () => ir('tareas') }
        })
      ])
    );

    if (!tarea) return;

    const acciones = el('div.acciones');
    if (puedeGestionarTareas(usuario)) {
      acciones.appendChild(el('button.btn', {
        texto: 'Editar',
        on: { click: () => abrirFormularioTarea(ctx, tarea, null) }
      }));
      acciones.appendChild(el('button.btn.btn-peligro', {
        texto: 'Borrar',
        on: {
          click: async () => {
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
              ir('tareas');
            } catch (error) {
              avisoError('No se pudo borrar la tarea.');
              console.error(error);
            }
          }
        }
      }));
    }
    zonaCabecera.appendChild(acciones);
  }

  /* ---------- Panel principal ---------- */
  function dibujarPrincipal() {
    vaciar(zonaPrincipal);

    if (tarea === null) {
      zonaPrincipal.appendChild(
        el('div.panel', {}, [
          estadoVacio('La tarea no existe', 'Puede haber sido borrada por otro usuario.')
        ])
      );
      return;
    }

    zonaPrincipal.appendChild(
      el('div.panel', {}, [
        el('h1.detalle-titulo', { texto: tarea.titulo }),
        el('div', { estilo: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' } }, [
          chipEstado(tarea.estado),
          chipPrioridad(tarea.prioridad),
          chipCategoria(almacen.categoriaPorId[tarea.categoriaId])
        ]),
        tarea.descripcion
          ? el('p.detalle-desc', { texto: tarea.descripcion })
          : el('p.detalle-desc', { texto: 'Sin descripcion.', estilo: { color: 'var(--texto-tenue)' } })
      ])
    );

    /* Registro de avance */
    if (puedeIntervenirEnTarea(tarea, usuario)) {
      zonaPrincipal.appendChild(panelNuevoAvance());
    }

    /* Bitacora */
    const lista = el('div.avances');
    if (!avances.length) {
      lista.appendChild(el('p', {
        texto: 'Todavia no hay avances registrados.',
        estilo: { color: 'var(--texto-tenue)' }
      }));
    } else {
      for (const avance of avances) {
        lista.appendChild(
          el('div.avance', {}, [
            el('div.meta', {}, [
              el('span.autor', { texto: avance.autorNombre || almacen.nombreUsuario(avance.autorUid) }),
              el('span.fecha', { texto: fechaHora(avance.creadaEn) }),
              avance.estadoNuevo && avance.estadoNuevo !== avance.estadoAnterior
                ? el('span.cambio-estado', {
                    texto: avance.estadoAnterior
                      ? `${estadoPorId(avance.estadoAnterior).nombre} \u2192 ${estadoPorId(avance.estadoNuevo).nombre}`
                      : estadoPorId(avance.estadoNuevo).nombre
                  })
                : null
            ]),
            avance.texto ? el('div.texto', { texto: avance.texto }) : null
          ])
        );
      }
    }

    zonaPrincipal.appendChild(
      el('div.panel', {}, [
        el('div.panel-titulo', {}, [
          el('h2', { texto: 'Avances' }),
          el('span.acciones', {}, [chipTenue(`${avances.length} registro${avances.length === 1 ? '' : 's'}`)])
        ]),
        lista
      ])
    );
  }

  /* ---------- Formulario de avance ---------- */
  function panelNuevoAvance() {
    const estadoActual = tarea.estado;

    const texto = campoArea({
      etiqueta: 'Avance',
      nombre: 'texto',
      filas: 3,
      placeholder: 'Que se hizo, que falta, con quien se coordino'
    });

    const estado = campoSelector({
      etiqueta: 'Estado',
      nombre: 'estado',
      opciones: ESTADOS.map(e => ({ valor: e.id, texto: e.nombre })),
      valor: estadoActual
    });

    const zonaError = el('div');
    const boton = el('button.btn.btn-primario', { texto: 'Registrar avance' });

    const ayudaCierre = el('span.ayuda', { texto: '' });
    const revisarAyuda = () => {
      ayudaCierre.textContent = ESTADOS_CIERRE.includes(estado.valor()) && estado.valor() !== estadoActual
        ? 'Al cerrar la tarea el comentario es obligatorio.'
        : '';
    };
    estado.entrada.addEventListener('change', revisarAyuda);
    revisarAyuda();

    boton.addEventListener('click', async () => {
      vaciar(zonaError);
      const nuevoEstado = estado.valor();
      const cambiaEstado = nuevoEstado !== estadoActual;
      const comentario = texto.valor();

      if (!comentario && !cambiaEstado) {
        zonaError.appendChild(bloqueError('Escribi el avance o cambia el estado.'));
        return;
      }
      if (cambiaEstado && ESTADOS_CIERRE.includes(nuevoEstado) && !comentario) {
        zonaError.appendChild(bloqueError('Para cerrar la tarea hace falta un comentario.'));
        return;
      }

      boton.disabled = true;
      boton.textContent = 'Guardando';

      try {
        await repoAvances.agregar(tareaId, {
          texto: comentario,
          estadoAnterior: estadoActual,
          estadoNuevo: nuevoEstado
        }, usuario);

        if (cambiaEstado) {
          await repoTareas.cambiarEstado(tareaId, nuevoEstado);
        } else {
          await repoTareas.marcarActividad(tareaId);
        }

        texto.entrada.value = '';
        avisoOk(cambiaEstado ? `Estado actualizado a ${estadoPorId(nuevoEstado).nombre.toLowerCase()}.` : 'Avance registrado.');
      } catch (error) {
        zonaError.appendChild(bloqueError(mensajeErrorAuth(error)));
      } finally {
        boton.disabled = false;
        boton.textContent = 'Registrar avance';
      }
    });

    return el('div.panel.form-avance', {}, [
      el('div.panel-titulo', {}, [el('h2', { texto: 'Registrar avance' })]),
      zonaError,
      texto.nodo,
      el('div.fila', {}, [estado.nodo, boton]),
      ayudaCierre
    ]);
  }

  /* ---------- Panel lateral ---------- */
  function dibujarLateral() {
    vaciar(zonaLateral);
    if (!tarea) return;

    const estado = estadoPorId(tarea.estado);
    const asignados = clavesActivas(tarea.asignados);
    const base = almacen.basePorId[tarea.baseId];

    zonaLateral.appendChild(
      el('div.panel', {}, [
        el('div.panel-titulo', {}, [el('h2', { texto: 'Ficha' })]),
        el('dl.ficha', {}, [
          el('dt', { texto: 'Base' }),
          el('dd', { texto: base ? `${base.codigo} - ${base.nombre}` : 'Base eliminada' }),

          el('dt', { texto: 'Cuenca' }),
          el('dd', { texto: base ? (almacen.cuencaPorId[base.cuencaId] || {}).nombre || '-' : '-' }),

          el('dt', { texto: 'Vencimiento' }),
          el('dd', {}, [
            el('span', {
              texto: textoVencimiento(tarea.vencimiento),
              clase: claseVencimiento(tarea.vencimiento, estado.abierto)
            })
          ]),

          el('dt', { texto: 'Creada' }),
          el('dd', { texto: `${fechaHora(tarea.creadaEn)} por ${almacen.nombreUsuario(tarea.creadaPor)}` }),

          el('dt', { texto: 'Actividad' }),
          el('dd', { texto: haceCuanto(tarea.ultimaActividad || tarea.creadaEn) }),

          tarea.cerradaEn ? el('dt', { texto: 'Cerrada' }) : null,
          tarea.cerradaEn ? el('dd', { texto: fechaHora(tarea.cerradaEn) }) : null
        ])
      ])
    );

    zonaLateral.appendChild(
      el('div.panel', {}, [
        el('div.panel-titulo', {}, [el('h2', { texto: 'Asignada a' })]),
        el('div.asignados', {},
          asignados.length
            ? asignados.map(uid => chipTenue(almacen.nombreUsuario(uid)))
            : [chipTenue('Sin asignar')]
        )
      ])
    );
  }

  /* ---------- Arranque ---------- */
  function redibujar() {
    dibujarCabecera();
    dibujarPrincipal();
    dibujarLateral();
  }

  if (!tareaId) {
    redibujar();
    return { actualizar: redibujar, desmontar: () => {} };
  }

  cortarTarea = repoTareas.escucharUna(tareaId, (t) => {
    tarea = t;
    redibujar();
  });

  cortarAvances = repoAvances.escuchar(tareaId, (lista) => {
    avances = lista;
    redibujar();
  });

  return {
    actualizar: redibujar,
    desmontar: () => {
      if (cortarTarea) cortarTarea();
      if (cortarAvances) cortarAvances();
    }
  };
}
