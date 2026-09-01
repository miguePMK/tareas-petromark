/* ==========================================================
   vistaPorBase.js - Tareas agrupadas por cuenca y base
   Cada base es un acordeon con la distribucion de estados.
   ========================================================== */

import {
  el, vaciar, ordenarPor, clavesActivas, estadoPorId, prioridadPorId,
  textoVencimiento, claseVencimiento, recortar
} from '../util.js';

import { ESTADOS } from '../constantes.js';
import { esOperador, puedeGestionarTareas } from '../auth/sesion.js';
import * as repoTareas from '../datos/repoTareas.js';

import { estadoVacio, chipTenue, marcaPrioridad, campoCasillas } from './componentes.js';
import { abrirFormularioTarea } from './formTarea.js';

export function montarVistaPorBase(contenedor, ctx) {
  const { usuario, almacen, ir } = ctx;

  let tareas = [];
  let cortarEscucha = null;

  /* Bases abiertas: se conserva entre redibujados */
  const abiertas = new Set();
  let mostrarCerradas = false;

  const zonaControles = el('div.barra-herramientas');
  const zonaLista = el('div');

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
          el('h1', { texto: 'Por base' }),
          el('p.descripcion', { texto: 'Las tareas agrupadas por cuenca y base operativa.' })
        ]),
        botonNueva ? el('div.acciones', {}, [botonNueva]) : null
      ]),
      zonaControles,
      zonaLista
    ])
  );

  /* ---------- Controles ---------- */
  function dibujarControles() {
    vaciar(zonaControles);

    const verCerradas = campoCasillas({
      etiqueta: 'Mostrar',
      items: [{ valor: 'cerradas', texto: 'Incluir finalizadas y canceladas' }],
      seleccionados: mostrarCerradas ? ['cerradas'] : []
    });
    verCerradas.nodo.querySelector('input').addEventListener('change', (ev) => {
      mostrarCerradas = ev.target.checked;
      dibujarLista();
      dibujarControles();
    });

    const total = visibles().filter(t => mostrarCerradas || estadoPorId(t.estado).abierto).length;

    zonaControles.appendChild(verCerradas.nodo);
    zonaControles.appendChild(
      el('div', { estilo: { display: 'flex', gap: '7px' } }, [
        el('button.btn.btn-chico', {
          texto: 'Abrir todas',
          on: {
            click: () => {
              for (const b of almacen.bases) abiertas.add(b.id);
              dibujarLista();
            }
          }
        }),
        el('button.btn.btn-chico', {
          texto: 'Cerrar todas',
          on: { click: () => { abiertas.clear(); dibujarLista(); } }
        })
      ])
    );
    zonaControles.appendChild(el('span.conteo', { texto: `${total} tarea${total === 1 ? '' : 's'}` }));
  }

  /* ---------- Datos ---------- */
  function visibles() {
    if (esOperador(usuario)) return repoTareas.soloAsignadasA(tareas, usuario.uid);
    return tareas;
  }

  function tareasDeBase(baseId) {
    return visibles().filter(t => t.baseId === baseId);
  }

  /* ---------- Piezas ---------- */

  /** Barra apilada con la proporcion de cada estado. */
  function barraEstados(lista) {
    const barra = el('div.barra-estados', { title: 'Distribucion de estados' });
    if (!lista.length) return barra;

    for (const estado of ESTADOS) {
      const cantidad = lista.filter(t => t.estado === estado.id).length;
      if (!cantidad) continue;
      barra.appendChild(el('span', {
        estilo: {
          width: `${(cantidad / lista.length) * 100}%`,
          background: estado.color
        },
        title: `${estado.nombre}: ${cantidad}`
      }));
    }
    return barra;
  }

  /** Contadores de los estados abiertos. */
  function conteos(lista) {
    const zona = el('div.conteos');
    for (const estado of ESTADOS) {
      if (!estado.abierto) continue;
      const cantidad = lista.filter(t => t.estado === estado.id).length;
      if (!cantidad) continue;
      zona.appendChild(
        el('span.contador', { title: estado.nombre }, [
          el('span.punto', { estilo: { background: estado.color } }),
          document.createTextNode(String(cantidad))
        ])
      );
    }
    return zona;
  }

  function filaTarea(tarea) {
    const estado = estadoPorId(tarea.estado);
    const asignadosUid = clavesActivas(tarea.asignados);

    return el('button.tarea-mini', {
      on: { click: () => ir('detalle', { id: tarea.id }) }
    }, [
      marcaPrioridad(tarea.prioridad),
      el('span.t', {}, [
        el('span.titulo', { texto: tarea.titulo }),
        el('span.meta', {
          texto: asignadosUid.length
            ? asignadosUid.map(uid => almacen.nombreUsuario(uid)).join(', ')
            : 'Sin asignar'
        })
      ]),
      el('span', {}, [
        el('span.chip', { texto: estado.nombre, estilo: { color: estado.color } })
      ]),
      el('span.venc', {
        texto: textoVencimiento(tarea.vencimiento),
        clase: claseVencimiento(tarea.vencimiento, estado.abierto)
      })
    ]);
  }

  function acordeonBase(base) {
    const todas = tareasDeBase(base.id);
    const aMostrar = ordenarPor(
      todas.filter(t => mostrarCerradas || estadoPorId(t.estado).abierto),
      t => -prioridadPorId(t.prioridad).peso,
      t => t.vencimiento || '9999-99-99'
    );
    const abiertasCantidad = todas.filter(t => estadoPorId(t.estado).abierto).length;

    const cuerpo = el('div.cuerpo');
    if (aMostrar.length) {
      for (const tarea of aMostrar) cuerpo.appendChild(filaTarea(tarea));
    } else {
      cuerpo.appendChild(
        el('div.vacio', { estilo: { padding: '18px' } }, [
          el('span', { texto: mostrarCerradas ? 'Esta base no tiene tareas.' : 'No hay tareas abiertas en esta base.' })
        ])
      );
    }

    const detalle = el('details.acordeon', { open: abiertas.has(base.id) ? '' : null }, [
      el('summary', {}, [
        el('span.flecha', { texto: '\u25B6' }),
        el('span.codigo-base', { texto: base.codigo }),
        el('span.datos-base', {}, [
          el('span.nombre-base', { texto: base.nombre }),
          !abiertasCantidad
            ? el('span.sin-abiertas', { texto: '  sin tareas abiertas' })
            : null
        ]),
        conteos(todas),
        barraEstados(todas)
      ]),
      cuerpo
    ]);

    detalle.addEventListener('toggle', () => {
      if (detalle.open) abiertas.add(base.id);
      else abiertas.delete(base.id);
    });

    return detalle;
  }

  /* ---------- Dibujo ---------- */
  function dibujarLista() {
    vaciar(zonaLista);

    if (!almacen.bases.length) {
      zonaLista.appendChild(
        el('div.tabla-marco', {}, [
          estadoVacio('No hay bases cargadas', 'Un administrador tiene que crearlas primero.')
        ])
      );
      return;
    }

    const cuencas = ordenarPor(almacen.cuencas, c => c.orden ?? 99, c => c.nombre);
    const sinCuenca = almacen.bases.filter(b => !almacen.cuencaPorId[b.cuencaId]);
    let algoDibujado = false;

    const bloque = (titulo, codigo, bases) => {
      if (!bases.length) return;
      const ordenadas = ordenarPor(bases, b => b.orden ?? 99, b => b.nombre);
      const total = ordenadas.reduce((n, b) => n + tareasDeBase(b.id)
        .filter(t => estadoPorId(t.estado).abierto).length, 0);

      const zona = el('section.cuenca-bloque', {}, [
        el('h2.cuenca-titulo', {}, [
          el('span', { texto: titulo }),
          codigo ? el('span.codigo', { texto: codigo }) : null,
          el('span.total', { texto: `${total} abierta${total === 1 ? '' : 's'}` })
        ])
      ]);

      for (const base of ordenadas) zona.appendChild(acordeonBase(base));
      zonaLista.appendChild(zona);
      algoDibujado = true;
    };

    for (const cuenca of cuencas) {
      bloque(cuenca.nombre, cuenca.codigo, almacen.bases.filter(b => b.cuencaId === cuenca.id));
    }
    bloque('Sin cuenca asignada', '', sinCuenca);

    if (!algoDibujado) {
      zonaLista.appendChild(
        el('div.tabla-marco', {}, [estadoVacio('No hay bases para mostrar', '')])
      );
    }
  }

  /* ---------- Arranque ---------- */
  function redibujar() {
    dibujarControles();
    dibujarLista();
  }

  /* La primera vez se abren las bases que tengan tareas abiertas */
  let primeraCarga = true;

  cortarEscucha = repoTareas.escucharTodas(lista => {
    tareas = lista;
    if (primeraCarga) {
      primeraCarga = false;
      for (const base of almacen.bases) {
        const hay = tareasDeBase(base.id).some(t => estadoPorId(t.estado).abierto);
        if (hay) abiertas.add(base.id);
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
