/* ==========================================================
   firebase.js - Inicializacion del SDK y punto unico de acceso
   Todos los modulos importan Firebase desde aca, nunca del CDN.
   Version del SDK: 10.12.5 (si se actualiza, cambiar las tres URLs).
   ========================================================== */

import { CONFIG_FIREBASE } from './constantes.js';

import { initializeApp, getApp, getApps, deleteApp }
  from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';

import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';

import {
  getDatabase, ref, child, get, set, update, remove, push,
  onValue, query, orderByChild, equalTo, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js';

/* ---------- Aplicacion principal ---------- */
export const app = getApps().length ? getApp() : initializeApp(CONFIG_FIREBASE);
export const auth = getAuth(app);
export const db = getDatabase(app);

/**
 * Aplicacion secundaria, usada exclusivamente para crear usuarios.
 * createUserWithEmailAndPassword deja logueada a la cuenta recien creada,
 * asi que corre en una instancia aparte para no expulsar al administrador.
 */
const NOMBRE_APP_SECUNDARIA = 'petromark-secundaria';

export function abrirAppSecundaria() {
  const existente = getApps().find(a => a.name === NOMBRE_APP_SECUNDARIA);
  const instancia = existente || initializeApp(CONFIG_FIREBASE, NOMBRE_APP_SECUNDARIA);
  return { instancia, auth: getAuth(instancia) };
}

export async function cerrarAppSecundaria() {
  const existente = getApps().find(a => a.name === NOMBRE_APP_SECUNDARIA);
  if (!existente) return;
  try { await signOut(getAuth(existente)); } catch (e) { /* no habia sesion */ }
  try { await deleteApp(existente); } catch (e) { /* ya estaba eliminada */ }
}

/* ---------- Re-export del SDK ---------- */
export {
  ref, child, get, set, update, remove, push,
  onValue, query, orderByChild, equalTo, serverTimestamp,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, updatePassword, sendPasswordResetEmail
};
