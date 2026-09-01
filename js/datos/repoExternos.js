/* ==========================================================
   repoExternos.js - Responsables externos (contratistas)
   No son cuentas: no inician sesion ni tienen permisos.
   Son datos descriptivos de quien ejecuta el trabajo.
   ========================================================== */

import { db, ref, get, set, update, remove, push, onValue, serverTimestamp } from '../firebase.js';
import { aLista, ordenarPor } from '../util.js';

export async function listar() {
  const snap = await get(ref(db, 'externos'));
  return ordenarPor(aLista(snap.val()), e => e.nombre);
}

export function escuchar(callback) {
  return onValue(ref(db, 'externos'), snap => {
    callback(ordenarPor(aLista(snap.val()), e => e.nombre));
  });
}

export async function obtener(id) {
  const snap = await get(ref(db, `externos/${id}`));
  return snap.exists() ? { id, ...snap.val() } : null;
}

export async function crear(datos, uidAutor) {
  const nuevo = push(ref(db, 'externos'));
  await set(nuevo, {
    nombre: datos.nombre.trim(),
    empresa: (datos.empresa || '').trim() || null,
    contacto: (datos.contacto || '').trim() || null,
    activo: datos.activo !== false,
    creadoEn: serverTimestamp(),
    creadoPor: uidAutor || null
  });
  return nuevo.key;
}

export async function actualizar(id, datos) {
  await update(ref(db, `externos/${id}`), {
    nombre: datos.nombre.trim(),
    empresa: (datos.empresa || '').trim() || null,
    contacto: (datos.contacto || '').trim() || null,
    activo: datos.activo !== false
  });
}

export async function eliminar(id) {
  await remove(ref(db, `externos/${id}`));
}
