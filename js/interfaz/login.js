/* ==========================================================
   login.js - Pantalla de ingreso y alta del primer administrador
   ========================================================== */

import { el, vaciar, mensajeErrorAuth } from '../util.js';
import { NOMBRE_SISTEMA, NOMBRE_EMPRESA, VERSION, LARGO_MINIMO_CLAVE } from '../constantes.js';
import { ingresar, crearPrimerAdministrador } from '../auth/sesion.js';
import { campoTexto, bloqueError, avisoOk } from './componentes.js';

/* ---------- Marca comun ---------- */
function marca(subtitulo) {
  return el('div.marca', {}, [
    el('img', { src: 'assets/logo.png', alt: NOMBRE_EMPRESA, width: 58, height: 58 }),
    el('span.titulo', { texto: NOMBRE_SISTEMA }),
    el('span.sub', { texto: subtitulo })
  ]);
}

/* ==========================================================
   Ingreso
   ========================================================== */

export function montarIngreso(contenedor) {
  vaciar(contenedor);

  const email = campoTexto({
    etiqueta: 'Correo',
    nombre: 'email',
    tipo: 'email',
    placeholder: 'nombre@petromark.com.ar',
    autocomplete: 'username',
    requerido: true
  });

  const clave = campoTexto({
    etiqueta: 'Contrasena',
    nombre: 'clave',
    tipo: 'password',
    autocomplete: 'current-password',
    requerido: true
  });

  const zonaError = el('div');
  const boton = el('button.btn.btn-primario', { texto: 'Ingresar', type: 'submit' });

  const formulario = el('form', {
    on: {
      submit: async (ev) => {
        ev.preventDefault();
        vaciar(zonaError);
        if (!email.valor() || !clave.valor()) {
          zonaError.appendChild(bloqueError('Completa el correo y la contrasena.'));
          return;
        }
        boton.disabled = true;
        boton.textContent = 'Verificando';
        try {
          await ingresar(email.valor(), clave.entrada.value);
          // El observador de sesion se encarga de mostrar la aplicacion
        } catch (error) {
          zonaError.appendChild(bloqueError(mensajeErrorAuth(error)));
          boton.disabled = false;
          boton.textContent = 'Ingresar';
          clave.entrada.value = '';
          clave.entrada.focus();
        }
      }
    }
  }, [zonaError, email.nodo, clave.nodo, boton]);

  contenedor.appendChild(
    el('div.pantalla-ingreso', {}, [
      el('div.caja-ingreso', {}, [
        marca(NOMBRE_EMPRESA),
        formulario,
        el('p.pie', { texto: `Version ${VERSION}` })
      ])
    ])
  );
}

/* ==========================================================
   Alta del primer administrador
   Se muestra solo mientras /config/sistema no existe.
   ========================================================== */

export function montarBootstrap(contenedor, datosSugeridos = {}) {
  vaciar(contenedor);

  const nombre = campoTexto({
    etiqueta: 'Nombre y apellido',
    nombre: 'nombre',
    valor: datosSugeridos.nombre || '',
    requerido: true
  });

  const email = campoTexto({
    etiqueta: 'Correo',
    nombre: 'email',
    tipo: 'email',
    valor: datosSugeridos.email || '',
    autocomplete: 'username',
    requerido: true
  });

  const clave = campoTexto({
    etiqueta: 'Contrasena',
    nombre: 'clave',
    tipo: 'password',
    autocomplete: 'new-password',
    ayuda: `Minimo ${LARGO_MINIMO_CLAVE} caracteres.`,
    requerido: true
  });

  const repetir = campoTexto({
    etiqueta: 'Repetir contrasena',
    nombre: 'repetir',
    tipo: 'password',
    autocomplete: 'new-password',
    requerido: true
  });

  const zonaError = el('div');
  const boton = el('button.btn.btn-primario', { texto: 'Crear administrador', type: 'submit' });

  const formulario = el('form', {
    on: {
      submit: async (ev) => {
        ev.preventDefault();
        vaciar(zonaError);

        if (!nombre.valor() || !email.valor()) {
          zonaError.appendChild(bloqueError('Completa el nombre y el correo.'));
          return;
        }
        if (clave.entrada.value.length < LARGO_MINIMO_CLAVE) {
          zonaError.appendChild(bloqueError(`La contrasena necesita al menos ${LARGO_MINIMO_CLAVE} caracteres.`));
          return;
        }
        if (clave.entrada.value !== repetir.entrada.value) {
          zonaError.appendChild(bloqueError('Las dos contrasenas no coinciden.'));
          return;
        }

        boton.disabled = true;
        boton.textContent = 'Creando y cargando bases';
        try {
          await crearPrimerAdministrador(nombre.valor(), email.valor(), clave.entrada.value);
          avisoOk('Administrador creado. Cuencas, bases y categorias cargadas.');
        } catch (error) {
          zonaError.appendChild(bloqueError(mensajeErrorAuth(error)));
          boton.disabled = false;
          boton.textContent = 'Crear administrador';
        }
      }
    }
  }, [zonaError, nombre.nodo, email.nodo, clave.nodo, repetir.nodo, boton]);

  contenedor.appendChild(
    el('div.pantalla-ingreso', {}, [
      el('div.caja-ingreso', {}, [
        marca('Primer arranque'),
        el('div.nota', {
          texto: 'No hay ningun usuario todavia. La cuenta que crees ahora queda como administrador y el sistema carga las cuencas, bases y categorias iniciales. Esta pantalla no vuelve a aparecer.'
        }),
        formulario,
        el('p.pie', { texto: `Version ${VERSION}` })
      ])
    ])
  );
}
