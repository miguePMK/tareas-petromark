/* ==========================================================
   main.js - Punto de entrada
   ========================================================== */

import { el, vaciar } from './util.js';
import { NOMBRE_SISTEMA, NOMBRE_EMPRESA } from './constantes.js';
import { observarSesion, sistemaInicializado } from './auth/sesion.js';
import { montarIngreso, montarBootstrap } from './interfaz/login.js';
import { montarLayout } from './interfaz/layout.js';
import { avisoError, bloqueError } from './interfaz/componentes.js';

const nodoApp = document.getElementById('app');
const nodoCarga = document.getElementById('pantalla-carga');

/** Datos sugeridos para el formulario de primer arranque. */
const PRIMER_ADMIN_SUGERIDO = {
  nombre: 'Miguel Lopez',
  email: 'miguel.lopez@petromark.com.ar'
};

function mostrarApp() {
  nodoCarga.hidden = true;
  nodoApp.hidden = false;
}

function pantallaFalla(mensaje) {
  vaciar(nodoApp);
  nodoApp.appendChild(
    el('div.pantalla-ingreso', {}, [
      el('div.caja-ingreso', {}, [
        el('div.marca', {}, [
          el('img', { src: 'assets/logo.png', alt: NOMBRE_EMPRESA, width: 58, height: 58 }),
          el('span.titulo', { texto: NOMBRE_SISTEMA })
        ]),
        bloqueError(mensaje),
        el('p', {
          texto: 'Revisa la configuracion de Firebase en js/constantes.js: la URL de la base de datos, el dominio autorizado en Authentication y las reglas publicadas.',
          estilo: { color: 'var(--texto-tenue)', fontSize: '12.5px', margin: 0 }
        })
      ])
    ])
  );
  mostrarApp();
}

async function arrancar() {
  let inicializado;
  try {
    inicializado = await sistemaInicializado();
  } catch (error) {
    console.error(error);
    pantallaFalla('No se pudo conectar con la base de datos.');
    return;
  }

  observarSesion(async (perfil, motivo) => {
    if (perfil) {
      montarLayout(nodoApp, perfil);
      mostrarApp();
      return;
    }

    if (motivo === 'inactivo') avisoError('Tu usuario no tiene acceso habilitado. Hablalo con el administrador.');
    if (motivo === 'sin-perfil') avisoError('La cuenta existe pero no tiene perfil cargado en el sistema.');

    let hayAdmin = inicializado;
    if (!hayAdmin) {
      try { hayAdmin = await sistemaInicializado(); } catch (e) { hayAdmin = false; }
    }

    if (hayAdmin) montarIngreso(nodoApp);
    else montarBootstrap(nodoApp, PRIMER_ADMIN_SUGERIDO);

    mostrarApp();
  });
}

arrancar();
