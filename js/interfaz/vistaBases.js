/* ==========================================================
   vistaBases.js - ABM de cuencas y bases (solo administrador)
   ========================================================== */

import { el, vaciar, ordenarPor, mensajeErrorAuth } from '../util.js';
import * as repoBases from '../datos/repoBases.js';
import * as repoTareas from '../datos/repoTareas.js';

import {
  abrirModal, cerrarModal, campoTexto, campoSelector, campoCasillas,
  bloqueError, estadoVacio, chipTenue, confirmar, avisoOk, avisoError
} from './componentes.js';

export function montarVistaBases(contenedor, ctx) {
  const { usuario, almacen } = ctx;

  const zonaCuencas = el('div');
  const zonaBases = el('div');

  contenedor.appendChild(
    el('div', {}, [
      el('div.cabecera-vista', {}, [
        el('div', {}, [
          el('h1', { texto: 'Bases' }),
          el('p.descripcion', { texto: 'Cuencas y bases operativas donde se registran las tareas.' })
        ]),
        el('div.acciones', {}, [
          el('button.btn', { texto: 'Nueva cuenca', on: { click: () => formCuenca(null) } }),
          el('button.btn.btn-primario', { texto: 'Nueva base', on: { click: () => formBase(null) } })
        ])
      ]),
      zonaBases,
      zonaCuencas
    ])
  );

  /* ---------- Formularios ---------- */

  function formCuenca(cuenca) {
    const codigo = campoTexto({
      etiqueta: 'Codigo', nombre: 'codigo', valor: cuenca ? cuenca.codigo : '',
      placeholder: 'CGSJ', maxlength: 12, requerido: true
    });
    const nombre = campoTexto({
      etiqueta: 'Nombre', nombre: 'nombre', valor: cuenca ? cuenca.nombre : '',
      placeholder: 'Cuenca Golfo San Jorge', requerido: true
    });
    const orden = campoTexto({
      etiqueta: 'Orden', nombre: 'orden', tipo: 'number',
      valor: cuenca ? String(cuenca.orden ?? 99) : '99',
      ayuda: 'Define como se ordenan las cuencas en las listas.'
    });

    const zonaError = el('div');
    const boton = el('button.btn.btn-primario', { texto: cuenca ? 'Guardar' : 'Crear cuenca' });

    boton.addEventListener('click', async () => {
      vaciar(zonaError);
      if (!codigo.valor() || !nombre.valor()) {
        zonaError.appendChild(bloqueError('Completa el codigo y el nombre.'));
        return;
      }
      const datos = { codigo: codigo.valor(), nombre: nombre.valor(), orden: orden.entrada.value };
      boton.disabled = true;
      try {
        if (cuenca) await repoBases.actualizarCuenca(cuenca.id, datos);
        else await repoBases.crearCuenca(datos);
        cerrarModal();
        avisoOk(cuenca ? 'Cuenca actualizada.' : 'Cuenca creada.');
      } catch (error) {
        zonaError.appendChild(bloqueError(mensajeErrorAuth(error)));
        boton.disabled = false;
      }
    });

    abrirModal({
      titulo: cuenca ? 'Editar cuenca' : 'Nueva cuenca',
      cuerpo: el('div', {}, [zonaError, codigo.nodo, nombre.nodo, orden.nodo]),
      acciones: [el('button.btn', { texto: 'Cancelar', on: { click: cerrarModal } }), boton]
    });
  }

  function formBase(base) {
    if (!almacen.cuencas.length) {
      avisoError('Primero crea una cuenca.');
      return;
    }

    const cuenca = campoSelector({
      etiqueta: 'Cuenca', nombre: 'cuencaId',
      opciones: almacen.cuencas.map(c => ({ valor: c.id, texto: `${c.codigo} - ${c.nombre}` })),
      valor: base ? base.cuencaId : almacen.cuencas[0].id
    });
    const codigo = campoTexto({
      etiqueta: 'Codigo', nombre: 'codigo', valor: base ? base.codigo : '',
      placeholder: 'CO', maxlength: 12, requerido: true
    });
    const nombre = campoTexto({
      etiqueta: 'Nombre', nombre: 'nombre', valor: base ? base.nombre : '',
      placeholder: 'Base Caleta Olivia', requerido: true
    });
    const orden = campoTexto({
      etiqueta: 'Orden', nombre: 'orden', tipo: 'number',
      valor: base ? String(base.orden ?? 99) : '99'
    });
    const activa = campoCasillas({
      etiqueta: 'Estado',
      items: [{ valor: 'activa', texto: 'Base activa' }],
      seleccionados: base ? (base.activa !== false ? ['activa'] : []) : ['activa'],
      ayuda: 'Las bases inactivas no aparecen al crear tareas nuevas.'
    });

    const zonaError = el('div');
    const boton = el('button.btn.btn-primario', { texto: base ? 'Guardar' : 'Crear base' });

    boton.addEventListener('click', async () => {
      vaciar(zonaError);
      if (!codigo.valor() || !nombre.valor()) {
        zonaError.appendChild(bloqueError('Completa el codigo y el nombre.'));
        return;
      }
      const datos = {
        cuencaId: cuenca.valor(),
        codigo: codigo.valor(),
        nombre: nombre.valor(),
        orden: orden.entrada.value,
        activa: activa.valor().includes('activa')
      };
      boton.disabled = true;
      try {
        if (base) await repoBases.actualizarBase(base.id, datos);
        else await repoBases.crearBase(datos, usuario.uid);
        cerrarModal();
        avisoOk(base ? 'Base actualizada.' : 'Base creada.');
      } catch (error) {
        zonaError.appendChild(bloqueError(mensajeErrorAuth(error)));
        boton.disabled = false;
      }
    });

    abrirModal({
      titulo: base ? 'Editar base' : 'Nueva base',
      cuerpo: el('div', {}, [
        zonaError,
        cuenca.nodo,
        el('div.grilla-campos', {}, [codigo.nodo, orden.nodo]),
        nombre.nodo,
        activa.nodo
      ]),
      acciones: [el('button.btn', { texto: 'Cancelar', on: { click: cerrarModal } }), boton]
    });
  }

  /* ---------- Borrado ---------- */

  async function borrarBase(base) {
    const tareas = await repoTareas.listar();
    const usadas = tareas.filter(t => t.baseId === base.id).length;
    if (usadas) {
      avisoError(`No se puede borrar: hay ${usadas} tarea(s) en esta base. Desactivala en su lugar.`);
      return;
    }
    const ok = await confirmar({
      titulo: 'Borrar base',
      mensaje: `Se elimina "${base.nombre}".`,
      textoOk: 'Borrar',
      peligro: true
    });
    if (!ok) return;
    try {
      await repoBases.eliminarBase(base.id);
      avisoOk('Base borrada.');
    } catch (error) {
      avisoError(mensajeErrorAuth(error));
    }
  }

  async function borrarCuenca(cuenca) {
    const bases = almacen.bases.filter(b => b.cuencaId === cuenca.id).length;
    if (bases) {
      avisoError(`No se puede borrar: la cuenca tiene ${bases} base(s).`);
      return;
    }
    const ok = await confirmar({
      titulo: 'Borrar cuenca',
      mensaje: `Se elimina "${cuenca.nombre}".`,
      textoOk: 'Borrar',
      peligro: true
    });
    if (!ok) return;
    try {
      await repoBases.eliminarCuenca(cuenca.id);
      avisoOk('Cuenca borrada.');
    } catch (error) {
      avisoError(mensajeErrorAuth(error));
    }
  }

  /* ---------- Dibujo ---------- */

  function dibujarBases() {
    vaciar(zonaBases);

    if (!almacen.bases.length) {
      zonaBases.appendChild(
        el('div.tabla-marco', {}, [
          estadoVacio('No hay bases cargadas', 'Crea la primera con el boton Nueva base.')
        ])
      );
      return;
    }

    const cuerpo = el('tbody');
    const cuencasOrdenadas = ordenarPor(almacen.cuencas, c => c.orden ?? 99, c => c.nombre);
    const sinCuenca = almacen.bases.filter(b => !almacen.cuencaPorId[b.cuencaId]);

    const bloque = (titulo, bases) => {
      if (!bases.length) return;
      cuerpo.appendChild(
        el('tr', {}, [el('td.grupo-cuenca', { colspan: 4, texto: titulo })])
      );
      for (const base of ordenarPor(bases, b => b.orden ?? 99, b => b.nombre)) {
        cuerpo.appendChild(
          el('tr', { clase: base.activa === false ? 'inactivo' : '' }, [
            el('td', {}, [el('span.codigo-base', { texto: base.codigo })]),
            el('td', {}, [
              el('div.principal', { texto: base.nombre }),
              el('div.secundario', { texto: `Orden ${base.orden ?? 99}` })
            ]),
            el('td', {}, [chipTenue(base.activa === false ? 'Inactiva' : 'Activa')]),
            el('td.col-acciones', {}, [
              el('button.btn.btn-chico', { texto: 'Editar', on: { click: () => formBase(base) } }),
              el('button.btn.btn-chico.btn-peligro', {
                texto: 'Borrar',
                estilo: { marginLeft: '6px' },
                on: { click: () => borrarBase(base) }
              })
            ])
          ])
        );
      }
    };

    for (const cuenca of cuencasOrdenadas) {
      bloque(
        `${cuenca.codigo} \u00b7 ${cuenca.nombre}`,
        almacen.bases.filter(b => b.cuencaId === cuenca.id)
      );
    }
    bloque('Sin cuenca asignada', sinCuenca);

    zonaBases.appendChild(
      el('div.tabla-marco', {}, [
        el('table.tabla', {}, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', { texto: 'Codigo' }),
              el('th', { texto: 'Base' }),
              el('th', { texto: 'Estado' }),
              el('th', { texto: '' })
            ])
          ]),
          cuerpo
        ])
      ])
    );
  }

  function dibujarCuencas() {
    vaciar(zonaCuencas);
    if (!almacen.cuencas.length) return;

    const cuerpo = el('tbody');
    for (const cuenca of ordenarPor(almacen.cuencas, c => c.orden ?? 99)) {
      const cantidad = almacen.bases.filter(b => b.cuencaId === cuenca.id).length;
      cuerpo.appendChild(
        el('tr', {}, [
          el('td', {}, [el('span.codigo-base', { texto: cuenca.codigo })]),
          el('td', {}, [el('span.principal', { texto: cuenca.nombre })]),
          el('td', { texto: `${cantidad} base${cantidad === 1 ? '' : 's'}` }),
          el('td.col-acciones', {}, [
            el('button.btn.btn-chico', { texto: 'Editar', on: { click: () => formCuenca(cuenca) } }),
            el('button.btn.btn-chico.btn-peligro', {
              texto: 'Borrar',
              estilo: { marginLeft: '6px' },
              on: { click: () => borrarCuenca(cuenca) }
            })
          ])
        ])
      );
    }

    zonaCuencas.appendChild(
      el('div.panel', { estilo: { marginTop: '16px' } }, [
        el('div.panel-titulo', {}, [el('h2', { texto: 'Cuencas' })]),
        el('div.tabla-marco', {}, [
          el('table.tabla', {}, [
            el('thead', {}, [
              el('tr', {}, [
                el('th', { texto: 'Codigo' }),
                el('th', { texto: 'Nombre' }),
                el('th', { texto: 'Bases' }),
                el('th', { texto: '' })
              ])
            ]),
            cuerpo
          ])
        ])
      ])
    );
  }

  function redibujar() {
    dibujarBases();
    dibujarCuencas();
  }

  redibujar();
  return { actualizar: redibujar, desmontar: () => {} };
}
