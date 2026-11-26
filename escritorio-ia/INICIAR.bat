@echo off
REM ============================================================
REM  Escritorio de IA - INICIAR.bat
REM  Um clique: verifica/instala Node.js, Git, Claude Code e as
REM  dependencias, liga o servidor escondido e abre a pagina.
REM  Uso:  INICIAR.bat            (servidor escondido)
REM        INICIAR.bat --visivel  (mostra o log nesta janela)
REM ============================================================
setlocal EnableExtensions
chcp 65001 >nul
title Escritorio de IA
cd /d "%~dp0"
if "%ESCRITORIO_PORT%"=="" set "ESCRITORIO_PORT=4317"
set "URL=http://127.0.0.1:%ESCRITORIO_PORT%/"
set "PATH=%USERPROFILE%\.local\bin;%APPDATA%\npm;%ProgramFiles%\nodejs;%ProgramFiles%\Git\cmd;%PATH%"

echo.
echo  ===  ESCRITORIO DE IA  ===
echo.

REM --- ja esta ligado? so abre a pagina ---
call :online
if not errorlevel 1 (
  echo  O escritorio ja esta ligado. Abrindo a pagina...
  start "" "%URL%"
  exit /b 0
)

REM --- 1. Node.js ---
where node >nul 2>nul
if not errorlevel 1 goto :tem_node
echo  [1/5] Node.js nao encontrado. Instalando pelo winget...
call :winget OpenJS.NodeJS.LTS || goto :falha_node
where node >nul 2>nul || goto :falha_node
:tem_node
for /f "delims=" %%v in ('node -v') do echo  [1/5] Node.js %%v ok

REM --- 2. Git (o Claude Code no Windows usa o Git Bash) ---
where git >nul 2>nul
if not errorlevel 1 goto :tem_git
echo  [2/5] Git nao encontrado. Instalando pelo winget...
call :winget Git.Git
where git >nul 2>nul || echo  [2/5] Aviso: Git nao instalado. O Claude Code pode pedir o Git Bash.
goto :claude
:tem_git
echo  [2/5] Git ok

REM --- 3. Claude Code ---
:claude
where claude >nul 2>nul
if not errorlevel 1 goto :tem_claude
echo  [3/5] Claude Code nao encontrado. Instalando (instalador oficial)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://claude.ai/install.ps1 | iex"
where claude >nul 2>nul
if not errorlevel 1 goto :tem_claude
echo  [3/5] Tentando pelo npm...
call npm install -g @anthropic-ai/claude-code
where claude >nul 2>nul
if errorlevel 1 (
  echo  [3/5] Nao consegui instalar o Claude Code. Voce pode tentar pela pagina: Configurar ^> Instalar.
  goto :deps
)
:tem_claude
echo  [3/5] Claude Code ok  ^(o login, se precisar, e feito pela pagina^)

REM --- 4. dependencias do escritorio ---
:deps
if exist "node_modules\ws\package.json" goto :tem_deps
echo  [4/5] Instalando dependencias do escritorio...
call npm install --no-audit --no-fund || goto :falha_npm
:tem_deps
echo  [4/5] Dependencias ok
if not exist data mkdir data

REM --- 5. canal gamer: ffmpeg (edicao de video) e voz gratuita (Piper) ---
set "PATH=%LOCALAPPDATA%\Microsoft\WinGet\Links;%PATH%"
where ffmpeg >nul 2>nul
if not errorlevel 1 goto :tem_ffmpeg
echo  [5/5] ffmpeg nao encontrado. Instalando pelo winget...
call :winget Gyan.FFmpeg
where ffmpeg >nul 2>nul || echo  [5/5] Aviso: sem ffmpeg o canal gamer nao monta videos. Instale em https://www.gyan.dev/ffmpeg/builds/
:tem_ffmpeg
if exist "producao\instalar-voz.js" if not exist "producao\voz\.pronto" (
  echo  [5/5] Baixando a voz gratuita ^(Piper, pt-BR^)... so na primeira vez.
  node producao\instalar-voz.js
)
echo  [5/5] Canal gamer ok

REM --- liga o servidor ---
if /i "%~1"=="--visivel" (
  echo.
  echo  Servidor ligado em %URL%  ^(feche esta janela para desligar^)
  start "" /b powershell -NoProfile -Command "Start-Sleep 2; Start-Process '%URL%'"
  node server\index.js
  exit /b
)
echo.
echo  Ligando o servidor em segundo plano...
powershell -NoProfile -Command "Start-Process -WindowStyle Hidden -FilePath 'node' -ArgumentList 'server\index.js' -WorkingDirectory (Get-Location).Path -RedirectStandardOutput 'data\servidor.log' -RedirectStandardError 'data\servidor-erros.log'"
for /l %%i in (1,1,20) do (
  call :online && goto :abrir
  timeout /t 1 /nobreak >nul
)
echo  O servidor nao respondeu. Veja data\servidor-erros.log
pause
exit /b 1

:abrir
echo  Pronto! Abrindo %URL%
echo  Para desligar: na pagina, Configurar ^> Desligar escritorio.
start "" "%URL%"
timeout /t 3 /nobreak >nul
exit /b 0

REM ================= funcoes =================
:online
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 '%URL%state' | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
exit /b %errorlevel%

:winget
where winget >nul 2>nul || exit /b 1
winget install -e --id %1 --accept-source-agreements --accept-package-agreements --silent
exit /b %errorlevel%

:falha_node
echo.
echo  Nao consegui instalar o Node.js. Instale a versao LTS em https://nodejs.org
echo  e rode este arquivo de novo.
pause
exit /b 1

:falha_npm
echo.
echo  Falha no "npm install". Verifique a internet e rode de novo.
pause
exit /b 1
