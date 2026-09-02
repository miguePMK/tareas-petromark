/* ==========================================================
   layout.js - Marco de la aplicacion, navegacion y almacen
   ========================================================== */

import { el, vaciar, rolPorId, iniciales, debounce, clavesActivas } from '../util.js';
import { NOMBRE_SISTEMA, NOMBRE_EMPRESA, VERSION, ROL, SECCIONES } from '../constantes.js';
import { salir, puedeAdministrar, puedeGestionarTareas } from '../auth/sesion.js';
import { avisoError, confirmar } from './componentes.js';

import * as repoBases from '../datos/repoBases.js';
import * as repoCategorias from '../datos/repoCategorias.js';
import * as repoUsuarios from '../datos/repoUsuarios.js';
import * as repoExternos from '../datos/repoExternos.js';

import { montarVistaTareas } from './vistaTareas.js';
import { montarVistaDetalle } from './vistaDetalle.js';
import { montarVistaBases } from './vistaBases.js';
import { montarVistaUsuarios } from './vistaUsuarios.js';
import { montarVistaCategorias } from './vistaCategorias.js';
import { montarVistaInformes } from './vistaInformes.js';
import { montarVistaExternos } from './vistaExternos.js';
import { montarVistaImportar } from './vistaImportar.js';

/* ----------------------------------------------------------
   Almacen de catalogos: se mantiene actualizado en vivo y lo
   comparten todas las vistas.
   ---------------------------------------------------------- */

const almacen = {
  cuencas: [],
  bases: [],
  categorias: [],
  usuarios: [],
  externos: [],
  cuencaPorId: {},
  basePorId: {},
  categoriaPorId: {},
  usuarioPorId: {},
  externoPorId: {},
  listo: false
};

function reindexar() {
  almacen.cuencaPorId = {};
  almacen.basePorId = {};
  almacen.categoriaPorId = {};
  almacen.usuarioPorId = {};
  almacen.externoPorId = {};
  for (const c of almacen.cuencas) almacen.cuencaPorId[c.id] = c;
  for (const b of almacen.bases) almacen.basePorId[b.id] = b;
  for (const c of almacen.categorias) almacen.categoriaPorId[c.id] = c;
  for (const u of almacen.usuarios) almacen.usuarioPorId[u.id] = u;
  for (const e of almacen.externos) almacen.externoPorId[e.id] = e;
}

/** Nombre legible de la base, con su cuenca. */
almacen.textoBase = function (baseId) {
  const base = almacen.basePorId[baseId];
  if (!base) return 'Base eliminada';
  return base.nombre;
};

almacen.textoCuencaDeBase = function (baseId) {
  const base = almacen.basePorId[baseId];
  if (!base) return '';
  const cuenca = almacen.cuencaPorId[base.cuencaId];
  return cuenca ? cuenca.codigo : '';
};

almacen.nombreExterno = function (id) {
  const e = almacen.externoPorId[id];
  if (!e) return 'Externo eliminado';
  return e.empresa && e.empresa !== e.nombre ? `${e.nombre} (${e.empresa})` : e.nombre;
};

almacen.externosActivos = function () {
  return almacen.externos.filter(e => e.activo !== false);
};

almacen.nombreUsuario = function (uid) {
  const u = almacen.usuarioPorId[uid];
  return u ? u.nombre : 'Usuario eliminado';
};

/** Opciones de base agrupadas por cuenca, para los selectores. */
almacen.opcionesBases = function (soloActivas = true) {
  return almacen.bases
    .filter(b => (soloActivas ? b.activa !== false : true))
    .map(b => ({
      valor: b.id,
      texto: `${b.codigo} - ${b.nombre}`,
      grupo: (almacen.cuencaPorId[b.cuencaId] || {}).nombre || 'Sin cuenca'
    }));
};

/**
 * Bases donde el usuario puede crear o editar tareas.
 *
 * El administrador siempre alcanza a todas. Para el resto manda el campo
 * "bases" de su perfil, con una salvedad deliberada: si no tiene ninguna
 * asignada, se interpreta como sin restriccion. De esa forma la limitacion
 * se activa recien cuando alguien le asigna bases, y los usuarios ya
 * cargados no quedan sin poder trabajar.
 */
