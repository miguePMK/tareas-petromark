/* ==========================================================
   util.js - Utilidades compartidas, sin dependencias de UI
   ========================================================== */

import { ESTADOS, PRIORIDADES, ROLES, DIAS_AVISO_VENCIMIENTO } from './constantes.js';

/* ----------------------------------------------------------
   Creacion de elementos
   ---------------------------------------------------------- */

/**
 * Crea un elemento del DOM.
 * @param {string} etiqueta  nombre de la etiqueta, admite "div.clase.otra"
 * @param {object} props     atributos: clase, texto, html, valor, dataset, on, y cualquier atributo
 * @param {Array}  hijos     nodos hijos
 */
export function el(etiqueta, props = {}, hijos = []) {
  const partes = etiqueta.split('.');
  const nodo = document.createElement(partes[0]);
  if (partes.length > 1) nodo.className = partes.slice(1).join(' ');

  for (const [clave, valor] of Object.entries(props)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (clave === 'clase') nodo.className = [nodo.className, valor].filter(Boolean).join(' ');
    else if (clave === 'texto') nodo.textContent = valor;
    else if (clave === 'html') nodo.innerHTML = valor;
    else if (clave === 'valor') nodo.value = valor;
    else if (clave === 'dataset') Object.assign(nodo.dataset, valor);
    else if (clave === 'estilo') Object.assign(nodo.style, valor);
    else if (clave === 'on') for (const [ev, fn] of Object.entries(valor)) nodo.addEventListener(ev, fn);
    else if (clave === 'checked' || clave === 'disabled' || clave === 'hidden' || clave === 'selected') nodo[clave] = !!valor;
    else nodo.setAttribute(clave, valor);
  }

  for (const hijo of [].concat(hijos)) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    nodo.appendChild(typeof hijo === 'string' ? document.createTextNode(hijo) : hijo);
  }
  return nodo;
}

export function vaciar(nodo) {
  while (nodo && nodo.firstChild) nodo.removeChild(nodo.firstChild);
  return nodo;
}

/* ----------------------------------------------------------
   Catalogos
   ---------------------------------------------------------- */

export function estadoPorId(id) {
  return ESTADOS.find(e => e.id === id) || { id, nombre: id || 'Sin estado', color: '#7C8894', abierto: true };
}

export function prioridadPorId(id) {
  return PRIORIDADES.find(p => p.id === id) || { id, nombre: id || 'Sin prioridad', color: '#7C8894', peso: 0 };
}

export function rolPorId(id) {
  return ROLES.find(r => r.id === id) || { id, nombre: id || 'Sin rol', descripcion: '' };
}

/* ----------------------------------------------------------
   Objetos y colecciones
   ---------------------------------------------------------- */

/** Convierte un snapshot de RTDB (objeto de objetos) en un array con id incluido. */
export function aLista(objeto) {
  if (!objeto) return [];
  return Object.entries(objeto).map(([id, valor]) => ({ id, ...valor }));
}

/** Devuelve las claves de un mapa { clave: true } */
export function clavesActivas(mapa) {
  if (!mapa) return [];
  return Object.keys(mapa).filter(k => mapa[k] === true);
}

/** Convierte un array de ids en un mapa { id: true } */
export function aMapa(ids) {
  const mapa = {};
  for (const id of ids || []) mapa[id] = true;
  return Object.keys(mapa).length ? mapa : null;
}

export function ordenarPor(lista, ...selectores) {
  return [...lista].sort((a, b) => {
    for (const sel of selectores) {
      const va = sel(a);
      const vb = sel(b);
      if (va === vb) continue;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      return va > vb ? 1 : -1;
    }
    return 0;
  });
}

