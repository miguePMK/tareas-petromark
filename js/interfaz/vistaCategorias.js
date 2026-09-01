/* ==========================================================
   vistaCategorias.js - ABM de categorias (solo administrador)
   ========================================================== */

import { el, vaciar, ordenarPor, mensajeErrorAuth } from '../util.js';
import { COLORES_CATEGORIA } from '../constantes.js';
import * as repoCategorias from '../datos/repoCategorias.js';
import * as repoTareas from '../datos/repoTareas.js';

import {
  abrirModal, cerrarModal, campoTexto, campoSelector, campoCasillas,
  bloqueError, estadoVacio, chipTenue, confirmar, avisoOk, avisoError
} from './componentes.js';

export function montarVistaCategorias(contenedor, ctx) {
  const { usuario, almacen } = ctx;

  const zonaTabla = el('div');

  contenedor.appendChild(
    el('div', {}, [
      el('div.cabecera-vista', {}, [
        el('div', {}, [
          el('h1', { texto: 'Categorias' }),
          el('p.descripcion', { texto: 'Clasificacion descriptiva de las tareas.' })
        ]),
        el('div.acciones', {}, [
          el('button.btn.btn-primario', { texto: 'Nueva categoria', on: { click: () => form(null) } })
        ])
      ]),
      zonaTabla
    ])
  );

  function form(categoria) {
    const nombre = campoTexto({
      etiqueta: 'Nombre', nombre: 'nombre',
      valor: categoria ? categoria.nombre : '',
      placeholder: 'Mantenimiento', requerido: true
    });

    const color = campoSelector({
      etiqueta: 'Color', nombre: 'color',
      opciones: COLORES_CATEGORIA.map(c => ({ valor: c, texto: c })),
      valor: categoria ? categoria.color || COLORES_CATEGORIA[0] : COLORES_CATEGORIA[0],
      ayuda: 'Se usa en las etiquetas del listado.'
    });

    const muestra = el('span.muestra-color', { estilo: { background: color.valor() } });
    color.nodo.querySelector('label').prepend(muestra);
    color.entrada.addEventListener('change', () => { muestra.style.background = color.valor(); });

    const orden = campoTexto({
      etiqueta: 'Orden', nombre: 'orden', tipo: 'number',
      valor: categoria ? String(categoria.orden ?? 99) : '99'
    });

    const activa = campoCasillas({
      etiqueta: 'Estado',
      items: [{ valor: 'activa', texto: 'Categoria activa' }],
      seleccionados: categoria ? (categoria.activa !== false ? ['activa'] : []) : ['activa'],
      ayuda: 'Las inactivas no aparecen al crear tareas nuevas.'
    });

    const zonaError = el('div');
    const boton = el('button.btn.btn-primario', { texto: categoria ? 'Guardar' : 'Crear categoria' });

    boton.addEventListener('click', async () => {
      vaciar(zonaError);
      if (!nombre.valor()) {
        zonaError.appendChild(bloqueError('Completa el nombre.'));
        return;
      }
      const datos = {
        nombre: nombre.valor(),
        color: color.valor(),
        orden: orden.entrada.value,
        activa: activa.valor().includes('activa')
      };
      boton.disabled = true;
      try {
        if (categoria) await repoCategorias.actualizar(categoria.id, datos);
        else await repoCategorias.crear(datos, usuario.uid);
        cerrarModal();
        avisoOk(categoria ? 'Categoria actualizada.' : 'Categoria creada.');
      } catch (error) {
        zonaError.appendChild(bloqueError(mensajeErrorAuth(error)));
        boton.disabled = false;
      }
    });

    abrirModal({
      titulo: categoria ? 'Editar categoria' : 'Nueva categoria',
      cuerpo: el('div', {}, [
        zonaError,
        nombre.nodo,
        el('div.grilla-campos', {}, [color.nodo, orden.nodo]),
        activa.nodo
      ]),
      acciones: [el('button.btn', { texto: 'Cancelar', on: { click: cerrarModal } }), boton]
    });
  }

  async function borrar(categoria) {
    const tareas = await repoTareas.listar();
    const usadas = tareas.filter(t => t.categoriaId === categoria.id).length;
    if (usadas) {
      avisoError(`No se puede borrar: hay ${usadas} tarea(s) con esta categoria. Desactivala en su lugar.`);
      return;
    }
    const ok = await confirmar({
      titulo: 'Borrar categoria',
      mensaje: `Se elimina "${categoria.nombre}".`,
      textoOk: 'Borrar',
      peligro: true
    });
    if (!ok) return;
    try {
      await repoCategorias.eliminar(categoria.id);
      avisoOk('Categoria borrada.');
    } catch (error) {
      avisoError(mensajeErrorAuth(error));
    }
  }

  function redibujar() {
    vaciar(zonaTabla);

    if (!almacen.categorias.length) {
      zonaTabla.appendChild(
        el('div.tabla-marco', {}, [
          estadoVacio('No hay categorias', 'Crea la primera con el boton Nueva categoria.')
        ])
      );
      return;
    }

    const cuerpo = el('tbody');
    for (const categoria of ordenarPor(almacen.categorias, c => c.orden ?? 99, c => c.nombre)) {
      cuerpo.appendChild(
        el('tr', { clase: categoria.activa === false ? 'inactivo' : '' }, [
          el('td', {}, [
            el('span.muestra-color', { estilo: { background: categoria.color || '#4DA9CE' } }),
            el('span.principal', { texto: categoria.nombre })
          ]),
          el('td', { texto: `Orden ${categoria.orden ?? 99}` }),
          el('td', {}, [chipTenue(categoria.activa === false ? 'Inactiva' : 'Activa')]),
          el('td.col-acciones', {}, [
            el('button.btn.btn-chico', { texto: 'Editar', on: { click: () => form(categoria) } }),
            el('button.btn.btn-chico.btn-peligro', {
              texto: 'Borrar',
              estilo: { marginLeft: '6px' },
              on: { click: () => borrar(categoria) }
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
              el('th', { texto: 'Categoria' }),
              el('th', { texto: 'Orden' }),
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
  return { actualizar: redibujar, desmontar: () => {} };
}
