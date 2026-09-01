/* ==========================================================
   vistaExternos.js - ABM de responsables externos
   Contratistas y proveedores que ejecutan trabajo pero no
   tienen cuenta en el sistema.
   ========================================================== */

import { el, vaciar, ordenarPor, clavesActivas, mensajeErrorAuth } from '../util.js';
import * as repoExternos from '../datos/repoExternos.js';
import * as repoTareas from '../datos/repoTareas.js';

import {
  abrirModal, cerrarModal, campoTexto, campoCasillas,
  bloqueError, estadoVacio, chipTenue, confirmar, avisoOk, avisoError
} from './componentes.js';

export function montarVistaExternos(contenedor, ctx) {
  const { usuario, almacen } = ctx;

  let tareas = [];
  const zonaTabla = el('div');

  contenedor.appendChild(
    el('div', {}, [
      el('div.cabecera-vista', {}, [
        el('div', {}, [
          el('h1', { texto: 'Responsables externos' }),
          el('p.descripcion', { texto: 'Contratistas y proveedores que ejecutan tareas sin usuario en el sistema.' })
        ]),
        el('div.acciones', {}, [
          el('button.btn.btn-primario', { texto: 'Nuevo externo', on: { click: () => form(null) } })
        ])
      ]),
      el('div.panel', { estilo: { marginBottom: '14px' } }, [
        el('p', {
          texto: 'Un externo no inicia sesion ni carga avances: solo indica quien hace el trabajo. Toda tarea con externo necesita ademas un interno a cargo del seguimiento.',
          estilo: { margin: 0, color: 'var(--tinta-media)', fontSize: '12.5px' }
        })
      ]),
      zonaTabla
    ])
  );

  /* ---------- Cuantas tareas tiene cada uno ---------- */
  function tareasDe(id) {
    return tareas.filter(t => t.externos && t.externos[id] === true);
  }

  /* ---------- Formulario ---------- */
  function form(externo) {
    const nombre = campoTexto({
      etiqueta: 'Nombre',
      nombre: 'nombre',
      valor: externo ? externo.nombre : '',
      placeholder: 'DELTA',
      ayuda: 'Como figura en las planillas. Puede ser una persona o una empresa.',
      requerido: true
    });

    const empresa = campoTexto({
      etiqueta: 'Empresa',
      nombre: 'empresa',
      valor: externo ? externo.empresa || '' : '',
      placeholder: 'Delta Servicios SRL'
    });

    const contacto = campoTexto({
      etiqueta: 'Contacto',
      nombre: 'contacto',
      valor: externo ? externo.contacto || '' : '',
      placeholder: 'Correo o telefono'
    });

    const activo = campoCasillas({
      etiqueta: 'Estado',
      items: [{ valor: 'activo', texto: 'Disponible para asignar' }],
      seleccionados: externo ? (externo.activo !== false ? ['activo'] : []) : ['activo'],
      ayuda: 'Los inactivos no aparecen al crear tareas nuevas.'
    });

    const zonaError = el('div');
    const boton = el('button.btn.btn-primario', { texto: externo ? 'Guardar' : 'Crear externo' });

    boton.addEventListener('click', async () => {
      vaciar(zonaError);
      if (!nombre.valor()) {
        zonaError.appendChild(bloqueError('Completa el nombre.'));
        return;
      }
      const datos = {
        nombre: nombre.valor(),
        empresa: empresa.valor(),
        contacto: contacto.valor(),
        activo: activo.valor().includes('activo')
      };
      boton.disabled = true;
      try {
        if (externo) await repoExternos.actualizar(externo.id, datos);
        else await repoExternos.crear(datos, usuario.uid);
        cerrarModal();
        avisoOk(externo ? 'Externo actualizado.' : 'Externo creado.');
      } catch (error) {
        zonaError.appendChild(bloqueError(mensajeErrorAuth(error)));
        boton.disabled = false;
      }
    });

    abrirModal({
      titulo: externo ? 'Editar externo' : 'Nuevo responsable externo',
      cuerpo: el('div', {}, [
        zonaError,
        nombre.nodo,
        el('div.grilla-campos', {}, [empresa.nodo, contacto.nodo]),
        activo.nodo
      ]),
      acciones: [el('button.btn', { texto: 'Cancelar', on: { click: cerrarModal } }), boton]
    });
  }

  async function borrar(externo) {
    const usadas = tareasDe(externo.id).length;
    if (usadas) {
      avisoError(`No se puede borrar: hay ${usadas} tarea(s) a su nombre. Marcalo como inactivo.`);
      return;
    }
    const ok = await confirmar({
      titulo: 'Borrar externo',
      mensaje: `Se elimina "${externo.nombre}".`,
      textoOk: 'Borrar',
      peligro: true
    });
    if (!ok) return;
    try {
      await repoExternos.eliminar(externo.id);
      avisoOk('Externo borrado.');
    } catch (error) {
      avisoError(mensajeErrorAuth(error));
    }
  }

  /* ---------- Dibujo ---------- */
  function redibujar() {
    vaciar(zonaTabla);

    if (!almacen.externos.length) {
      zonaTabla.appendChild(
        el('div.tabla-marco', {}, [
          estadoVacio(
            'No hay responsables externos',
            'Crea uno por cada contratista que aparezca en tus planillas.',
            el('button.btn.btn-primario', { texto: 'Nuevo externo', on: { click: () => form(null) } })
          )
        ])
      );
      return;
    }

    const cuerpo = el('tbody');
    for (const externo of ordenarPor(almacen.externos, e => e.nombre)) {
      const suyas = tareasDe(externo.id);
      const abiertas = suyas.filter(t => t.estado !== 'finalizada' && t.estado !== 'cancelada').length;

      cuerpo.appendChild(
        el('tr', { clase: externo.activo === false ? 'inactivo' : '' }, [
          el('td', {}, [
            el('div.principal', { texto: externo.nombre }),
            externo.empresa ? el('div.secundario', { texto: externo.empresa }) : null
          ]),
          el('td', { texto: externo.contacto || '\u2014' }),
          el('td', {}, [
            suyas.length
              ? chipTenue(`${suyas.length} tarea${suyas.length === 1 ? '' : 's'} \u00b7 ${abiertas} abierta${abiertas === 1 ? '' : 's'}`)
              : el('span.secundario', { texto: 'Sin tareas' })
          ]),
          el('td', {}, [chipTenue(externo.activo === false ? 'Inactivo' : 'Activo')]),
          el('td.col-acciones', {}, [
            el('button.btn.btn-chico', { texto: 'Editar', on: { click: () => form(externo) } }),
            el('button.btn.btn-chico.btn-peligro', {
              texto: 'Borrar',
              estilo: { marginLeft: '6px' },
              on: { click: () => borrar(externo) }
            })
          ])
        ])
      );
    }

    zonaTabla.appendChild(
      el('div.tabla-marco', {}, [
        el('table.tabla', {}, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', { texto: 'Externo' }),
              el('th', { texto: 'Contacto' }),
              el('th', { texto: 'Carga' }),
              el('th', { texto: 'Estado' }),
              el('th', { texto: '' })
            ])
          ]),
          cuerpo
        ])
      ])
    );
  }

  redibujar();

  /* La suscripcion va despues de construir el DOM: si la respuesta
     llegara de inmediato, redibujar() correria sin contenedor. */
  const cortarEscucha = repoTareas.escucharTodas(lista => { tareas = lista; redibujar(); });

  return {
    actualizar: redibujar,
    desmontar: () => { if (cortarEscucha) cortarEscucha(); }
  };
}
