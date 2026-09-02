# Seguimiento de Tareas - Petromark SRL

Sitio estatico (HTML + CSS + JavaScript vainilla, sin build) para el seguimiento
de tareas de las bases de Petromark SRL. Backend: Firebase Authentication +
Realtime Database. Hosting: GitHub Pages.

Proyecto Firebase: `tareas-petromark`
Repositorio: `miguePMK/tareas-petromark`

---

## Estructura

```
index.html
reglas-firebase.json      reglas de seguridad para pegar en la consola
estilos/
  base.css                variables de marca, tipografia, marco general
  componentes.css         botones, campos, tablas, modales, avisos
  vistas.css              estilos propios de cada pantalla
js/
  constantes.js           TODO lo ajustable: config de Firebase, estados, semilla,
                          sinonimos y encabezados reconocidos al importar
  util.js                 utilidades sin dependencias de UI
  firebase.js             unico punto de acceso al SDK
  main.js                 punto de entrada
  auth/
    sesion.js             login, observador, bootstrap del primer admin
  datos/                  repositorios (interfaz async, sin UI)
    repoBases.js  repoCategorias.js  repoUsuarios.js
    repoTareas.js  repoAvances.js  repoExternos.js  importador.js
  interfaz/               presentacion (sin logica de negocio)
    componentes.js  login.js  layout.js  formTarea.js
    tablero.js      vistaTareas.js    vistaDetalle.js
    vistaBases.js   vistaUsuarios.js  vistaCategorias.js
    vistaExternos.js  vistaImportar.js
assets/
  logo.png
```

---

## Publicacion

1. Copiar todo el contenido de esta carpeta a la raiz del repositorio y hacer push
   a `main`.
2. En GitHub: Settings -> Pages -> Source: `Deploy from a branch`, rama `main`,
   carpeta `/ (root)`.
3. La URL queda `https://miguepmk.github.io/tareas-petromark/`.

**Importante:** el sitio usa modulos ES. Abrir `index.html` con doble clic
(`file://`) no funciona; hay que servirlo por HTTP. Para probar local:

```
python -m http.server 8000
```

y entrar a `http://localhost:8000`.

---

## Configuracion en Firebase

1. Authentication -> Sign-in method -> habilitar **Correo electronico/contrasena**.
2. Authentication -> Settings -> Dominios autorizados -> agregar
   `miguepmk.github.io`.
3. Realtime Database -> pestana Reglas -> pegar el contenido de
   `reglas-firebase.json` y publicar.
4. Verificar la URL de la base en la consola y, si difiere, corregir
   `URL_BASE_DATOS` en `js/constantes.js`.

---

## Primer arranque

Mientras `/config/sistema` no exista, el sitio muestra la pantalla de alta del
primer administrador. Esa pantalla:

1. crea la cuenta en Authentication,
2. escribe el perfil con rol `admin`,
3. carga las cuencas (CNQN, CGSJ), las 9 bases y las categorias iniciales,
4. sella `/config/sistema` y no vuelve a aparecer.

El primer alta hay que hacerla enseguida despues de publicar: hasta que el
sentinela exista, cualquiera que llegue a la URL podria crearse como
administrador.

---

## Roles

| | Administrador | Editor | Operador |
|---|---|---|---|
| Ver tareas | todas | todas | solo las asignadas |
| Crear y editar tareas | si | si | no |
| Borrar tareas | si | si | no |
| Cambiar estado y registrar avances | si | si | solo en las asignadas |
| ABM bases, usuarios, categorias | si | no | no |

Cerrar una tarea (finalizada o cancelada) exige un comentario, para cualquiera
de los tres roles.

---

## Vistas

- **Tareas:** vista unica con tablero de indicadores, filtros y dos modos de
  lectura. "Por base" (predeterminado) agrupa en acordeones por cuenca y base,
  cada una con su porcentaje de avance. "Lista" muestra la tabla completa.
  Las tarjetas del tablero funcionan como filtros rapidos.
  En pantallas de menos de 760 px la tabla se convierte en bloques y la
  navegacion pasa al pie, pensada para el operador que actualiza desde el
  telefono.
