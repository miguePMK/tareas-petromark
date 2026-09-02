/* ==========================================================
   vistaImportar.js - Carga masiva de tareas desde planilla
   Tres pasos: archivo, mapeo de columnas, revision e importacion.
   ========================================================== */

import { el, vaciar, recortar, mensajeErrorAuth } from '../util.js';
import { estadoPorId, prioridadPorId, fechaCorta } from '../util.js';
import * as repoTareas from '../datos/repoTareas.js';
import {
  leerPlanilla, detectarMapeo, interpretar,
  generarPlantillaCSV, CAMPOS_IMPORTABLES
} from '../datos/importador.js';

import {
  campoSelector, campoCasillas, bloqueError,
  estadoVacio, chipTenue, confirmar, avisoOk, avisoError
} from './componentes.js';

export function montarVistaImportar(contenedor, ctx) {
  const { usuario, almacen, ir } = ctx;

  /* Estado del asistente */
  let paso = 1;
  let nombreArchivo = '';
  let encabezados = [];
  let filas = [];
  let mapeo = {};
  let analisis = null;
  let omitirDuplicados = true;
  let internoPorDefecto = '';
  let importando = false;

  const zonaPasos = el('div.pasos');
  const zonaCuerpo = el('div');

  contenedor.appendChild(
    el('div', {}, [
      el('div.cabecera-vista', {}, [
        el('div', {}, [
          el('h1', { texto: 'Importar tareas' }),
          el('p.descripcion', { texto: 'Carga masiva desde una planilla de Excel o CSV.' })
        ]),
        el('div.acciones', {}, [
          el('button.btn', { texto: 'Descargar plantilla', on: { click: descargarPlantilla } }),
          el('button.btn.btn-plano', { texto: 'Volver a tareas', on: { click: () => ir('tareas') } })
        ])
      ]),
      zonaPasos,
      zonaCuerpo
    ])
  );

  /* ==========================================================
     Indicador de pasos
     ========================================================== */
  function dibujarPasos() {
    vaciar(zonaPasos);
    const nombres = ['Elegir archivo', 'Asignar columnas', 'Revisar e importar'];
    nombres.forEach((nombre, i) => {
      const numero = i + 1;
      zonaPasos.appendChild(
        el('div.paso', {
          clase: numero === paso ? 'activo' : (numero < paso ? 'hecho' : '')
        }, [
          el('span.n', { texto: numero < paso ? '\u2713' : String(numero) }),
          el('span.e', { texto: nombre })
        ])
      );
    });
  }

  /* ==========================================================
     Paso 1: archivo
     ========================================================== */
  function dibujarPaso1() {
    vaciar(zonaCuerpo);

    const entrada = el('input', {
      type: 'file',
      accept: '.xlsx,.xls,.csv,.txt',
      estilo: { display: 'none' }
    });

    const zonaError = el('div');

    const soltar = el('div.zona-archivo', {
      on: {
        click: () => entrada.click(),
        dragover: (ev) => { ev.preventDefault(); soltar.classList.add('encima'); },
        dragleave: () => soltar.classList.remove('encima'),
        drop: (ev) => {
          ev.preventDefault();
          soltar.classList.remove('encima');
          const archivo = ev.dataTransfer.files && ev.dataTransfer.files[0];
          if (archivo) procesarArchivo(archivo, zonaError, soltar);
        }
      }
    }, [
      el('div.icono', { texto: '\u2191' }),
      el('strong', { texto: 'Arrastra la planilla o toca para elegirla' }),
      el('span', { texto: 'Formatos: .xlsx, .xls y .csv' }),
      entrada
    ]);

    entrada.addEventListener('change', () => {
      const archivo = entrada.files && entrada.files[0];
      if (archivo) procesarArchivo(archivo, zonaError, soltar);
    });

    zonaCuerpo.appendChild(
      el('div.panel', {}, [
        zonaError,
        soltar,
        el('div.ayuda-importar', {}, [
          el('p', { texto: 'La primera fila de la planilla tiene que ser la de encabezados. Se lee la primera hoja.' }),
          el('p', { texto: 'Las columnas se detectan solas por su nombre, y en el paso siguiente podes corregir cualquiera.' }),
          el('p', { texto: 'Las bases, los internos y los externos tienen que existir ya en el sistema: si no, la fila se marca con error y no se importa.' }),
          el('p', { texto: 'Si en la columna de responsable figuran contratistas, mapeala a "Ejecuta (externo)" y cargalos antes en la seccion Externos.' }),
          el('p', { texto: 'La fecha de creacion se puede traer de la planilla. Las filas que no la traigan quedan con la fecha de hoy.' })
        ])
      ])
    );
  }

  async function procesarArchivo(archivo, zonaError, soltar) {
    vaciar(zonaError);
    soltar.classList.add('leyendo');
    try {
      const leido = await leerPlanilla(archivo);
      encabezados = leido.encabezados;
      filas = leido.filas;
      nombreArchivo = archivo.name;

      if (!filas.length) {
        zonaError.appendChild(bloqueError('La planilla tiene encabezados pero ninguna fila de datos.'));
        return;
      }

      mapeo = detectarMapeo(encabezados);
      paso = 2;
      dibujar();
    } catch (error) {
      console.error(error);
      zonaError.appendChild(bloqueError(error.message || 'No se pudo leer el archivo.'));
    } finally {
      soltar.classList.remove('leyendo');
    }
  }

  function descargarPlantilla() {
    const blob = new Blob([generarPlantillaCSV()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const enlace = el('a', { href: url, download: 'plantilla-tareas-petromark.csv' });
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ==========================================================
     Paso 2: mapeo de columnas
     ========================================================== */
  function dibujarPaso2() {
    vaciar(zonaCuerpo);

    const opcionesColumna = encabezados.map((h, i) => ({
      valor: String(i),
      texto: `${columnaExcel(i)} \u00b7 ${h || '(sin nombre)'}`
    }));

    const grilla = el('div.grilla-mapeo');

    for (const campo of CAMPOS_IMPORTABLES) {
      const selector = campoSelector({
        etiqueta: campo.nombre + (campo.requerido ? ' *' : ''),
        nombre: campo.id,
        opciones: opcionesColumna,
        valor: mapeo[campo.id] !== undefined ? String(mapeo[campo.id]) : '',
        vacio: campo.requerido ? 'Elegir columna' : 'No importar'
      });
      selector.entrada.addEventListener('change', () => {
        const v = selector.valor();
        if (v === '') delete mapeo[campo.id];
        else mapeo[campo.id] = Number(v);
        dibujarPaso2();
      });
      grilla.appendChild(selector.nodo);
    }

    /* Toda tarea necesita un interno que pueda cargar avances.
       Si la planilla no trae la columna, se elige uno para todas. */
    const selInterno = campoSelector({
      etiqueta: 'Interno de seguimiento por defecto',
      nombre: 'internoDefecto',
      opciones: almacen.asignables().map(u => ({ valor: u.id, texto: u.nombre })),
      valor: internoPorDefecto,
      vacio: 'Ninguno',
      ayuda: 'Se aplica a las filas que no traigan un interno. Sin esto, esas filas quedan con error.'
    });
    selInterno.entrada.addEventListener('change', () => {
      internoPorDefecto = selInterno.valor();
    });

    const faltantes = CAMPOS_IMPORTABLES
      .filter(c => c.requerido && mapeo[c.id] === undefined)
      .map(c => c.nombre);

    /* Muestra las tres primeras filas tal como vinieron */
    const cuerpoPrevia = el('tbody');
    for (const fila of filas.slice(0, 3)) {
      cuerpoPrevia.appendChild(
        el('tr', {}, encabezados.map((_, i) =>
          el('td', { texto: recortar(String(fila[i] ?? ''), 34) })
        ))
      );
    }

    zonaCuerpo.appendChild(
      el('div', {}, [
        el('div.panel', {}, [
          el('div.panel-titulo', {}, [
            el('h2', { texto: 'Que columna es cada cosa' }),
            el('span.acciones', {}, [chipTenue(`${nombreArchivo} \u00b7 ${filas.length} filas`)])
          ]),
          grilla,
          el('div.separador-campos', {}, [selInterno.nodo]),
          faltantes.length
            ? bloqueError(`Falta indicar: ${faltantes.join(', ')}.`)
            : null
        ]),
        el('div.panel', {}, [
          el('div.panel-titulo', {}, [el('h2', { texto: 'Primeras filas del archivo' })]),
          el('div.tabla-marco', {}, [
            el('table.tabla', {}, [
              el('thead', {}, [
                el('tr', {}, encabezados.map((h, i) =>
                  el('th', { texto: `${columnaExcel(i)} \u00b7 ${h || '(sin nombre)'}` })
                ))
              ]),
              cuerpoPrevia
            ])
          ])
        ]),
        el('div.pie-asistente', {}, [
          el('button.btn', { texto: 'Atras', on: { click: () => { paso = 1; dibujar(); } } }),
          el('button.btn.btn-primario', {
            texto: 'Revisar datos',
            disabled: faltantes.length > 0,
            on: {
              click: () => {
                analisis = interpretar(filas, mapeo, {
                  bases: almacen.bases,
                  usuarios: almacen.usuarios,
                  categorias: almacen.categorias,
                  externos: almacen.externos,
                  tareasExistentes: tareasActuales,
                  internoPorDefecto: internoPorDefecto || null
                });
                paso = 3;
                dibujar();
              }
            }
          })
        ])
      ])
    );
  }

  /** 0 -> A, 25 -> Z, 26 -> AA */
  function columnaExcel(i) {
    let n = i, nombre = '';
    do {
      nombre = String.fromCharCode(65 + (n % 26)) + nombre;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return nombre;
  }

  /* ==========================================================
     Paso 3: revision
     ========================================================== */
  function dibujarPaso3() {
    vaciar(zonaCuerpo);
    const { resultados, resumen } = analisis;

    const aImportar = resultados.filter(r => r.valida && (!omitirDuplicados || !r.duplicado));

    /* Tarjetas de resumen */
    const tarjetas = el('div.kpis', { estilo: { marginBottom: '12px' } });
    const definiciones = [
      { n: aImportar.length, e: 'Se van a importar', color: 'var(--ok)', tinte: 'var(--ok-tinte)' },
      { n: resumen.conError, e: 'Con error', color: 'var(--error)', tinte: 'var(--error-tinte)' },
      { n: resumen.duplicadas, e: 'Repetidas', color: 'var(--alerta)', tinte: 'var(--alerta-tinte)' },
      { n: resumen.conAviso, e: 'Con aviso', color: 'var(--acento)', tinte: 'var(--info-tinte)' }
    ];
    for (const d of definiciones) {
      tarjetas.appendChild(
        el('div.kpi', {
          estilo: {
            color: d.color,
            borderColor: d.n === 0 ? 'var(--borde)' : d.color,
            background: d.n === 0 ? 'var(--panel)' : d.tinte,
            cursor: 'default'
          }
        }, [
          el('span.n', { texto: String(d.n) }),
          el('span.e', { texto: d.e })
        ])
      );
    }

    /* Opciones */
    const opciones = campoCasillas({
      etiqueta: 'Opciones',
      items: [{ valor: 'omitir', texto: 'Omitir las tareas repetidas' }],
      seleccionados: omitirDuplicados ? ['omitir'] : [],
      ayuda: 'Se considera repetida cuando ya existe una tarea con el mismo titulo en la misma base.'
    });
    opciones.nodo.querySelector('input').addEventListener('change', (ev) => {
      omitirDuplicados = ev.target.checked;
      dibujarPaso3();
    });

    /* Tabla de revision */
    const cuerpo = el('tbody');
    for (const r of resultados) {
      const omitida = r.duplicado && omitirDuplicados;
      const clase = !r.valida ? 'fila-error' : (omitida ? 'fila-omitida' : (r.avisos.length ? 'fila-aviso' : ''));

      const notas = [];
      for (const e of r.errores) notas.push(el('div.nota-error', { texto: e }));
      if (r.duplicado) notas.push(el('div.nota-aviso', { texto: `Repetida: ${r.duplicado}` }));
      for (const a of r.avisos) notas.push(el('div.nota-aviso', { texto: a }));

      cuerpo.appendChild(
        el('tr', { clase }, [
          el('td.num-fila', { texto: String(r.numero) }),
          el('td', {}, [
            el('div.principal', { texto: r.datos.titulo || '(sin titulo)' }),
            r.datos.solicitante ? el('div.secundario', { texto: `Solicita: ${r.datos.solicitante}` }) : null,
            notas.length ? el('div.notas', {}, notas) : null
          ]),
          el('td', { texto: r.datos.baseId ? (almacen.basePorId[r.datos.baseId] || {}).codigo || '?' : '\u2014' }),
          el('td', {}, [
            el('div.asignados', {}, [
              ...(r.datos.asignados && r.datos.asignados.length
                ? r.datos.asignados.map(uid => chipTenue(almacen.nombreUsuario(uid)))
                : [el('span.secundario', { texto: 'Sin asignar' })]),
              ...((r.datos.externos || []).map(id =>
                el('span.chip.chip-externo', { texto: almacen.nombreExterno(id) })))
            ])
          ]),
          el('td', { texto: r.datos.prioridad ? prioridadPorId(r.datos.prioridad).nombre : '' }),
          el('td', { texto: r.datos.estado ? estadoPorId(r.datos.estado).nombre : '' }),
          el('td', {
            texto: r.datos.creadaEn ? fechaCorta(r.datos.creadaEn) : 'hoy',
            clase: r.datos.creadaEn ? '' : 'secundario'
          }),
          el('td', { texto: r.datos.vencimiento ? fechaCorta(r.datos.vencimiento) : '' }),
          el('td', {}, [
            !r.valida
              ? el('span.chip', { texto: 'Error', estilo: { color: 'var(--error)' } })
              : omitida
                ? el('span.chip.chip-tenue', { texto: 'Se omite' })
                : el('span.chip', { texto: 'Lista', estilo: { color: 'var(--ok)' } })
          ])
        ])
      );
    }

    const zonaProgreso = el('div');

    const botonImportar = el('button.btn.btn-primario', {
      texto: `Importar ${aImportar.length} tarea${aImportar.length === 1 ? '' : 's'}`,
      disabled: aImportar.length === 0 || importando,
      on: { click: () => ejecutarImportacion(aImportar, zonaProgreso, botonImportar) }
    });

    zonaCuerpo.appendChild(
      el('div', {}, [
        tarjetas,
        el('div.panel', {}, [opciones.nodo]),
        resumen.conError
          ? el('div.error-form', {
              texto: `${resumen.conError} fila(s) tienen errores y no se van a importar. Corregilas en la planilla y volve a subirla, o importa el resto ahora.`
            })
          : null,
        el('div.tabla-marco', { estilo: { marginTop: '12px' } }, [
          el('table.tabla.tabla-revision', {}, [
            el('thead', {}, [
              el('tr', {}, [
                el('th', { texto: 'Fila' }),
                el('th', { texto: 'Tarea' }),
                el('th', { texto: 'Base' }),
                el('th', { texto: 'Responsables' }),
                el('th', { texto: 'Prioridad' }),
                el('th', { texto: 'Estado' }),
                el('th', { texto: 'Creada' }),
                el('th', { texto: 'Vence' }),
                el('th', { texto: '' })
              ])
            ]),
            cuerpo
          ])
        ]),
        zonaProgreso,
        el('div.pie-asistente', {}, [
          el('button.btn', {
            texto: 'Atras',
            disabled: importando,
            on: { click: () => { paso = 2; dibujar(); } }
          }),
          botonImportar
        ])
      ])
    );
  }

  async function ejecutarImportacion(aImportar, zonaProgreso, boton) {
    const ok = await confirmar({
      titulo: 'Confirmar importacion',
      mensaje: `Se van a crear ${aImportar.length} tareas. Esta accion no se deshace en bloque: habria que borrarlas una por una.`,
      textoOk: 'Importar'
    });
    if (!ok) return;

    importando = true;
    boton.disabled = true;
    boton.textContent = 'Importando';

    vaciar(zonaProgreso);
    const barra = el('span', { estilo: { width: '0%' } });
    const leyenda = el('div.leyenda', { texto: `0 de ${aImportar.length}` });
    zonaProgreso.appendChild(
      el('div.panel', { estilo: { marginTop: '12px' } }, [
        el('div.progreso', {}, [barra]),
        leyenda
      ])
    );

    try {
      const lista = aImportar.map(r => ({
        ...r.datos,
        notaImportacion: `Importada desde la planilla ${nombreArchivo} (fila ${r.numero}).`
      }));

      await repoTareas.crearLote(lista, usuario, (hechas, total) => {
        barra.style.width = `${Math.round((hechas / total) * 100)}%`;
        leyenda.textContent = `${hechas} de ${total}`;
      });

      avisoOk(`${lista.length} tareas importadas.`);
      paso = 4;
      dibujarFinal(lista.length);
    } catch (error) {
      console.error(error);
      avisoError('La importacion fallo.');
      zonaProgreso.appendChild(bloqueError(mensajeErrorAuth(error)));
      boton.disabled = false;
      boton.textContent = 'Reintentar';
    } finally {
      importando = false;
    }
  }

  function dibujarFinal(cantidad) {
    vaciar(zonaPasos);
    vaciar(zonaCuerpo);
    zonaCuerpo.appendChild(
      el('div.panel', {}, [
        estadoVacio(
          `${cantidad} tareas importadas`,
          'Ya estan disponibles en el listado, agrupadas por base.',
          el('div', { estilo: { display: 'flex', gap: '8px', justifyContent: 'center' } }, [
            el('button.btn.btn-primario', { texto: 'Ver las tareas', on: { click: () => ir('tareas') } }),
            el('button.btn', {
              texto: 'Importar otra planilla',
              on: {
                click: () => {
                  paso = 1;
                  encabezados = []; filas = []; mapeo = {}; analisis = null;
                  nombreArchivo = '';
                  dibujar();
                }
              }
            })
          ])
        )
      ])
    );
  }

  /* ==========================================================
     Tareas existentes, para detectar repetidas
     ========================================================== */
  let tareasActuales = [];
  const cortarEscucha = repoTareas.escucharTodas(lista => { tareasActuales = lista; });

  /* ==========================================================
     Dibujo
     ========================================================== */
  function dibujar() {
    dibujarPasos();
    if (paso === 1) dibujarPaso1();
    else if (paso === 2) dibujarPaso2();
    else if (paso === 3) dibujarPaso3();
  }

  dibujar();

  return {
    /* No se redibuja sola: perderia el archivo cargado a mitad del asistente */
    actualizar: () => {},
    desmontar: () => { if (cortarEscucha) cortarEscucha(); }
  };
}
