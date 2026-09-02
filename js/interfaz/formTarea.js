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

  const solicitante = campoTexto({
    etiqueta: 'Solicitante',
    nombre: 'solicitante',
    valor: tarea ? tarea.solicitante || '' : '',
    placeholder: 'Quien pidio el trabajo',
    maxlength: 80
  });

  /* Solo las bases donde esta persona puede trabajar */
  const basesPermitidas = almacen.basesPermitidas(usuario, true);
  const recortado = almacen.tieneBasesRecortadas(usuario);

  /* Si se edita una tarea de una base fuera del alcance, esa base se
     mantiene en la lista para no perderla al guardar. */
  const opcionesBase = almacen.opcionesBasesPara(usuario, true);
  if (tarea && tarea.baseId && !basesPermitidas.some(b => b.id === tarea.baseId)) {
    const suya = almacen.basePorId[tarea.baseId];
    if (suya) {
      opcionesBase.push({
        valor: suya.id,
        texto: `${suya.codigo} - ${suya.nombre}`,
        grupo: 'Fuera de tu alcance'
      });
    }
  }

  const base = campoSelector({
    etiqueta: 'Base',
    nombre: 'baseId',
    opciones: opcionesBase,
    valor: tarea ? tarea.baseId : (opcionesBase.length === 1 ? opcionesBase[0].valor : ''),
    vacio: opcionesBase.length === 1 ? null : 'Elegir base',
    ayuda: recortado ? 'Solo figuran las bases que tenes asignadas.' : null
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
    etiqueta: 'Interno a cargo del seguimiento',
    items: asignables.map(u => ({
      valor: u.id,
      texto: u.nombre,
      grupo: u.rol === 'editor' ? 'editor' : ''
    })),
    seleccionados: tarea ? clavesActivas(tarea.asignados) : [],
    ayuda: 'Quien puede cambiar el estado y cargar avances. Al menos una persona.'
  });
  asignados.nodo.classList.add('ancho-total');
  asignados.nodo.querySelector('.casillas').classList.add('fichas');

  const externosDisponibles = almacen.externosActivos();
  const externos = campoCasillas({
    etiqueta: 'Ejecuta (externo)',
    items: externosDisponibles.map(e => ({
      valor: e.id,
      texto: e.nombre,
      grupo: e.empresa && e.empresa !== e.nombre ? e.empresa : ''
    })),
    seleccionados: tarea ? clavesActivas(tarea.externos) : [],
    ayuda: externosDisponibles.length
      ? 'Contratista o proveedor que hace el trabajo. No accede al sistema.'
      : 'Todavia no hay externos cargados. Se crean en Administracion, seccion Externos.'
  });
  externos.nodo.classList.add('ancho-total');
  externos.nodo.querySelector('.casillas').classList.add('fichas', 'externas');

  const zonaError = el('div');
  const botonGuardar = el('button.btn.btn-primario', {
    texto: esNueva ? 'Crear tarea' : 'Guardar cambios'
  });

  titulo.nodo.classList.add('ancho-total');
  descripcion.nodo.classList.add('ancho-total');

  const cuerpo = el('div', {}, [
    zonaError,
    !opcionesBase.length
      ? bloqueError('No tenes ninguna base asignada con la que trabajar. Pedile a un administrador que te asigne al menos una.')
      : null,
    el('div.form-tarea', {}, [
      titulo.nodo,
      descripcion.nodo,
      el('div.subtitulo', { texto: 'Ubicacion y clasificacion' }),
      base.nodo,
      solicitante.nodo,
      categoria.nodo,
      prioridad.nodo,
      vencimiento.nodo,
      el('div.subtitulo', { texto: 'Responsables' }),
      asignados.nodo,
      externos.nodo
    ])
  ]);

  if (!opcionesBase.length) botonGuardar.disabled = true;

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
    const permitida = opcionesBase.some(o => o.valor === base.valor());
    if (!permitida) {
      zonaError.appendChild(bloqueError('No tenes permiso para cargar tareas en esa base.'));
      return;
    }
    const seleccion = asignados.valor();
    if (!seleccion.length) {
      zonaError.appendChild(bloqueError(
        'Elegi al menos un interno a cargo del seguimiento. Sin eso, nadie puede cargar avances.'
      ));
      return;
    }

    const datos = {
      titulo: titulo.valor(),
      descripcion: descripcion.valor(),
      solicitante: solicitante.valor(),
      baseId: base.valor(),
      categoriaId: categoria.valor() || null,
      prioridad: prioridad.valor(),
      vencimiento: vencimiento.entrada.value || null,
      asignados: seleccion,
      externos: externos.valor()
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