almacen.basesPermitidas = function (usuario, soloActivas = true) {
  const disponibles = almacen.bases.filter(b => (soloActivas ? b.activa !== false : true));
  if (!usuario) return [];
  if (usuario.rol === ROL.ADMIN) return disponibles;

  const asignadas = clavesActivas(usuario.bases);
  if (!asignadas.length) return disponibles;
  return disponibles.filter(b => asignadas.includes(b.id));
};

/** True si el usuario tiene el alcance recortado a algunas bases. */
almacen.tieneBasesRecortadas = function (usuario) {
  if (!usuario || usuario.rol === ROL.ADMIN) return false;
  return clavesActivas(usuario.bases).length > 0;
};

/** Opciones para los selectores, ya filtradas por permiso. */
almacen.opcionesBasesPara = function (usuario, soloActivas = true) {
  return almacen.basesPermitidas(usuario, soloActivas).map(b => ({
    valor: b.id,
    texto: `${b.codigo} - ${b.nombre}`,
    grupo: (almacen.cuencaPorId[b.cuencaId] || {}).nombre || 'Sin cuenca'
  }));
};

almacen.operadores = function () {
  return almacen.usuarios.filter(u => u.activo !== false && u.rol === ROL.OPERADOR);
};

/**
 * Personas a las que se puede asignar el seguimiento de una tarea:
 * cualquier usuario activo, incluido el administrador. En equipos chicos
 * el admin suele ser tambien quien ejecuta y reporta.
 */
almacen.asignables = function () {
  return almacen.usuarios.filter(u => u.activo !== false);
};

/* ----------------------------------------------------------
   Estado de navegacion
   ---------------------------------------------------------- */

let vistaActual = null;      // { nombre, params, instancia }
let contenidoNodo = null;
let navNodo = null;
let desuscripciones = [];

const VISTAS = {
  tareas: { titulo: 'Tareas', montar: montarVistaTareas, admin: false },
  detalle: { titulo: 'Detalle de tarea', montar: montarVistaDetalle, admin: false, oculta: true },
  informes: { titulo: 'Informes', montar: montarVistaInformes, admin: false, gestion: true, seccion: 'informes' },
  bases: { titulo: 'Bases', montar: montarVistaBases, admin: true },
  usuarios: { titulo: 'Usuarios y permisos', montar: montarVistaUsuarios, admin: true },
  categorias: { titulo: 'Categorias', montar: montarVistaCategorias, admin: true },
  externos: { titulo: 'Externos', montar: montarVistaExternos, admin: true },
  importar: { titulo: 'Importar', montar: montarVistaImportar, admin: true }
};

/* ----------------------------------------------------------
   Montaje
   ---------------------------------------------------------- */

export function montarLayout(contenedor, usuario) {
  vaciar(contenedor);
  cortarSuscripciones();
  fijarUsuarioSesion(usuario);

  const rol = rolPorId(usuario.rol);

  navNodo = el('nav');

  const riel = el('aside.riel', {}, [
    el('div.riel-marca', {}, [
      el('img', { src: 'assets/logo.png', alt: NOMBRE_EMPRESA, width: 30, height: 30 }),
      el('div', {}, [
        el('div.nombre', { texto: 'Tareas' }),
        el('div.sub', { texto: NOMBRE_EMPRESA })
      ])
    ]),
    navNodo,
    el('div.riel-espacio'),
    el('div.riel-usuario', {}, [
      el('span.inicial', { texto: iniciales(usuario.nombre || usuario.email) }),
      el('div.datos', {}, [
        el('div.n', { texto: usuario.nombre || usuario.email, title: usuario.email || '' }),
        el('div.r', { texto: rol.nombre })
      ]),
      el('button.salir', {
        texto: 'Salir',
        title: 'Cerrar sesion',
        on: {
          click: async () => {
            const ok = await confirmar({
              titulo: 'Cerrar sesion',
              mensaje: 'Vas a salir del sistema.',
              textoOk: 'Cerrar sesion'
            });
            if (ok) {
              cortarSuscripciones();
              await salir();
            }
          }
        }
      })
    ]),
    el('div.version', { texto: `${NOMBRE_SISTEMA} v${VERSION}` })
  ]);

  contenidoNodo = el('main.contenido');

  contenedor.appendChild(el('div.marco', {}, [riel, contenidoNodo]));

  dibujarNav(usuario);
  iniciarAlmacen(usuario);
  ir('tareas');
}

