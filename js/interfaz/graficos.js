/* ==========================================================
   graficos.js - Piezas graficas dibujadas a mano
   SVG y CSS puros: ninguna libreria de CDN, para que el
   informe cargue aunque la red bloquee descargas externas.
   ========================================================== */

import { el } from '../util.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Crea un nodo SVG. el() no sirve: usa createElement, no createElementNS. */
function svg(etiqueta, atributos = {}, hijos = []) {
  const nodo = document.createElementNS(SVG_NS, etiqueta);
  for (const [clave, valor] of Object.entries(atributos)) {
    if (valor === null || valor === undefined || valor === false) continue;
    nodo.setAttribute(clave, valor);
  }
  for (const hijo of [].concat(hijos)) {
    if (!hijo) continue;
    nodo.appendChild(typeof hijo === 'string' ? document.createTextNode(hijo) : hijo);
  }
  return nodo;
}

/* ==========================================================
   Dona de porcentaje
   ========================================================== */

/**
 * @param {object} op { porcentaje, color, titulo, leyenda, tamano }
 */
export function dona({ porcentaje, color = 'var(--acento)', titulo = '', leyenda = '', tamano = 132 }) {
  const radio = 54;
  const circunferencia = 2 * Math.PI * radio;
  const valor = porcentaje === null ? 0 : Math.max(0, Math.min(100, porcentaje));
  const trazo = (valor / 100) * circunferencia;

  const grafico = svg('svg', {
    viewBox: '0 0 140 140',
    width: tamano,
    height: tamano,
    role: 'img',
    'aria-label': `${titulo}: ${porcentaje === null ? 'sin datos' : valor + '%'}`
  }, [
    svg('circle', {
      cx: 70, cy: 70, r: radio,
      fill: 'none',
      stroke: 'var(--borde)',
      'stroke-width': 13
    }),
    porcentaje === null ? null : svg('circle', {
      cx: 70, cy: 70, r: radio,
      fill: 'none',
      stroke: color,
      'stroke-width': 13,
      'stroke-linecap': 'round',
      'stroke-dasharray': `${trazo} ${circunferencia - trazo}`,
      transform: 'rotate(-90 70 70)'
    }),
    svg('text', {
      x: 70, y: 70,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      fill: 'var(--tinta)',
      'font-size': 27,
      'font-weight': 700,
      'font-family': 'var(--fuente)'
    }, porcentaje === null ? '\u2014' : `${valor}%`)
  ]);

  return el('div.dona', {}, [
    grafico,
    titulo ? el('div.dona-titulo', { texto: titulo }) : null,
    leyenda ? el('div.dona-leyenda', { texto: leyenda }) : null
  ]);
}

/* ==========================================================
   Barras horizontales
   ========================================================== */

/**
 * Barras con etiqueta a la izquierda y valor a la derecha.
 * Si el item trae "abiertas", la barra se parte en dos tramos:
 * la parte llena son las cerradas y la clara las que siguen abiertas.
 *
 * @param {object} op { items: [{etiqueta, total, abiertas, color}], maximo, sufijo, alClick }
 */
export function barras({ items = [], maximo = null, sufijo = '', alClick = null, mostrarAbiertas = true }) {
  if (!items.length) return el('p.sin-datos', { texto: 'Sin datos para mostrar.' });

  const techo = maximo || Math.max(1, ...items.map(i => i.total));
  const lista = el('div.barras');

  for (const item of items) {
    const ancho = (item.total / techo) * 100;
    const color = item.color || 'var(--acento)';
    const abiertas = mostrarAbiertas && item.abiertas !== undefined ? item.abiertas : null;
    const anchoAbiertas = abiertas !== null && item.total
      ? (abiertas / item.total) * 100
      : 0;

    const canal = el('div.barra-canal', {}, [
      el('div.barra-relleno', {
        estilo: { width: `${ancho}%`, background: color },
        title: abiertas !== null
          ? `${item.total} en total, ${abiertas} abiertas`
          : `${item.total}${sufijo}`
      }, [
        abiertas
          ? el('span.barra-abiertas', { estilo: { width: `${anchoAbiertas}%` } })
          : null
      ])
    ]);

    const fila = el(alClick ? 'button.barra-fila' : 'div.barra-fila', {
      on: alClick ? { click: () => alClick(item) } : null
    }, [
      el('span.barra-etiqueta', { texto: item.etiqueta, title: item.etiqueta }),
      canal,
      el('span.barra-valor', { texto: `${item.total}${sufijo}` })
    ]);

    lista.appendChild(fila);
  }

  if (mostrarAbiertas && items.some(i => i.abiertas)) {
    lista.appendChild(
      el('div.barras-leyenda', {}, [
        el('span.muestra-llena'),
        el('span', { texto: 'cerradas' }),
        el('span.muestra-clara'),
        el('span', { texto: 'abiertas' })
      ])
    );
  }

  return lista;
}

/* ==========================================================
   Barra apilada por tramos
   ========================================================== */

/**
 * @param {object} op { items: [{etiqueta, cantidad, color}], total, alClick }
 */
