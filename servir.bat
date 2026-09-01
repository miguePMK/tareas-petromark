@echo off
REM ==========================================================
REM  servir.bat - Levanta el sitio en local para probarlo
REM  Los modulos ES no funcionan abriendo index.html con doble
REM  clic (file://): hay que servirlo por HTTP.
REM ==========================================================

setlocal
cd /d "%~dp0"

set PUERTO=8000

echo ==========================================================
echo  Seguimiento de Tareas - Petromark SRL
echo  Servidor local de pruebas
echo ==========================================================
echo.

REM ---- Buscar Python ----
set PY=
where py >nul 2>&1 && set PY=py
if "%PY%"=="" (
    where python >nul 2>&1 && set PY=python
)

if "%PY%"=="" (
    echo [ERROR] No se encontro Python en el sistema.
    echo.
    echo Instalalo desde https://www.python.org/downloads/
    echo y marca la opcion "Add Python to PATH".
    echo.
    pause
    exit /b 1
)

REM ---- Verificar que estamos en la carpeta correcta ----
if not exist "index.html" (
    echo [ERROR] No se encontro index.html en esta carpeta.
    echo Copia este .bat a la raiz del proyecto, junto a index.html.
    echo.
    pause
    exit /b 1
)

echo Sirviendo la carpeta:
echo   %CD%
echo.
echo Abri el navegador en:
echo   http://localhost:%PUERTO%
echo.
echo Para detener el servidor: cerra esta ventana o presiona Ctrl+C
echo ==========================================================
echo.

REM ---- Abrir el navegador despues de un momento ----
start "" cmd /c "timeout /t 2 >nul & start http://localhost:%PUERTO%"

%PY% -m http.server %PUERTO%

echo.
echo El servidor se detuvo.
pause
