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
  constantes.js           TODO lo ajustable: config de Firebase, estados, semilla
  util.js                 utilidades sin dependencias de UI
  firebase.js             unico punto de acceso al SDK
  main.js                 punto de entrada
  auth/
    sesion.js             login, observador, bootstrap del primer admin
  datos/                  repositorios (interfaz async, sin UI)
    repoBases.js  repoCategorias.js  repoUsuarios.js
    repoTareas.js  repoAvances.js
  interfaz/               presentacion (sin logica de negocio)
    componentes.js  login.js  layout.js  formTarea.js
    vistaTareas.js  vistaDetalle.js
    vistaBases.js   vistaUsuarios.js  vistaCategorias.js
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