- **Detalle:** ficha, bitacora de avances y registro de nuevos avances.
- **Bases, Usuarios, Categorias, Externos:** ABM, solo administrador.

### Alcance por base

El campo "bases" del perfil limita en que bases el usuario puede **crear y
editar** tareas. No limita lo que ve: el listado sigue mostrando todas.

- El administrador alcanza siempre a todas las bases.
- Si un usuario no tiene ninguna base marcada, se interpreta como sin
  restriccion. Asi la limitacion se activa recien cuando se le asignan bases.
- Al editar una tarea de una base fuera del alcance, esa base se mantiene en el
  selector bajo el grupo "Fuera de tu alcance": se puede guardar sin moverla,
  pero no reasignarla a otra base ajena.
- El recorte esta tambien en las reglas de la base, en el `.validate` de
  `tareas/$tareaId/baseId`. Sin eso, alcanzaria con la consola del navegador
  para saltearlo.

### Internos y externos

Una tarea distingue dos roles:

- **Interno a cargo del seguimiento** (`asignados`): usuarios con cuenta. Son los
  unicos que, ademas de admin y editor, pueden cambiar el estado y cargar
  avances. Toda tarea necesita al menos uno.
- **Ejecuta** (`externos`): contratistas y proveedores del catalogo
  `/externos`. No tienen cuenta, no inician sesion y no afectan permisos: son
  datos descriptivos. Por eso las reglas de la base no los contemplan.

Al importar, las columnas de interno y externo se cruzan: cada nombre se busca
en las dos listas y cae donde corresponda, avisando cuando no fue donde se
esperaba. Es habitual que una misma columna de la planilla mezcle personal
propio con contratistas.
- **Importar:** carga masiva desde planilla, solo administrador. Tres pasos:
  elegir archivo, asignar columnas y revisar. Nada se escribe hasta confirmar.

### Importacion masiva

- Formatos: `.xlsx`, `.xls` y `.csv`. El lector de Excel se descarga de
  `cdn.sheetjs.com`; si la red de la empresa lo bloquea, hay que guardar la
  planilla como CSV (el aviso aparece en pantalla).
- Las columnas se detectan por el nombre del encabezado y se pueden corregir a
  mano. Los alias reconocidos estan en `ENCABEZADOS_CONOCIDOS`.
- Bases y responsables tienen que existir: si no, la fila queda con error y no
  se importa. Las categorias y prioridades desconocidas solo generan un aviso.
- Fechas aceptadas: `dd/mm/aaaa`, `aaaa-mm-dd` y el numero de serie interno de
  Excel.
- Se marcan como repetidas las tareas con el mismo titulo en la misma base, ya
  sea contra lo que hay cargado o dentro de la misma planilla.
- Cada tarea importada queda con un avance automatico que indica el archivo y
  la fila de origen, y con el campo `importada: true`.
- La escritura va en lotes de 150 con un unico update multi-ruta por lote.

---

## Notas de operacion

- La `apiKey` queda visible en el codigo. Es normal en Firebase web: la
  seguridad la dan las reglas de la base, no la clave.
- Las cuentas se crean desde la aplicacion usando una instancia secundaria de
  Firebase, para que el alta no expulse de la sesion al administrador.
- Quitar el acceso a alguien se hace con "Quitar acceso" (marca `activo: false`).
  Borrar la cuenta de Authentication solo se puede desde la consola de Firebase.
- Los avances son de solo alta: no se editan ni se borran, asi la traza queda
  intacta. Al borrar una tarea se borra tambien su bitacora.
- El filtro de tareas del operador se aplica en el navegador. Realtime Database
  no puede consultar por pertenencia a un mapa, por eso se mantiene el indice
  `/indices/tareasPorUsuario` para cuando haga falta filtrar del lado del
  servidor.
