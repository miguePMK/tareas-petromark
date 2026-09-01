/* ==========================================================
   componentes.js - Piezas de interfaz reutilizables
   Sin logica de negocio.
   ========================================================== */

import { el, vaciar, estadoPorId, prioridadPorId, iniciales } from '../util.js';
import { DURACION_AVISO_MS } from '../constantes.js';

/* ----------------------------------------------------------
   Avisos flotantes
   ---------------------------------------------------------- */

export function aviso(texto, tipo = '') {
  const capa = document.getElementById('capa-avisos');
  if (!capa) return;
  const nodo = el('div.aviso', { texto, clase: tipo ? `aviso-${tipo}` : '' });
  capa.appendChild(nodo);
  setTimeout(() => {
    nodo.style.opacity = '0';
    setTimeout(() => nodo.remove(), 200);
  }, DURACION_AVISO_MS);
}

export const avisoOk = (t) => aviso(t, 'ok');
export const avisoError = (t) => aviso(t, 'error');

/* ----------------------------------------------------------
   Modal
   ---------------------------------------------------------- */

let cerrarConEscape = null;

/**
 * Abre un modal.
 * @param {object} opciones { titulo, cuerpo(Node), acciones[Node], ancho }
 * @returns {function} funcion para cerrarlo
 */
export function abrirModal({ titulo, cuerpo, acciones = [], ancho = false }) {
  const capa = document.getElementById('capa-modal');
  vaciar(capa);
  capa.hidden = false;

  const cerrar = () => cerrarModal();

  const modal = el('div.modal', { clase: ancho ? 'ancho' : '' }, [
    el('div.modal-cabecera', {}, [
      el('h2', { texto: titulo }),
      el('button.btn.btn-plano.btn-icono', {
        texto: '\u2715',
        title: 'Cerrar',
        on: { click: cerrar }
      })
    ]),
    el('div.modal-cuerpo', {}, [cuerpo]),
    acciones.length ? el('div.modal-pie', {}, acciones) : null
  ]);

  capa.appendChild(modal);
  capa.onclick = (ev) => { if (ev.target === capa) cerrar(); };

  cerrarConEscape = (ev) => { if (ev.key === 'Escape') cerrar(); };
  document.addEventListener('keydown', cerrarConEscape);

  const primero = modal.querySelector('input, select, textarea, button');
  if (primero) setTimeout(() => primero.focus(), 30);

  return cerrar;
}

export function cerrarModal() {
  const capa = document.getElementById('capa-modal');
  vaciar(capa);
  capa.hidden = true;
  capa.onclick = null;
  if (cerrarConEscape) {
    document.removeEventListener('keydown', cerrarConEscape);
    cerrarConEscape = null;
  }
}

/** Confirmacion simple. Devuelve una promesa que resuelve a true o false. */
export function confirmar({ titulo = 'Confirmar', mensaje, textoOk = 'Confirmar', peligro = false }) {
  return new Promise(resolver => {
    const cerrar = abrirModal({
      titulo,
      cuerpo: el('p', { texto: mensaje, estilo: { margin: '0', color: 'var(--texto-medio)' } }),
      acciones: [
        el('button.btn', {
          texto: 'Cancelar',
          on: { click: () => { cerrarModal(); resolver(false); } }
        }),
        el(peligro ? 'button.btn.btn-peligro' : 'button.btn.btn-primario', {
          texto: textoOk,
          on: { click: () => { cerrarModal(); resolver(true); } }
        })
      ]
    });
    void cerrar;
  });
}

/* ----------------------------------------------------------
   Chips
   ---------------------------------------------------------- */

export function chipEstado(idEstado) {
  const estado = estadoPorId(idEstado);
  return el('span.chip', { estilo: { color: estado.color } }, [
    el('span.punto'),
    document.createTextNode(estado.nombre)
  ]);
}

export function chipPrioridad(idPrioridad) {
  const p = prioridadPorId(idPrioridad);
  return el('span.chip', { texto: p.nombre, estilo: { color: p.color } });
}

export function marcaPrioridad(idPrioridad) {
  const p = prioridadPorId(idPrioridad);
  return el('span.marca-prioridad', {
    title: `Prioridad ${p.nombre.toLowerCase()}`,
    estilo: { background: p.color }
  });
}

