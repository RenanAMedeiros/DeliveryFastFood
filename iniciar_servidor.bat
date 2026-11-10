@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "PORTABLE_PY=%PROJECT_DIR%.python\python.exe"
set "VENV_PY=%PROJECT_DIR%.venv\Scripts\python.exe"
set "MANAGE_PY=%PROJECT_DIR%manage.py"

cd /d "%PROJECT_DIR%"
set "PYTHONPATH=%PROJECT_DIR%;%PYTHONPATH%"

if not exist "%MANAGE_PY%" (
    echo Nao encontrei o manage.py nesta pasta:
    echo %PROJECT_DIR%
    echo.
    echo Coloque este .bat na raiz do projeto Django.
    pause
    exit /b 1
)

set "PYTHON_EXE="

if exist "%PORTABLE_PY%" (
    "%PORTABLE_PY%" --version >nul 2>nul
    if not errorlevel 1 (
        set "PYTHON_EXE=%PORTABLE_PY%"
    )
)

if "%PYTHON_EXE%"=="" if exist "%VENV_PY%" (
    "%VENV_PY%" --version >nul 2>nul
    if not errorlevel 1 (
        set "PYTHON_EXE=%VENV_PY%"
    )
)

if "%PYTHON_EXE%"=="" (
    echo Nao encontrei um Python funcional nesta pasta.
    echo.
    echo Tentei:
    echo %PORTABLE_PY%
    echo %VENV_PY%
    echo.
    echo Para rodar em uma maquina sem Python instalado, primeiro execute:
    echo preparar_python_portatil.bat
    echo.
    echo Depois copie a pasta inteira do projeto, incluindo a pasta .python.
    pause
    exit /b 1
)

if "%PYTHON_EXE%"=="%PORTABLE_PY%" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$pth = Get-ChildItem -Path '%PROJECT_DIR%.python' -Filter 'python*._pth' | Select-Object -First 1; if ($pth) { $project = '%PROJECT_DIR%'.TrimEnd('\'); $lines = Get-Content $pth.FullName; if ($lines -notcontains $project) { $lines = @($lines[0]) + @($project) + $lines[1..($lines.Count-1)]; Set-Content $pth.FullName -Value $lines -Encoding ASCII } }"
)

echo Iniciando Controle de Pedidos...
echo Pasta do projeto: %PROJECT_DIR%
echo Python usado: %PYTHON_EXE%
echo.

"%PYTHON_EXE%" -c "import django" >nul 2>nul
if errorlevel 1 (
    echo Django nao esta instalado neste Python.
    echo Instalando dependencias locais...
    echo.

    if not exist "%PROJECT_DIR%requirements_local.txt" (
        echo Nao encontrei requirements_local.txt nesta pasta.
        echo Rode preparar_python_portatil.bat ou copie o arquivo requirements_local.txt.
        pause
        exit /b 1
    )

    "%PYTHON_EXE%" -m pip --version >nul 2>nul
    if errorlevel 1 (
        echo Pip nao esta disponivel neste Python.
        echo Rode preparar_python_portatil.bat para preparar o Python portatil completo.
        pause
        exit /b 1
    )

    "%PYTHON_EXE%" -m pip install -r "%PROJECT_DIR%requirements_local.txt"
    if errorlevel 1 (
        echo.
        echo Falha ao instalar dependencias.
        echo Verifique a internet ou rode preparar_python_portatil.bat nesta maquina.
        pause
        exit /b 1
    )
)

"%PYTHON_EXE%" "%MANAGE_PY%" check
if errorlevel 1 (
    echo.
    echo O Django encontrou erros. Corrija antes de iniciar o servidor.
    pause
    exit /b 1
)

echo Aplicando atualizacoes do banco de dados...
"%PYTHON_EXE%" "%MANAGE_PY%" migrate --fake-initial

echo.
echo Servidor disponivel em http://127.0.0.1:8000/
echo Pressione CTRL+C para parar.
echo.

"%PYTHON_EXE%" "%MANAGE_PY%" runserver 127.0.0.1:8000

pause
