@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "PY_DIR=%PROJECT_DIR%.python"
set "PY_EXE=%PY_DIR%\python.exe"
set "REQ_FILE=%PROJECT_DIR%requirements_local.txt"
set "PY_ZIP=%PROJECT_DIR%python-portatil.zip"
set "GET_PIP=%PROJECT_DIR%get-pip.py"
set "PY_URL=https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip"
set "GET_PIP_URL=https://bootstrap.pypa.io/get-pip.py"

cd /d "%PROJECT_DIR%"

if not exist "%REQ_FILE%" (
    echo Nao encontrei:
    echo %REQ_FILE%
    pause
    exit /b 1
)

if exist "%PY_EXE%" (
    echo Python portatil ja existe em:
    echo %PY_EXE%
    echo.
) else (
    echo Baixando Python portatil...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '%PY_URL%' -OutFile '%PY_ZIP%'"
    if errorlevel 1 (
        echo Falha ao baixar o Python portatil.
        pause
        exit /b 1
    )

    echo Extraindo Python portatil...
    if exist "%PY_DIR%" rmdir /s /q "%PY_DIR%"
    mkdir "%PY_DIR%"
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%PY_ZIP%' -DestinationPath '%PY_DIR%' -Force"
    if errorlevel 1 (
        echo Falha ao extrair o Python portatil.
        pause
        exit /b 1
    )
)

echo Habilitando import site no Python portatil...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$pth = Get-ChildItem -Path '%PY_DIR%' -Filter 'python*._pth' | Select-Object -First 1; if ($pth) { (Get-Content $pth.FullName) -replace '#import site','import site' | Set-Content $pth.FullName -Encoding ASCII }"

if not exist "%GET_PIP%" (
    echo Baixando instalador do pip...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '%GET_PIP_URL%' -OutFile '%GET_PIP%'"
    if errorlevel 1 (
        echo Falha ao baixar get-pip.py.
        pause
        exit /b 1
    )
)

echo Instalando pip...
"%PY_EXE%" "%GET_PIP%"
if errorlevel 1 (
    echo Falha ao instalar pip.
    pause
    exit /b 1
)

echo Instalando dependencias locais...
"%PY_EXE%" -m pip install -r "%REQ_FILE%"
if errorlevel 1 (
    echo Falha ao instalar dependencias.
    pause
    exit /b 1
)

echo.
echo Python portatil preparado com sucesso.
echo Agora voce pode copiar a pasta inteira do projeto para outra maquina,
echo incluindo a pasta .python.
echo.
pause
