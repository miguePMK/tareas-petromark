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

export const ESTADOS = [
  { id: ESTADO.PENDIENTE, nombre: 'Pendiente', color: '#D9A32B', abierto: true },
  { id: ESTADO.EN_CURSO, nombre: 'En curso', color: '#4DA9CE', abierto: true },
  { id: ESTADO.EN_ESPERA, nombre: 'En espera', color: '#9B7BC4', abierto: true },
  { id: ESTADO.FINALIZADA, nombre: 'Finalizada', color: '#5FB37A', abierto: false },
  { id: ESTADO.CANCELADA, nombre: 'Cancelada', color: '#7C8894', abierto: false }
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
  { id: PRIORIDAD.BAJA, nombre: 'Baja', color: '#7C8894', peso: 1 },
  { id: PRIORIDAD.MEDIA, nombre: 'Media', color: '#4DA9CE', peso: 2 },
  { id: PRIORIDAD.ALTA, nombre: 'Alta', color: '#D9A32B', peso: 3 },
  { id: PRIORIDAD.CRITICA, nombre: 'Critica', color: '#D9603F', peso: 4 }
];

export const PRIORIDAD_POR_DEFECTO = PRIORIDAD.MEDIA;

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
  { nombre: 'Sistemas', color: '#4DA9CE' },
  { nombre: 'Mantenimiento', color: '#D9A32B' },
  { nombre: 'Logistica', color: '#5FB37A' },
  { nombre: 'Administracion', color: '#9B7BC4' },
  { nombre: 'Seguridad e Higiene', color: '#D9603F' },
  { nombre: 'Otros', color: '#7C8894' }
];

export const COLORES_CATEGORIA = [
  '#4DA9CE', '#5FB37A', '#D9A32B', '#D9603F',
  '#9B7BC4', '#7C8894', '#C48A5A', '#4FB8A8'
];

/* ----------------------------------------------------------
   Interfaz
   ---------------------------------------------------------- */
export const DURACION_AVISO_MS = 3800;
export const LARGO_MINIMO_CLAVE = 6;
export const LARGO_MAXIMO_TITULO = 140;
export const DIAS_AVISO_VENCIMIENTO = 3;
