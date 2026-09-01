/* ==========================================================
   repoBases.js - Cuencas y bases operativas
   Interfaz async: si mas adelante se migra a Firestore,
   las vistas no cambian.
   ========================================================== */

import { db, ref, get, set, update, remove, push, onValue, serverTimestamp } from '../firebase.js';
import { aLista, ordenarPor } from '../util.js';

/* ---------- Cuencas ---------- */

export async function listarCuencas() {
  const snap = await get(ref(db, 'cuencas'));
  return ordenarPor(aLista(snap.val()), c => c.orden ?? 99, c => c.nombre);
}

export function escucharCuencas(callback) {
  return onValue(ref(db, 'cuencas'), snap => {
    callback(ordenarPor(aLista(snap.val()), c => c.orden ?? 99, c => c.nombre));
  });
}

export async function crearCuenca(datos) {
  const nueva = push(ref(db, 'cuencas'));
  await set(nueva, {
    codigo: datos.codigo.trim(),
    nombre: datos.nombre.trim(),
    orden: Number(datos.orden) || 99
  });
  return nueva.key;
}

export async function actualizarCuenca(id, datos) {
  await update(ref(db, `cuencas/${id}`), {
    codigo: datos.codigo.trim(),
    nombre: datos.nombre.trim(),
    orden: Number(datos.orden) || 99
  });
}

export async function eliminarCuenca(id) {
  await remove(ref(db, `cuencas/${id}`));
}

/* ---------- Bases ---------- */

export async function listarBases() {
  const snap = await get(ref(db, 'bases'));
  return ordenarPor(aLista(snap.val()), b => b.orden ?? 99, b => b.nombre);
}

export function escucharBases(callback) {
  return onValue(ref(db, 'bases'), snap => {
    callback(ordenarPor(aLista(snap.val()), b => b.orden ?? 99, b => b.nombre));
  });
}

export async function obtenerBase(id) {
  const snap = await get(ref(db, `bases/${id}`));
  return snap.exists() ? { id, ...snap.val() } : null;
}

export async function crearBase(datos, uidAutor) {
  const nueva = push(ref(db, 'bases'));
  await set(nueva, {
    cuencaId: datos.cuencaId,
    codigo: datos.codigo.trim(),
    nombre: datos.nombre.trim(),
    activa: datos.activa !== false,
    orden: Number(datos.orden) || 99,
    creadaEn: serverTimestamp(),
    creadaPor: uidAutor || null
  });
  return nueva.key;
}

export async function actualizarBase(id, datos) {
  await update(ref(db, `bases/${id}`), {
    cuencaId: datos.cuencaId,
    codigo: datos.codigo.trim(),
    nombre: datos.nombre.trim(),
    activa: datos.activa !== false,
    orden: Number(datos.orden) || 99
  });
}

export async function eliminarBase(id) {
  await remove(ref(db, `bases/${id}`));
}