/** Comparacion de texto insensible a acentos y mayusculas. */
export function normalizar(texto) {
  return (texto || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function contiene(texto, busqueda) {
  if (!busqueda) return true;
  return normalizar(texto).includes(normalizar(busqueda));
}

export function debounce(fn, ms = 250) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/* ----------------------------------------------------------
   Fechas
   ---------------------------------------------------------- */

export function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

function dos(n) { return String(n).padStart(2, '0'); }

/** "2026-09-01" -> "01/09/2026" */
export function fechaCorta(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** marca de tiempo (ms) -> "01/09/2026 14:32" */
export function fechaHora(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/** Descripcion relativa breve: "hace 5 min", "ayer", "12/08" */
export function haceCuanto(ms) {
  if (!ms) return '';
  const seg = Math.floor((Date.now() - ms) / 1000);
  if (seg < 60) return 'ahora';
  if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `hace ${Math.floor(seg / 3600)} h`;
  if (seg < 172800) return 'ayer';
  if (seg < 604800) return `hace ${Math.floor(seg / 86400)} dias`;
  return fechaHora(ms).split(' ')[0];
}

/** Dias hasta la fecha ISO. Negativo = vencida. */
export function diasHasta(iso) {
  if (!iso) return null;
  const hoy = new Date(hoyISO() + 'T00:00:00');
  const objetivo = new Date(iso + 'T00:00:00');
  return Math.round((objetivo - hoy) / 86400000);
}

/** Clase CSS segun cercania del vencimiento. */
export function claseVencimiento(iso, estadoAbierto = true) {
  if (!iso || !estadoAbierto) return '';
  const d = diasHasta(iso);
  if (d === null) return '';
  if (d < 0) return 'vencida';
  if (d <= DIAS_AVISO_VENCIMIENTO) return 'hoy';
  return '';
}

/** Texto legible del vencimiento. */
export function textoVencimiento(iso) {
  if (!iso) return 'Sin vencimiento';
  const d = diasHasta(iso);
  if (d === 0) return `${fechaCorta(iso)} (hoy)`;
  if (d === 1) return `${fechaCorta(iso)} (manana)`;
  if (d < 0) return `${fechaCorta(iso)} (vencida ${Math.abs(d)} d)`;
  return fechaCorta(iso);
}

/* ----------------------------------------------------------
   Varios
   ---------------------------------------------------------- */

export function iniciales(nombre) {
  const partes = normalizar(nombre).split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function recortar(texto, largo = 90) {
  const t = (texto || '').trim();
  return t.length > largo ? t.slice(0, largo - 1) + '\u2026' : t;
}

/** Traduce codigos de error de Firebase Auth a texto claro en castellano. */
export function mensajeErrorAuth(error) {
  const codigo = (error && error.code) || '';
  const mapa = {
    'auth/invalid-email': 'El correo no tiene un formato valido.',
    'auth/user-disabled': 'Ese usuario esta deshabilitado.',
    'auth/user-not-found': 'No existe un usuario con ese correo.',
    'auth/wrong-password': 'La contrasena no es correcta.',
    'auth/invalid-credential': 'El correo o la contrasena no son correctos.',
    'auth/invalid-login-credentials': 'El correo o la contrasena no son correctos.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos antes de volver a probar.',
    'auth/email-already-in-use': 'Ese correo ya tiene un usuario creado.',
    'auth/weak-password': 'La contrasena es demasiado corta.',
    'auth/network-request-failed': 'No hay conexion con el servidor.',
    'auth/operation-not-allowed': 'El ingreso con correo y contrasena no esta habilitado en Firebase.',
    'auth/unauthorized-domain': 'Este dominio no esta autorizado en Firebase Authentication.',
    'PERMISSION_DENIED': 'La base de datos rechazo la operacion por falta de permisos.'
  };
  if (mapa[codigo]) return mapa[codigo];
  const msg = (error && error.message) || 'Error inesperado.';
  if (msg.includes('PERMISSION_DENIED')) return mapa.PERMISSION_DENIED;
  return msg.replace('Firebase: ', '');
}