export function tramos({ items = [], total = 0, alClick = null }) {
  const suma = total || items.reduce((n, i) => n + i.cantidad, 0);

  const barra = el('div.barra-tramos');
  if (!suma) {
    barra.appendChild(el('span', { estilo: { width: '100%', background: 'var(--borde)' } }));
  } else {
    for (const item of items) {
      if (!item.cantidad) continue;
      barra.appendChild(
        el('span', {
          estilo: { width: `${(item.cantidad / suma) * 100}%`, background: item.color },
          title: `${item.etiqueta}: ${item.cantidad}`
        })
      );
    }
  }

  const leyenda = el('div.leyenda-tramos');
  for (const item of items) {
    leyenda.appendChild(
      el(alClick ? 'button.item-leyenda' : 'div.item-leyenda', {
        on: alClick ? { click: () => alClick(item) } : null
      }, [
        el('span.punto', { estilo: { background: item.color } }),
        el('span.e', { texto: item.etiqueta }),
        el('span.n', { texto: String(item.cantidad) })
      ])
    );
  }

  return el('div', {}, [barra, leyenda]);
}

/* ==========================================================
   Evolucion mensual
   ========================================================== */

/**
 * Barras de creadas y cerradas por mes, con la linea del
 * pendiente acumulado encima.
 *
 * @param {object} op { meses, maximo }
 */
export function evolucion({ meses = [], maximo = 1 }) {
  if (!meses.length) return el('p.sin-datos', { texto: 'Sin datos para mostrar.' });

  const ancho = 760;
  const alto = 240;
  const margen = { arriba: 14, derecha: 12, abajo: 34, izquierda: 34 };
  const anchoUtil = ancho - margen.izquierda - margen.derecha;
  const altoUtil = alto - margen.arriba - margen.abajo;

  const paso = anchoUtil / meses.length;
  const anchoBarra = Math.min(18, paso * 0.3);
  const escalaY = (valor) => margen.arriba + altoUtil - (valor / maximo) * altoUtil;

  const piezas = [];

  /* Guias horizontales con su valor */
  const cortes = 4;
  for (let i = 0; i <= cortes; i++) {
    const valor = Math.round((maximo / cortes) * i);
    const y = escalaY(valor);
    piezas.push(svg('line', {
      x1: margen.izquierda, y1: y, x2: ancho - margen.derecha, y2: y,
      stroke: 'var(--borde)', 'stroke-width': 1
    }));
    piezas.push(svg('text', {
      x: margen.izquierda - 7, y: y + 3.5,
      'text-anchor': 'end', fill: 'var(--tinta-tenue)',
      'font-size': 10, 'font-family': 'var(--fuente)'
    }, String(valor)));
  }

  /* Barras y etiquetas de mes */
  meses.forEach((mes, i) => {
    const centro = margen.izquierda + paso * i + paso / 2;

    const barra = (valor, desplazamiento, color, nombre) => {
      if (!valor) return;
      const y = escalaY(valor);
      piezas.push(svg('rect', {
        x: centro + desplazamiento,
        y: y,
        width: anchoBarra,
        height: margen.arriba + altoUtil - y,
        rx: 2,
        fill: color
      }, [svg('title', {}, `${nombre} en ${mes.etiqueta}: ${valor}`)]));
    };

    barra(mes.creadas, -anchoBarra - 1, 'var(--acento)', 'Creadas');
    barra(mes.cerradas, 1, '#1F9254', 'Cerradas');

    piezas.push(svg('text', {
      x: centro, y: alto - 12,
      'text-anchor': 'middle', fill: 'var(--tinta-tenue)',
      'font-size': 10, 'font-family': 'var(--fuente)'
    }, mes.etiqueta));
  });

  /* Linea del pendiente acumulado */
  const puntos = meses.map((mes, i) => {
    const x = margen.izquierda + paso * i + paso / 2;
    return `${x.toFixed(1)},${escalaY(mes.acumulado).toFixed(1)}`;
  });

  piezas.push(svg('polyline', {
    points: puntos.join(' '),
    fill: 'none',
    stroke: '#B87503',
    'stroke-width': 2,
    'stroke-linejoin': 'round'
  }));

  meses.forEach((mes, i) => {
    const x = margen.izquierda + paso * i + paso / 2;
    piezas.push(svg('circle', {
      cx: x, cy: escalaY(mes.acumulado), r: 3,
      fill: 'var(--panel)', stroke: '#B87503', 'stroke-width': 2
    }, [svg('title', {}, `Pendientes al cierre de ${mes.etiqueta}: ${mes.acumulado}`)]));
  });

  const grafico = svg('svg', {
    viewBox: `0 0 ${ancho} ${alto}`,
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-label': 'Tareas creadas, cerradas y pendientes acumuladas por mes'
  }, piezas);

  return el('div', {}, [
    el('div.grafico-marco', {}, [grafico]),
    el('div.barras-leyenda', {}, [
      el('span.muestra-color', { estilo: { background: 'var(--acento)' } }),
      el('span', { texto: 'creadas' }),
      el('span.muestra-color', { estilo: { background: '#1F9254' } }),
      el('span', { texto: 'cerradas' }),
      el('span.muestra-linea'),
      el('span', { texto: 'pendientes acumuladas' })
    ])
  ]);
}

/* ==========================================================
   Indicador suelto
   ========================================================== */

/** Numero grande con su rotulo, para las cifras de cabecera. */
export function cifra({ valor, etiqueta, detalle = '', color = 'var(--tinta)' }) {
  return el('div.cifra', {}, [
    el('span.v', { texto: valor === null || valor === undefined ? '\u2014' : String(valor), estilo: { color } }),
    el('span.e', { texto: etiqueta }),
    detalle ? el('span.d', { texto: detalle }) : null
  ]);
}
