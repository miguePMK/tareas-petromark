/* ==========================================================
   constantes.js - Todos los parametros ajustables del sistema
   ========================================================== */

export const VERSION = '0.1.0';
export const NOMBRE_SISTEMA = 'Seguimiento de Tareas';
export const NOMBRE_EMPRESA = 'Petromark SRL';

/* ----------------------------------------------------------
   Firebase
   IMPORTANTE: verificar URL_BASE_DATOS en la consola de Firebase
   (Realtime Database -> arriba del arbol de datos figura la URL).
   Si al crear la base elegiste una region distinta de us-central1,
   la URL se parece a:
   https://tareas-petromark-default-rtdb.southamerica-east1.firebasedatabase.app
   ---------------------------------------------------------- */
export const URL_BASE_DATOS = 'https://tareas-petromark-default-rtdb.firebaseio.com';

export const CONFIG_FIREBASE = {
  apiKey: 'AIzaSyDLVOUsrYpNBvdJfuiZKGhl8LIA1VxHAyw',
  authDomain: 'tareas-petromark.firebaseapp.com',
  databaseURL: URL_BASE_DATOS,
  projectId: 'tareas-petromark',
  storageBucket: 'tareas-petromark.firebasestorage.app',
  messagingSenderId: '980679159191',
  appId: '1:980679159191:web:547d9e540a3baa2a4868d2'
};

export const VERSION_SDK_FIREBASE = '10.12.5';

/* ----------------------------------------------------------
   Roles
   ---------------------------------------------------------- */
export const ROL = {
  ADMIN: 'admin',
  EDITOR: 'editor',
  OPERADOR: 'operador'
};

export const ROLES = [
  { id: ROL.ADMIN, nombre: 'Administrador', descripcion: 'Administra bases, usuarios, categorias y tareas' },
  { id: ROL.EDITOR, nombre: 'Editor', descripcion: 'Crea tareas y las asigna a operadores' },
  { id: ROL.OPERADOR, nombre: 'Operador', descripcion: 'Registra avances y cambia el estado de sus tareas' }
];

/* ----------------------------------------------------------
   Estados de la tarea
   ---------------------------------------------------------- */
export const ESTADO = {
  PENDIENTE: 'pendiente',
  EN_CURSO: 'en_curso',
  EN_ESPERA: 'en_espera',
  FINALIZADA: 'finalizada',
  CANCELADA: 'cancelada'
};

/* Los colores estan calibrados para leerse sobre fondo claro. */
export const ESTADOS = [
  { id: ESTADO.PENDIENTE, nombre: 'Pendiente', color: '#9A6206', abierto: true },
  { id: ESTADO.EN_CURSO, nombre: 'En curso', color: '#10627C', abierto: true },
  { id: ESTADO.EN_ESPERA, nombre: 'En espera', color: '#5D4E96', abierto: true },
  { id: ESTADO.FINALIZADA, nombre: 'Finalizada', color: '#1F7A52', abierto: false },
  { id: ESTADO.CANCELADA, nombre: 'Cancelada', color: '#6B7885', abierto: false }
];

/* Estados que exigen un comentario obligatorio al aplicarse */
export const ESTADOS_CIERRE = [ESTADO.FINALIZADA, ESTADO.CANCELADA];

/* ----------------------------------------------------------
   Prioridades
   ---------------------------------------------------------- */
export const PRIORIDAD = {
  BAJA: 'baja',
  MEDIA: 'media',
  ALTA: 'alta',
  CRITICA: 'critica'
};

export const PRIORIDADES = [
  { id: PRIORIDAD.BAJA, nombre: 'Baja', color: '#8A96A1', peso: 1 },
  { id: PRIORIDAD.MEDIA, nombre: 'Media', color: '#10627C', peso: 2 },
  { id: PRIORIDAD.ALTA, nombre: 'Alta', color: '#B87503', peso: 3 },
  { id: PRIORIDAD.CRITICA, nombre: 'Critica', color: '#B23A28', peso: 4 }
];

export const PRIORIDAD_POR_DEFECTO = PRIORIDAD.MEDIA;

/* ----------------------------------------------------------
   Importacion desde planilla
   ---------------------------------------------------------- */

/* Nombres de columna que se reconocen solos al importar.
   Se comparan normalizados: sin acentos, sin mayusculas. */
