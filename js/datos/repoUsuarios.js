/* ==========================================================
   repoUsuarios.js - Usuarios, roles y bases asignadas
   ========================================================== */

import {
  db, ref, get, set, update, remove, onValue, serverTimestamp,
  abrirAppSecundaria, cerrarAppSecundaria,
  createUserWithEmailAndPassword, sendPasswordResetEmail, auth
} from '../firebase.js';

import { aLista, ordenarPor, aMapa } from '../util.js';
import { ROL } from '../constantes.js';

export async function listar() {
  const snap = await get(ref(db, 'usuarios'));
  return ordenarPor(aLista(snap.val()), u => u.nombre);
}

export function escuchar(callback) {
  return onValue(ref(db, 'usuarios'), snap => {
    callback(ordenarPor(aLista(snap.val()), u => u.nombre));
  });
}

export async function obtener(uid) {
  const snap = await get(ref(db, `usuarios/${uid}`));
  return snap.exists() ? { id: uid, uid, ...snap.val() } : null;
}

/**
 * Crea la cuenta en Authentication y el perfil en la base.
 * Se usa una instancia secundaria de Firebase para que el alta
 * no reemplace la sesion del administrador que la ejecuta.
 */
export async function crear(datos, uidAutor) {
  const { auth: authSecundaria } = abrirAppSecundaria();
  try {
    const credencial = await createUserWithEmailAndPassword(
      authSecundaria,
      datos.email.trim(),
      datos.clave
    );
    const uid = credencial.user.uid;

    await set(ref(db, `usuarios/${uid}`), {
      nombre: datos.nombre.trim(),
      email: datos.email.trim().toLowerCase(),
      rol: datos.rol || ROL.OPERADOR,
      bases: aMapa(datos.bases),
      activo: true,
      creadoEn: serverTimestamp(),
      creadoPor: uidAutor || null
    });

    return uid;
  } finally {
    await cerrarAppSecundaria();
  }
}

/** Actualiza nombre, rol, bases y estado. El correo no se puede cambiar. */
export async function actualizar(uid, datos) {
  await update(ref(db, `usuarios/${uid}`), {
    nombre: datos.nombre.trim(),
    rol: datos.rol,
    bases: aMapa(datos.bases),
    activo: datos.activo !== false
  });
}

export async function cambiarActivo(uid, activo) {
  await update(ref(db, `usuarios/${uid}`), { activo: !!activo });
}

/**
 * Borra el perfil de la base. La cuenta en Authentication no se puede
 * eliminar desde el navegador: eso se hace en la consola de Firebase.
 * Para quitarle el acceso alcanza con desactivarlo.
 */
export async function eliminarPerfil(uid) {
  await remove(ref(db, `usuarios/${uid}`));
}

/** Envia el correo de restablecimiento de contrasena. */
export async function enviarRestablecimiento(email) {
  await sendPasswordResetEmail(auth, email.trim());
}

/** Diccionario { uid: usuario } para resolver nombres rapido. */
export function comoDiccionario(usuarios) {
  const dic = {};
  for (const u of usuarios || []) dic[u.id] = u;
  return dic;
}