function dibujarNav(usuario) {
  vaciar(navNodo);

  const agregar = (nombre) => {
    const def = VISTAS[nombre];
    navNodo.appendChild(el('button', {
      texto: def.titulo,
      dataset: { vista: nombre },
      on: { click: () => ir(nombre) }
    }));
  };

  agregar('tareas');
  if (puedeGestionarTareas(usuario) && SECCIONES.informes) agregar('informes');

  if (puedeAdministrar(usuario)) {
    navNodo.appendChild(el('div.separador', { texto: 'Administracion' }));
    agregar('bases');
    agregar('usuarios');
    agregar('categorias');
    agregar('externos');
    agregar('importar');
  }
}

function marcarNav(nombre) {
  if (!navNodo) return;
  for (const boton of navNodo.querySelectorAll('button[data-vista]')) {
    boton.classList.toggle('activo', boton.dataset.vista === nombre);
  }
}

/* ----------------------------------------------------------
   Suscripciones a los catalogos
   ---------------------------------------------------------- */

function iniciarAlmacen(usuario) {
  const refrescar = debounce(() => {
    reindexar();
    almacen.listo = true;
    if (vistaActual && vistaActual.instancia && vistaActual.instancia.actualizar) {
      try { vistaActual.instancia.actualizar(); } catch (e) { console.error(e); }
    }
  }, 60);

  desuscripciones.push(repoBases.escucharCuencas(lista => { almacen.cuencas = lista; refrescar(); }));
  desuscripciones.push(repoBases.escucharBases(lista => { almacen.bases = lista; refrescar(); }));
  desuscripciones.push(repoCategorias.escuchar(lista => { almacen.categorias = lista; refrescar(); }));
  desuscripciones.push(repoUsuarios.escuchar(lista => { almacen.usuarios = lista; refrescar(); }));
  desuscripciones.push(repoExternos.escuchar(lista => { almacen.externos = lista; refrescar(); }));

  void usuario;
}

function cortarSuscripciones() {
  for (const cortar of desuscripciones) {
    try { cortar(); } catch (e) { /* ya cortada */ }
  }
  desuscripciones = [];
  desmontarVista();
}

function desmontarVista() {
  if (vistaActual && vistaActual.instancia && vistaActual.instancia.desmontar) {
    try { vistaActual.instancia.desmontar(); } catch (e) { console.error(e); }
  }
  vistaActual = null;
}

/* ----------------------------------------------------------
   Ruteo
   ---------------------------------------------------------- */

export function ir(nombre, params = {}) {
  const def = VISTAS[nombre];
  if (!def) {
    avisoError(`La vista "${nombre}" no existe.`);
    return;
  }

  const usuario = ctxBase().usuario;
  if (def.admin && !puedeAdministrar(usuario)) {
    avisoError('No tenes permisos para esa seccion.');
    return;
  }
  if (def.gestion && !puedeGestionarTareas(usuario)) {
    avisoError('No tenes permisos para esa seccion.');
    return;
  }
  if (def.seccion && SECCIONES[def.seccion] === false) {
    avisoError('Esa seccion esta deshabilitada.');
    return;
  }

  desmontarVista();
  vaciar(contenidoNodo);
  marcarNav(def.oculta ? 'tareas' : nombre);

  const instancia = def.montar(contenidoNodo, { ...ctxBase(), params });
  vistaActual = { nombre, params, instancia: instancia || {} };
  window.scrollTo({ top: 0 });
}

let usuarioSesion = null;

export function fijarUsuarioSesion(usuario) {
  usuarioSesion = usuario;
}

function ctxBase() {
  return {
    usuario: usuarioSesion,
    almacen,
    ir,
    volverATareas: () => ir('tareas')
  };
}

export { almacen };
