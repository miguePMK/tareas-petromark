/* ==========================================================
   repoCategorias.js - Categorias descriptivas de las tareas
   Solo el administrador las crea, edita o desactiva.
   ========================================================== */

import { db, ref, get, set, update, remove, push, onValue, serverTimestamp } from '../firebase.js';
import { aLista, ordenarPor } from '../util.js';

export async function listar() {
  const snap = await get(ref(db, 'categorias'));
  return ordenarPor(aLista(snap.val()), c => c.orden ?? 99, c => c.nombre);
}

export function escuchar(callback) {
  return onValue(ref(db, 'categorias'), snap => {
    callback(ordenarPor(aLista(snap.val()), c => c.orden ?? 99, c => c.nombre));
  });
}

export async function crear(datos, uidAutor) {
  const nueva = push(ref(db, 'categorias'));
  await set(nueva, {
    nombre: datos.nombre.trim(),
    color: datos.color || '#4DA9CE',
    activa: datos.activa !== false,
    orden: Number(datos.orden) || 99,
    creadaEn: serverTimestamp(),
    creadaPor: uidAutor || null
  });
  return nueva.key;
}

export async function actualizar(id, datos) {
  await update(ref(db, `categorias/${id}`), {
    nombre: datos.nombre.trim(),
    color: datos.color || '#4DA9CE',
    activa: datos.activa !== false,
    orden: Number(datos.orden) || 99
  });
}

export async function eliminar(id) {
  await remove(ref(db, `categorias/${id}`));
}
