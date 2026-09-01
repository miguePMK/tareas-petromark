/* ==========================================================
   main.js - Punto de entrada
   ========================================================== */

import { el, vaciar } from './util.js';
import { NOMBRE_SISTEMA, NOMBRE_EMPRESA, URL_BASE_DATOS, VERSION } from './constantes.js';
import { observarSesion, sistemaInicializado } from './auth/sesion.js';
import { montarIngreso, montarBootstrap } from './interfaz/login.js';
import { montarLayout } from './interfaz/layout.js';
import { avisoError, bloqueError } from './interfaz/componentes.js';

const nodoApp = document.getElementById('app');
const nodoCarga = document.getElementById('pantalla-carga');

/** Milisegundos que se espera la primera respuesta de la base antes de avisar. */
const LIMITE_ARRANQUE_MS = 12000;

/** Datos sugeridos para el formulario de primer arranque. */
const PRIMER_ADMIN_SUGERIDO = {
  nombre: 'Miguel Lopez',
  email: 'miguel.lopez@petromark.com.ar'
};

function mostrarApp() {
  nodoCarga.hidden = true;
  nodoApp.hidden = false;
}

/**
 * Corta una promesa que no responde.
 * Si la URL de la base es incorrecta, el SDK de Firebase reintenta sin
 * resolver ni rechazar: sin esto el sitio queda colgado en la carga.
 */
function conTiempoLimite(promesa, ms, mensaje) {
  let reloj;
  const limite = new Promise((_, rechazar) => {
    reloj = setTimeout(() => rechazar(new Error(mensaje)), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(reloj));
}

function pantallaFalla(mensaje, detalle) {
  vaciar(nodoApp);
  nodoApp.appendChild(
    el('div.pantalla-ingreso', {}, [
      el('div.caja-ingreso', {}, [
        el('div.marca', {}, [
          el('img', { src: 'assets/logo.png', alt: NOMBRE_EMPRESA, width: 58, height: 58 }),
          el('span.titulo', { texto: NOMBRE_SISTEMA }),
          el('span.sub', { texto: 'No se pudo iniciar' })
        ]),
        bloqueError(mensaje),
        el('dl.ficha', { estilo: { gridTemplateColumns: '78px 1fr', marginBottom: '14px' } }, [
          el('dt', { texto: 'Base' }),
          el('dd', {
            texto: URL_BASE_DATOS,
            estilo: { wordBreak: 'break-all', fontSize: '11.5px', fontFamily: 'var(--fuente-mono)' }
          }),
          detalle ? el('dt', { texto: 'Detalle' }) : null,
          detalle ? el('dd', { texto: detalle, estilo: { fontSize: '11.5px' } }) : null
        ]),
        el('p', {
          texto: 'Revisa que la Realtime Database exista en la consola de Firebase y que la URL de arriba coincida exactamente con la que figura sobre el arbol de datos. Se configura en js/constantes.js.',
          estilo: { color: 'var(--texto-tenue)', fontSize: '12.5px', margin: 0 }
        }),
        el('div', { estilo: { marginTop: '16px' } }, [
          el('button.btn', {
            texto: 'Volver a intentar',
            on: { click: () => window.location.reload() }
          })
        ]),
        el('p.pie', { texto: `Version ${VERSION}` })
      ])
    ])
  );
  mostrarApp();
}

async function arrancar() {
  let inicializado;

  try {
    inicializado = await conTiempoLimite(
      sistemaInicializado(),
      LIMITE_ARRANQUE_MS,
      'La base de datos no respondio en 12 segundos.'
    );
  } catch (error) {
    console.error('Falla al consultar /config/sistema', error);
    pantallaFalla(
      'No hubo respuesta de la base de datos.',
      error && error.message ? error.message : String(error)
    );
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
      try {
        hayAdmin = await conTiempoLimite(sistemaInicializado(), LIMITE_ARRANQUE_MS, 'Sin respuesta de la base.');
      } catch (e) {
        hayAdmin = false;
      }
    }

    if (hayAdmin) montarIngreso(nodoApp);
    else montarBootstrap(nodoApp, PRIMER_ADMIN_SUGERIDO);

    mostrarApp();
  });
}

window.addEventListener('unhandledrejection', (ev) => {
  console.error('Promesa rechazada sin capturar', ev.reason);
});

arrancar();
