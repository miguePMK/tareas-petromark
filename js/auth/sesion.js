/* ==========================================================
   sesion.js - Autenticacion, perfil y arranque del sistema
   ========================================================== */

import {
  auth, db, ref, get, set, update, push,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, serverTimestamp
} from '../firebase.js';

import {
  ROL, SEMILLA_CUENCAS, SEMILLA_CATEGORIAS, VERSION
} from '../constantes.js';

/* ----------------------------------------------------------
   Estado del modulo
   ---------------------------------------------------------- */

let usuarioActual = null;      // { uid, email, nombre, rol, bases }
let observadorPausado = false; // evita render intermedio durante el bootstrap
let ultimoCallback = null;

export function obtenerUsuario() {
  return usuarioActual;
}

export function pausarObservador() { observadorPausado = true; }

export function reanudarObservador() {
  observadorPausado = false;
  if (ultimoCallback) ultimoCallback(usuarioActual);
}

/* ----------------------------------------------------------
   Sentinela de inicializacion
   /config/sistema es legible sin autenticacion: es la unica forma
   de saber si ya existe un administrador, porque las reglas de RTDB
   no permiten preguntar si una rama esta vacia.
   ---------------------------------------------------------- */

export async function sistemaInicializado() {
  const snap = await get(ref(db, 'config/sistema'));
  return snap.exists() && snap.val() && snap.val().inicializado === true;
}

/* ----------------------------------------------------------
   Observador de sesion
   ---------------------------------------------------------- */

/**
 * Escucha cambios de sesion y resuelve el perfil del usuario.
 * @param {function} callback recibe el perfil o null
 */
export function observarSesion(callback) {
  onAuthStateChanged(auth, async (cuenta) => {
    if (!cuenta) {
      usuarioActual = null;
      ultimoCallback = callback;
      if (!observadorPausado) callback(null);
      return;
    }

    let perfil = null;
    try {
      const snap = await get(ref(db, `usuarios/${cuenta.uid}`));
      if (snap.exists()) {
        perfil = { uid: cuenta.uid, email: cuenta.email, ...snap.val() };
      }
    } catch (error) {
      console.error('No se pudo leer el perfil del usuario', error);
    }

    if (!perfil) {
      usuarioActual = null;
      ultimoCallback = callback;
      if (!observadorPausado) callback(null, 'sin-perfil');
      if (!observadorPausado) await signOut(auth);
      return;
    }

    if (perfil.activo === false) {
      usuarioActual = null;
      ultimoCallback = callback;
      if (!observadorPausado) {
        callback(null, 'inactivo');
        await signOut(auth);
      }
      return;
    }

    usuarioActual = perfil;
    ultimoCallback = callback;

    // Marca de ultimo ingreso, sin bloquear el render
    update(ref(db, `usuarios/${cuenta.uid}`), { ultimoIngreso: serverTimestamp() })
      .catch(() => { /* sin permisos de escritura sobre si mismo: se ignora */ });

    if (!observadorPausado) callback(perfil);
  });
}

/* ----------------------------------------------------------
   Ingreso y salida
   ---------------------------------------------------------- */

export async function ingresar(email, clave) {
  await signInWithEmailAndPassword(auth, email.trim(), clave);
}

export async function salir() {
  usuarioActual = null;
  await signOut(auth);
}

/* ----------------------------------------------------------
   Bootstrap del primer administrador
   Orden obligatorio:
     1. crear la cuenta en Authentication
     2. escribir /usuarios/{uid} con rol admin  (las reglas lo permiten
        solo mientras el sentinela no existe)
     3. sembrar cuencas, bases y categorias     (ya requiere rol admin)
     4. sellar /config/sistema                  (cierra la puerta)
   ---------------------------------------------------------- */

export async function crearPrimerAdministrador(nombre, email, clave) {
  if (await sistemaInicializado()) {
    throw new Error('El sistema ya tiene un administrador creado.');
  }

  pausarObservador();
  try {
    const credencial = await createUserWithEmailAndPassword(auth, email.trim(), clave);
    const uid = credencial.user.uid;

    await set(ref(db, `usuarios/${uid}`), {
      nombre: nombre.trim(),
      email: email.trim().toLowerCase(),
      rol: ROL.ADMIN,
      bases: null,
      activo: true,
      creadoEn: serverTimestamp(),
      creadoPor: uid
    });

    await sembrarDatosIniciales(uid);

    await set(ref(db, 'config/sistema'), {
      inicializado: true,
      version: VERSION,
      inicializadoEn: serverTimestamp(),
      inicializadoPor: uid
    });

    usuarioActual = {
      uid,
      email: email.trim().toLowerCase(),
      nombre: nombre.trim(),
      rol: ROL.ADMIN,
      activo: true
    };
  } finally {
    reanudarObservador();
  }
}

/** Carga cuencas, bases y categorias por defecto. */
async function sembrarDatosIniciales(uid) {
  for (const cuenca of SEMILLA_CUENCAS) {
    const refCuenca = push(ref(db, 'cuencas'));
    await set(refCuenca, {
      codigo: cuenca.codigo,
      nombre: cuenca.nombre,
      orden: cuenca.orden
    });

    let orden = 1;
    for (const base of cuenca.bases) {
      const refBase = push(ref(db, 'bases'));
      await set(refBase, {
        cuencaId: refCuenca.key,
        codigo: base.codigo,
        nombre: base.nombre,
        activa: true,
        orden: orden++,
        creadaEn: serverTimestamp(),
        creadaPor: uid
      });
    }
  }

  let ordenCat = 1;
  for (const categoria of SEMILLA_CATEGORIAS) {
    const refCat = push(ref(db, 'categorias'));
    await set(refCat, {
      nombre: categoria.nombre,
      color: categoria.color,
      activa: true,
      orden: ordenCat++,
      creadaEn: serverTimestamp(),
      creadaPor: uid
    });
  }
}

/* ----------------------------------------------------------
   Permisos
   ---------------------------------------------------------- */

export function esAdmin(usuario = usuarioActual) {
  return !!usuario && usuario.rol === ROL.ADMIN;
}

export function esEditor(usuario = usuarioActual) {
  return !!usuario && usuario.rol === ROL.EDITOR;
}

export function esOperador(usuario = usuarioActual) {
  return !!usuario && usuario.rol === ROL.OPERADOR;
}

/** Admin y editor pueden crear, editar y borrar tareas. */
export function puedeGestionarTareas(usuario = usuarioActual) {
  return esAdmin(usuario) || esEditor(usuario);
}

/** Admin gestiona los catalogos (bases, usuarios, categorias). */
export function puedeAdministrar(usuario = usuarioActual) {
  return esAdmin(usuario);
}

/** El operador solo interviene en las tareas donde esta asignado. */
export function puedeIntervenirEnTarea(tarea, usuario = usuarioActual) {
  if (!tarea || !usuario) return false;
  if (puedeGestionarTareas(usuario)) return true;
  return !!(tarea.asignados && tarea.asignados[usuario.uid] === true);
}
