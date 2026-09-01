/* ==========================================================
   repoAvances.js - Bitacora de avances de cada tarea
   Los avances son de solo alta: nadie los edita ni los borra,
   asi la traza de auditoria queda intacta.
   ========================================================== */

import { db, ref, get, set, push, onValue, serverTimestamp } from '../firebase.js';
import { aLista, ordenarPor } from '../util.js';

export async function listar(tareaId) {
  const snap = await get(ref(db, `avances/${tareaId}`));
  return ordenarPor(aLista(snap.val()), a => a.creadaEn || 0);
}

export function escuchar(tareaId, callback) {
  return onValue(ref(db, `avances/${tareaId}`), snap => {
    callback(ordenarPor(aLista(snap.val()), a => a.creadaEn || 0));
  });
}

/**
 * Agrega un avance.
 * @param {string} tareaId
 * @param {object} datos { texto, estadoAnterior, estadoNuevo }
 * @param {object} usuario perfil del autor
 */
export async function agregar(tareaId, datos, usuario) {
  const nuevo = push(ref(db, `avances/${tareaId}`));
  await set(nuevo, {
    autorUid: usuario.uid,
    autorNombre: usuario.nombre || usuario.email,
    texto: (datos.texto || '').trim(),
    estadoAnterior: datos.estadoAnterior || null,
    estadoNuevo: datos.estadoNuevo || null,
    creadaEn: serverTimestamp()
  });
  return nuevo.key;
}

/** Cantidad de avances por tarea, para mostrar en el listado. */
export async function contarPorTarea() {
  const snap = await get(ref(db, 'avances'));
  const conteo = {};
  const datos = snap.val() || {};
  for (const [tareaId, avances] of Object.entries(datos)) {
    conteo[tareaId] = Object.keys(avances || {}).length;
  }
  return conteo;
}
