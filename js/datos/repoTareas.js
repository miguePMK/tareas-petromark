/* ==========================================================
   repoTareas.js - Alta, edicion, estado y consulta de tareas
   ========================================================== */

import {
  db, ref, get, set, update, remove, push, onValue, serverTimestamp
} from '../firebase.js';

import { aLista, ordenarPor, clavesActivas, aMapa } from '../util.js';
import { ESTADO, PRIORIDAD_POR_DEFECTO, ESTADOS_CIERRE } from '../constantes.js';

/* ----------------------------------------------------------
   Lectura
   ---------------------------------------------------------- */

export async function obtener(id) {
  const snap = await get(ref(db, `tareas/${id}`));
  return snap.exists() ? { id, ...snap.val() } : null;
}

export async function listar() {
  const snap = await get(ref(db, 'tareas'));
  return ordenarPor(aLista(snap.val()), t => -(t.ultimaActividad || t.creadaEn || 0));
}

/**
 * Escucha todas las tareas.
 * El filtrado por asignacion para el operador se hace en la vista:
 * RTDB no puede consultar por pertenencia a un mapa. El indice
 * /indices/tareasPorUsuario queda mantenido para uso futuro.
 */
export function escucharTodas(callback) {
  return onValue(ref(db, 'tareas'), snap => {
    callback(ordenarPor(aLista(snap.val()), t => -(t.ultimaActividad || t.creadaEn || 0)));
  });
}

export function escucharUna(id, callback) {
  return onValue(ref(db, `tareas/${id}`), snap => {
    callback(snap.exists() ? { id, ...snap.val() } : null);
  });
}

/* ----------------------------------------------------------
   Escritura
   ---------------------------------------------------------- */

export async function crear(datos, uidAutor) {
  const nueva = push(ref(db, 'tareas'));
  const asignados = aMapa(datos.asignados);

  await set(nueva, {
    titulo: datos.titulo.trim(),
    descripcion: (datos.descripcion || '').trim() || null,
    baseId: datos.baseId,
    categoriaId: datos.categoriaId || null,
    prioridad: datos.prioridad || PRIORIDAD_POR_DEFECTO,
    vencimiento: datos.vencimiento || null,
    estado: ESTADO.PENDIENTE,
    asignados: asignados,
    creadaPor: uidAutor,
    creadaEn: serverTimestamp(),
    ultimaActividad: serverTimestamp(),
    cerradaEn: null
  });

  await sincronizarIndice(nueva.key, [], clavesActivas(asignados));
  return nueva.key;
}

/** Edita los campos de definicion. Solo admin y editor. */
export async function actualizarDefinicion(id, datos, asignadosAnteriores) {
  const asignados = aMapa(datos.asignados);

  await update(ref(db, `tareas/${id}`), {
    titulo: datos.titulo.trim(),
    descripcion: (datos.descripcion || '').trim() || null,
    baseId: datos.baseId,
    categoriaId: datos.categoriaId || null,
    prioridad: datos.prioridad || PRIORIDAD_POR_DEFECTO,
    vencimiento: datos.vencimiento || null,
    asignados: asignados,
    ultimaActividad: serverTimestamp()
  });

  await sincronizarIndice(id, asignadosAnteriores || [], clavesActivas(asignados));
}

/**
 * Cambia el estado. Habilitado para admin, editor y operadores asignados
 * (las reglas de la base solo permiten escribir estado, ultimaActividad
 * y cerradaEn a los asignados).
 */
export async function cambiarEstado(id, estado) {
  const cambios = {
    estado: estado,
    ultimaActividad: serverTimestamp()
  };
  cambios.cerradaEn = ESTADOS_CIERRE.includes(estado) ? serverTimestamp() : null;
  await update(ref(db, `tareas/${id}`), cambios);
}

/** Solo marca actividad reciente, sin tocar el estado. */
export async function marcarActividad(id) {
  await update(ref(db, `tareas/${id}`), { ultimaActividad: serverTimestamp() });
}

export async function eliminar(id, asignados) {
  await remove(ref(db, `avances/${id}`));
  await remove(ref(db, `tareas/${id}`));
  await sincronizarIndice(id, asignados || [], []);
}

/* ----------------------------------------------------------
   Indice por usuario
   ---------------------------------------------------------- */

async function sincronizarIndice(tareaId, anteriores, actuales) {
  const cambios = {};
  for (const uid of anteriores) {
    if (!actuales.includes(uid)) cambios[`${uid}/${tareaId}`] = null;
  }
  for (const uid of actuales) {
    if (!anteriores.includes(uid)) cambios[`${uid}/${tareaId}`] = true;
  }
  if (!Object.keys(cambios).length) return;
  try {
    await update(ref(db, 'indices/tareasPorUsuario'), cambios);
  } catch (error) {
    // El indice es auxiliar: si falla no se interrumpe la operacion principal
    console.warn('No se pudo actualizar el indice de tareas por usuario', error);
  }
}

/* ----------------------------------------------------------
   Filtros en memoria
   ---------------------------------------------------------- */

/** Deja solo las tareas donde el uid figura como asignado. */
export function soloAsignadasA(tareas, uid) {
  return tareas.filter(t => t.asignados && t.asignados[uid] === true);
}