export const ENCABEZADOS_CONOCIDOS = {
  baseId: ['base', 'base op', 'base operativa', 'sector', 'ubicacion'],
  titulo: ['tarea', 'descripcion de tarea', 'descripcion', 'titulo', 'detalle', 'trabajo'],
  solicitante: ['solicitante', 'pedido por', 'requirente', 'solicita'],
  asignados: ['responsable interno', 'asignado', 'asignado a', 'encargado', 'seguimiento'],
  externos: ['responsable', 'respopnsable', 'ejecuta', 'contratista', 'proveedor', 'empresa', 'tercero', 'terciarizado'],
  prioridad: ['prioridad', 'urgencia'],
  estado: ['estado', 'situacion', 'avance'],
  categoriaId: ['categoria', 'rubro', 'tipo'],
  creadaEn: ['fecha de creacion', 'fecha creacion', 'creada', 'fecha de alta', 'alta',
             'fecha inicio', 'fecha de inicio', 'f. inicio', 'inicio', 'fecha pedido'],
  vencimiento: ['vencimiento', 'fecha fin', 'f. fin', 'fecha limite', 'plazo', 'entrega'],
  descripcion: ['observaciones', 'observacion', 'notas', 'comentarios', 'detalle adicional']
};

/* Sinonimos aceptados en las columnas de estado y prioridad. */
export const SINONIMOS_ESTADO = {
  pendiente: ['pendiente', 'sin iniciar', 'no iniciado', 'a realizar', 'nuevo'],
  en_curso: ['en curso', 'en proceso', 'en progreso', 'iniciado', 'en ejecucion', 'trabajando'],
  en_espera: ['en espera', 'espera', 'bloqueado', 'demorado', 'suspendido', 'standby'],
  finalizada: ['finalizada', 'finalizado', 'completado', 'completada', 'terminado', 'terminada', 'hecho', 'listo', 'ok'],
  cancelada: ['cancelada', 'cancelado', 'anulado', 'anulada', 'descartado', 'no aplica']
};

export const SINONIMOS_PRIORIDAD = {
  baja: ['baja', 'low', 'menor'],
  media: ['media', 'normal', 'medio', 'standard'],
  alta: ['alta', 'high', 'importante'],
  critica: ['critica', 'critico', 'urgente', 'maxima']
};

/* Tope de tareas por escritura, para no armar un update gigante. */
export const TAM_LOTE_IMPORTACION = 150;

/* ----------------------------------------------------------
   Semilla inicial (se carga una sola vez, al crear el primer admin)
   ---------------------------------------------------------- */
export const SEMILLA_CUENCAS = [
  {
    codigo: 'CNQN',
    nombre: 'Cuenca Neuquina',
    orden: 1,
    bases: [
      { codigo: 'NQ', nombre: 'Base Neuquen' },
      { codigo: 'AN', nombre: 'Base Anelo' },
      { codigo: 'SR', nombre: 'Base Sierra Barrosa' }
    ]
  },
  {
    codigo: 'CGSJ',
    nombre: 'Cuenca Golfo San Jorge',
    orden: 2,
    bases: [
      { codigo: 'ADM CO', nombre: 'Administracion CO' },
      { codigo: 'CO', nombre: 'Base Caleta Olivia' },
      { codigo: 'CR', nombre: 'Base Comodoro Rivadavia' },
      { codigo: 'CD', nombre: 'Base Cerro Dragon' },
      { codigo: 'LH', nombre: 'Base Las Heras' },
      { codigo: 'ND', nombre: 'Novadrill SRL' }
    ]
  }
];

export const SEMILLA_CATEGORIAS = [
  { nombre: 'Sistemas', color: '#10627C' },
  { nombre: 'Mantenimiento', color: '#B87503' },
  { nombre: 'Logistica', color: '#1F7A52' },
  { nombre: 'Administracion', color: '#5D4E96' },
  { nombre: 'Seguridad e Higiene', color: '#B23A28' },
  { nombre: 'Otros', color: '#6B7885' }
];

export const COLORES_CATEGORIA = [
  '#10627C', '#1F7A52', '#B87503', '#B23A28',
  '#5D4E96', '#6B7885', '#8A5A2B', '#0F7C74'
];

/* ----------------------------------------------------------
   Interfaz
   ---------------------------------------------------------- */
export const DURACION_AVISO_MS = 3800;
export const LARGO_MINIMO_CLAVE = 6;
export const LARGO_MAXIMO_TITULO = 140;
export const DIAS_AVISO_VENCIMIENTO = 3;
