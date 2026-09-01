/* ==========================================================
   formTarea.js - Formulario de alta y edicion de tareas
   Lo usan tanto el listado como el detalle.
   ========================================================== */

import { el, vaciar, clavesActivas, mensajeErrorAuth } from '../util.js';
import { PRIORIDADES, PRIORIDAD_POR_DEFECTO, LARGO_MAXIMO_TITULO } from '../constantes.js';
import * as repoTareas from '../datos/repoTareas.js';
import * as repoAvances from '../datos/repoAvances.js';
import {
  abrirModal, cerrarModal, campoTexto, campoArea, campoSelector,
  campoCasillas, bloqueError, avisoOk
} from './componentes.js';

/**
 * Abre el formulario de tarea.
 * @param {object} ctx      contexto de la vista { usuario, almacen }
 * @param {object|null} tarea  tarea existente o null para un alta
 * @param {function} alGuardar  callback opcional con el id de la tarea
 */
export function abrirFormularioTarea(ctx, tarea, alGuardar) {
  const { almacen, usuario } = ctx;
  const esNueva = !tarea;

  const titulo = campoTexto({
    etiqueta: 'Titulo',
    nombre: 'titulo',
    valor: tarea ? tarea.titulo : '',
    maxlength: LARGO_MAXIMO_TITULO,
    placeholder: 'Que hay que hacer, en una linea',
    requerido: true
  });

  const descripcion = campoArea({
    etiqueta: 'Descripcion',
    nombre: 'descripcion',
    valor: tarea ? tarea.descripcion || '' : '',
    filas: 4,
    placeholder: 'Detalle, contexto, datos utiles para el operador'
  });

  const base = campoSelector({
    etiqueta: 'Base',
    nombre: 'baseId',
    opciones: almacen.opcionesBases(true),
    valor: tarea ? tarea.baseId : '',
    vacio: 'Elegir base'
  });

  const categoria = campoSelector({
    etiqueta: 'Categoria',
    nombre: 'categoriaId',
    opciones: almacen.categorias
      .filter(c => c.activa !== false)
      .map(c => ({ valor: c.id, texto: c.nombre })),
    valor: tarea ? tarea.categoriaId || '' : '',
    vacio: 'Sin categoria'
  });

  const prioridad = campoSelector({
    etiqueta: 'Prioridad',
    nombre: 'prioridad',
    opciones: PRIORIDADES.map(p => ({ valor: p.id, texto: p.nombre })),
    valor: tarea ? tarea.prioridad : PRIORIDAD_POR_DEFECTO
  });

  const vencimiento = campoTexto({
    etiqueta: 'Vencimiento',
    nombre: 'vencimiento',
    tipo: 'date',
    valor: tarea ? tarea.vencimiento || '' : '',
    ayuda: 'Vacio = sin vencimiento.'
  });

  const asignables = almacen.asignables();
  const asignados = campoCasillas({
    etiqueta: 'Asignada a',
    items: asignables.map(u => ({
      valor: u.id,
      texto: u.nombre,
      grupo: u.rol === 'editor' ? 'editor' : ''
    })),
    seleccionados: tarea ? clavesActivas(tarea.asignados) : [],
    ayuda: 'Toca los nombres para asignar. Puede ser mas de una persona.'
  });
  asignados.nodo.classList.add('ancho-total');
  asignados.nodo.querySelector('.casillas').classList.add('fichas');

  const zonaError = el('div');
  const botonGuardar = el('button.btn.btn-primario', {
    texto: esNueva ? 'Crear tarea' : 'Guardar cambios'
  });

  titulo.nodo.classList.add('ancho-total');
  descripcion.nodo.classList.add('ancho-total');

  const cuerpo = el('div', {}, [
    zonaError,
    el('div.form-tarea', {}, [
      titulo.nodo,
      descripcion.nodo,
      el('div.subtitulo', { texto: 'Ubicacion y clasificacion' }),
      base.nodo,
      categoria.nodo,
      prioridad.nodo,
      vencimiento.nodo,
      el('div.subtitulo', { texto: 'Responsables' }),
      asignados.nodo
    ])
  ]);

  botonGuardar.addEventListener('click', async () => {
    vaciar(zonaError);

    if (!titulo.valor()) {
      zonaError.appendChild(bloqueError('El titulo no puede quedar vacio.'));
      return;
    }
    if (!base.valor()) {
      zonaError.appendChild(bloqueError('Elegi una base.'));
      return;
    }
    const seleccion = asignados.valor();
    if (!seleccion.length) {
      zonaError.appendChild(bloqueError('Asigna la tarea al menos a una persona.'));
      return;
    }

    const datos = {
      titulo: titulo.valor(),
      descripcion: descripcion.valor(),
      baseId: base.valor(),
      categoriaId: categoria.valor() || null,
      prioridad: prioridad.valor(),
      vencimiento: vencimiento.entrada.value || null,
      asignados: seleccion
    };

    botonGuardar.disabled = true;
    botonGuardar.textContent = 'Guardando';

    try {
      let id;
      if (esNueva) {
        id = await repoTareas.crear(datos, usuario.uid);
        await repoAvances.agregar(id, {
          texto: 'Tarea creada y asignada.',
          estadoNuevo: 'pendiente'
        }, usuario);
        avisoOk('Tarea creada.');
      } else {
        id = tarea.id;
        await repoTareas.actualizarDefinicion(id, datos, clavesActivas(tarea.asignados));
        avisoOk('Tarea actualizada.');
      }
      cerrarModal();
      if (alGuardar) alGuardar(id);
    } catch (error) {
      zonaError.appendChild(bloqueError(mensajeErrorAuth(error)));
      botonGuardar.disabled = false;
      botonGuardar.textContent = esNueva ? 'Crear tarea' : 'Guardar cambios';
    }
  });

  abrirModal({
    titulo: esNueva ? 'Nueva tarea' : 'Editar tarea',
    ancho: true,
    cuerpo,
    acciones: [
      el('button.btn', { texto: 'Cancelar', on: { click: () => cerrarModal() } }),
      botonGuardar
    ]
  });
}