export function chipCategoria(categoria) {
  if (!categoria) return el('span.chip.chip-tenue', { texto: 'Sin categoria' });
  return el('span.chip', { texto: categoria.nombre, estilo: { color: categoria.color || '#4DA9CE' } });
}

export function chipTenue(texto, titulo) {
  return el('span.chip.chip-tenue', { texto, title: titulo || texto });
}

export function avatar(nombre) {
  return el('span.inicial', { texto: iniciales(nombre), title: nombre });
}

/* ----------------------------------------------------------
   Campos de formulario
   ---------------------------------------------------------- */

export function campoTexto({ etiqueta, nombre, valor = '', tipo = 'text', requerido = false, ayuda, placeholder, maxlength, autocomplete }) {
  const entrada = el('input', {
    type: tipo,
    name: nombre,
    valor: valor || '',
    placeholder: placeholder || '',
    maxlength: maxlength || null,
    autocomplete: autocomplete || 'off',
    required: requerido || null
  });
  return {
    nodo: el('div.campo', {}, [
      el('label', { texto: etiqueta, for: nombre }),
      entrada,
      ayuda ? el('span.ayuda', { texto: ayuda }) : null
    ]),
    entrada,
    valor: () => entrada.value.trim()
  };
}

export function campoArea({ etiqueta, nombre, valor = '', ayuda, placeholder, filas = 4 }) {
  const entrada = el('textarea', {
    name: nombre,
    rows: filas,
    placeholder: placeholder || ''
  });
  entrada.value = valor || '';
  return {
    nodo: el('div.campo', {}, [
      el('label', { texto: etiqueta, for: nombre }),
      entrada,
      ayuda ? el('span.ayuda', { texto: ayuda }) : null
    ]),
    entrada,
    valor: () => entrada.value.trim()
  };
}

/**
 * Lista desplegable.
 * @param opciones [{ valor, texto, grupo }]
 */
export function campoSelector({ etiqueta, nombre, opciones = [], valor = '', ayuda, vacio = null }) {
  const entrada = el('select', { name: nombre });
  if (vacio !== null) entrada.appendChild(el('option', { value: '', texto: vacio }));

  const grupos = new Map();
  for (const op of opciones) {
    const nodoOp = el('option', { value: op.valor, texto: op.texto });
    if (op.grupo) {
      if (!grupos.has(op.grupo)) {
        const g = el('optgroup', { label: op.grupo });
        grupos.set(op.grupo, g);
        entrada.appendChild(g);
      }
      grupos.get(op.grupo).appendChild(nodoOp);
    } else {
      entrada.appendChild(nodoOp);
    }
  }
  entrada.value = valor || '';

  return {
    nodo: el('div.campo', {}, [
      el('label', { texto: etiqueta, for: nombre }),
      entrada,
      ayuda ? el('span.ayuda', { texto: ayuda }) : null
    ]),
    entrada,
    valor: () => entrada.value
  };
}

/**
 * Grupo de casillas de verificacion.
 * @param items [{ valor, texto, grupo }]
 */
export function campoCasillas({ etiqueta, items = [], seleccionados = [], ayuda }) {
  const entradas = [];
  const contenedor = el('div.casillas');

  for (const item of items) {
    const casilla = el('input', {
      type: 'checkbox',
      value: item.valor,
      checked: seleccionados.includes(item.valor)
    });
    entradas.push(casilla);
    contenedor.appendChild(
      el('label.casilla', {}, [
        casilla,
        el('span', { texto: item.texto }),
        item.grupo ? el('span.grupo', { texto: item.grupo }) : null
      ])
    );
  }

  if (!items.length) contenedor.appendChild(el('span.ayuda', { texto: 'No hay opciones disponibles.' }));

  return {
    nodo: el('div.campo', {}, [
      el('label', { texto: etiqueta }),
      contenedor,
      ayuda ? el('span.ayuda', { texto: ayuda }) : null
    ]),
    valor: () => entradas.filter(e => e.checked).map(e => e.value)
  };
}

/* ----------------------------------------------------------
   Estados vacios
   ---------------------------------------------------------- */

export function estadoVacio(titulo, detalle, accion = null) {
  return el('div.vacio', {}, [
    el('strong', { texto: titulo }),
    el('span', { texto: detalle || '' }),
    accion ? el('div', { estilo: { marginTop: '14px' } }, [accion]) : null
  ]);
}

export function bloqueError(texto) {
  return el('div.error-form', { texto });
}
