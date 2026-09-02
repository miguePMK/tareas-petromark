/* ==========================================================
   vistaUsuarios.js - ABM de usuarios y permisos (solo administrador)
   ========================================================== */

import { el, vaciar, ordenarPor, clavesActivas, rolPorId, fechaHora, haceCuanto, mensajeErrorAuth } from '../util.js';
import { ROLES, ROL, LARGO_MINIMO_CLAVE } from '../constantes.js';
import * as repoUsuarios from '../datos/repoUsuarios.js';

import {
  abrirModal, cerrarModal, campoTexto, campoSelector, campoCasillas,
  bloqueError, estadoVacio, chipTenue, confirmar, avisoOk, avisoError
} from './componentes.js';

export function montarVistaUsuarios(contenedor, ctx) {
  const { usuario, almacen } = ctx;

  const zonaTabla = el('div');

  contenedor.appendChild(
    el('div', {}, [
      el('div.cabecera-vista', {}, [
        el('div', {}, [
          el('h1', { texto: 'Usuarios y permisos' }),
          el('p.descripcion', { texto: 'Quien entra al sistema y que puede hacer.' })
        ]),
        el('div.acciones', {}, [
          el('button.btn.btn-primario', { texto: 'Nuevo usuario', on: { click: () => formUsuario(null) } })
        ])
      ]),
      el('div.panel', { estilo: { marginBottom: '14px' } }, [
        el('div.panel-titulo', {}, [el('h2', { texto: 'Que puede hacer cada rol' })]),
        el('dl.ficha', { estilo: { gridTemplateColumns: '124px 1fr' } },
          ROLES.flatMap(r => [
            el('dt', { texto: r.nombre }),
            el('dd', { texto: r.descripcion })
          ])
        )
      ]),
      zonaTabla
    ])
  );

  /* ---------- Formulario ---------- */

  function formUsuario(destino) {
    const esNuevo = !destino;

    const nombre = campoTexto({
      etiqueta: 'Nombre y apellido', nombre: 'nombre',
      valor: destino ? destino.nombre : '', requerido: true
    });

    const email = campoTexto({
      etiqueta: 'Correo', nombre: 'email', tipo: 'email',
      valor: destino ? destino.email : '',
      placeholder: 'nombre@petromark.com.ar',
      ayuda: esNuevo ? 'Es el usuario con el que va a ingresar.' : 'El correo no se puede cambiar desde aca.',
      requerido: true
    });
    if (!esNuevo) email.entrada.disabled = true;

    const clave = esNuevo
      ? campoTexto({
          etiqueta: 'Contrasena inicial', nombre: 'clave', tipo: 'password',
          autocomplete: 'new-password',
          ayuda: `Minimo ${LARGO_MINIMO_CLAVE} caracteres. Se la pasas a la persona para el primer ingreso.`,
          requerido: true
        })
      : null;

    const rol = campoSelector({
      etiqueta: 'Rol', nombre: 'rol',
      opciones: ROLES.map(r => ({ valor: r.id, texto: r.nombre })),
      valor: destino ? destino.rol : ROL.OPERADOR
    });

    const bases = campoCasillas({
      etiqueta: 'Bases asignadas',
      items: almacen.bases.map(b => ({
        valor: b.id,
        texto: `${b.codigo} - ${b.nombre}`,
        grupo: (almacen.cuencaPorId[b.cuencaId] || {}).codigo || ''
      })),
      seleccionados: destino ? clavesActivas(destino.bases) : [],
      ayuda: 'Limita en que bases puede crear y editar tareas. Si no marcas ninguna, puede trabajar en todas. Las tareas de las demas bases las sigue viendo: el recorte es para cargar, no para consultar.'
    });

    const activo = campoCasillas({
      etiqueta: 'Acceso',
      items: [{ valor: 'activo', texto: 'Puede ingresar al sistema' }],
      seleccionados: destino ? (destino.activo !== false ? ['activo'] : []) : ['activo']
    });

    const zonaError = el('div');
    const boton = el('button.btn.btn-primario', { texto: esNuevo ? 'Crear usuario' : 'Guardar cambios' });

    boton.addEventListener('click', async () => {
      vaciar(zonaError);

      if (!nombre.valor()) {
        zonaError.appendChild(bloqueError('Completa el nombre.'));
        return;
      }
      if (esNuevo) {
        if (!email.valor()) {
          zonaError.appendChild(bloqueError('Completa el correo.'));
          return;
        }
        if (clave.entrada.value.length < LARGO_MINIMO_CLAVE) {
          zonaError.appendChild(bloqueError(`La contrasena necesita al menos ${LARGO_MINIMO_CLAVE} caracteres.`));
          return;
        }
      }

      const datos = {
        nombre: nombre.valor(),
        email: email.valor(),
        clave: esNuevo ? clave.entrada.value : null,
        rol: rol.valor(),
        bases: bases.valor(),
        activo: activo.valor().includes('activo')
      };

      boton.disabled = true;
      boton.textContent = 'Guardando';
      try {
        if (esNuevo) {
          await repoUsuarios.crear(datos, usuario.uid);
          avisoOk('Usuario creado.');
        } else {
          await repoUsuarios.actualizar(destino.id, datos);
          avisoOk('Usuario actualizado.');
        }
        cerrarModal();
      } catch (error) {
        zonaError.appendChild(bloqueError(mensajeErrorAuth(error)));
        boton.disabled = false;
        boton.textContent = esNuevo ? 'Crear usuario' : 'Guardar cambios';
      }
    });

    abrirModal({
      titulo: esNuevo ? 'Nuevo usuario' : 'Editar usuario',
      ancho: true,
      cuerpo: el('div', {}, [
        zonaError,
        el('div.grilla-campos', {}, [nombre.nodo, email.nodo]),
        clave ? clave.nodo : null,
        rol.nodo,
        bases.nodo,
        activo.nodo
      ]),
      acciones: [el('button.btn', { texto: 'Cancelar', on: { click: cerrarModal } }), boton]
    });
  }

  /* ---------- Acciones ---------- */

  async function alternarAcceso(destino) {
    const desactivar = destino.activo !== false;
    if (desactivar && destino.id === usuario.uid) {
      avisoError('No podes quitarte el acceso a vos mismo.');
      return;
    }
    const ok = await confirmar({
      titulo: desactivar ? 'Quitar acceso' : 'Restablecer acceso',
      mensaje: desactivar
        ? `${destino.nombre} no va a poder ingresar. Sus tareas y avances se conservan.`
        : `${destino.nombre} vuelve a poder ingresar.`,
      textoOk: desactivar ? 'Quitar acceso' : 'Restablecer',
      peligro: desactivar
    });
    if (!ok) return;
    try {
      await repoUsuarios.cambiarActivo(destino.id, !desactivar);
      avisoOk(desactivar ? 'Acceso quitado.' : 'Acceso restablecido.');
    } catch (error) {
      avisoError(mensajeErrorAuth(error));
    }
  }

  async function restablecerClave(destino) {
    const ok = await confirmar({
      titulo: 'Restablecer contrasena',
      mensaje: `Se envia un correo a ${destino.email} con el enlace para definir una contrasena nueva.`,
      textoOk: 'Enviar correo'
    });
    if (!ok) return;
    try {
      await repoUsuarios.enviarRestablecimiento(destino.email);
      avisoOk('Correo enviado.');
    } catch (error) {
      avisoError(mensajeErrorAuth(error));
    }
  }

  /* ---------- Dibujo ---------- */

  function redibujar() {
    vaciar(zonaTabla);

    if (!almacen.usuarios.length) {
      zonaTabla.appendChild(
        el('div.tabla-marco', {}, [estadoVacio('No hay usuarios', 'Crea el primero con el boton Nuevo usuario.')])
      );
      return;
    }

    const cuerpo = el('tbody');
    const lista = ordenarPor(almacen.usuarios, u => u.rol, u => u.nombre);

    for (const destino of lista) {
      const basesAsignadas = clavesActivas(destino.bases)
        .map(id => (almacen.basePorId[id] || {}).codigo)
        .filter(Boolean);

      cuerpo.appendChild(
        el('tr', { clase: destino.activo === false ? 'inactivo' : '' }, [
          el('td', {}, [
            el('div.principal', { texto: destino.nombre }),
            el('div.secundario', { texto: destino.email })
          ]),
          el('td', {}, [chipTenue(rolPorId(destino.rol).nombre)]),
          el('td', {}, [
            el('div.asignados', {},
              basesAsignadas.length
                ? basesAsignadas.map(c => el('span.codigo-base', { texto: c }))
                : [el('span.secundario', { texto: 'Sin bases' })]
            )
          ]),
          el('td', {}, [chipTenue(destino.activo === false ? 'Sin acceso' : 'Activo')]),
          el('td', {}, [
            el('span.secundario', {
              texto: destino.ultimoIngreso ? haceCuanto(destino.ultimoIngreso) : 'Nunca ingreso',
              title: destino.ultimoIngreso ? fechaHora(destino.ultimoIngreso) : ''
            })
          ]),
          el('td.col-acciones', {}, [
            el('button.btn.btn-chico', { texto: 'Editar', on: { click: () => formUsuario(destino) } }),
            el('button.btn.btn-chico', {
              texto: 'Contrasena',
              estilo: { marginLeft: '6px' },
              on: { click: () => restablecerClave(destino) }
            }),
            el('button.btn.btn-chico', {
              clase: destino.activo === false ? '' : 'btn-peligro',
              texto: destino.activo === false ? 'Reactivar' : 'Quitar acceso',
              estilo: { marginLeft: '6px' },
              on: { click: () => alternarAcceso(destino) }
            })
          ])
        ])
      );
    }

    zonaTabla.appendChild(
      el('div.tabla-marco', {}, [
        el('table.tabla', {}, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', { texto: 'Usuario' }),
              el('th', { texto: 'Rol' }),
              el('th', { texto: 'Bases' }),
              el('th', { texto: 'Acceso' }),
              el('th', { texto: 'Ultimo ingreso' }),
              el('th', { texto: '' })
            ])
          ]),
          cuerpo
        ])
      ])
    );
  }

  redibujar();
  return { actualizar: redibujar, desmontar: () => {} };
}
