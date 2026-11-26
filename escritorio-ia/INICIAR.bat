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
REM Roda sempre a partir de uma copia em %TEMP%: assim uma atualizacao pode trocar este arquivo sem atrapalhar.
if /i not "%~1"=="--copia" (
  copy /y "%~f0" "%TEMP%\escritorio-ia-iniciar.bat" >nul
  "%TEMP%\escritorio-ia-iniciar.bat" --copia "%~dp0." %*
)
cd /d "%~2"
shift
shift
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
echo  [1/7] Node.js nao encontrado. Instalando pelo winget...
call :winget OpenJS.NodeJS.LTS || goto :falha_node
where node >nul 2>nul || goto :falha_node
:tem_node
for /f "delims=" %%v in ('node -v') do echo  [1/7] Node.js %%v ok

REM --- 2. Git (o Claude Code no Windows usa o Git Bash) ---
where git >nul 2>nul
if not errorlevel 1 goto :tem_git
echo  [2/7] Git nao encontrado. Instalando pelo winget...
call :winget Git.Git
where git >nul 2>nul || echo  [2/7] Aviso: Git nao instalado. O Claude Code pode pedir o Git Bash.
goto :claude
:tem_git
echo  [2/7] Git ok

REM --- 3. Claude Code ---
:claude
where claude >nul 2>nul
if not errorlevel 1 goto :tem_claude
echo  [3/7] Claude Code nao encontrado. Instalando (instalador oficial)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://claude.ai/install.ps1 | iex"
where claude >nul 2>nul
if not errorlevel 1 goto :tem_claude
echo  [3/7] Tentando pelo npm...
call npm install -g @anthropic-ai/claude-code
where claude >nul 2>nul
if errorlevel 1 (
  echo  [3/7] Nao consegui instalar o Claude Code. Voce pode tentar pela pagina: Configurar ^> Instalar.
  goto :deps
)
:tem_claude
echo  [3/7] Claude Code ok  ^(o login, se precisar, e feito pela pagina^)

REM --- 4. dependencias do escritorio ---
:deps
if exist "node_modules\ws\package.json" goto :tem_deps
echo  [4/7] Instalando dependencias do escritorio...
call npm install --no-audit --no-fund || goto :falha_npm
:tem_deps
echo  [4/7] Dependencias ok
if not exist data mkdir data

REM --- 5. canal gamer: ffmpeg (edicao de video) e voz gratuita (Piper) ---
set "PATH=%LOCALAPPDATA%\Microsoft\WinGet\Links;%PATH%"
where ffmpeg >nul 2>nul
if not errorlevel 1 goto :tem_ffmpeg
echo  [5/7] ffmpeg nao encontrado. Instalando pelo winget...
call :winget Gyan.FFmpeg
where ffmpeg >nul 2>nul || echo  [5/7] Aviso: sem ffmpeg o canal gamer nao monta videos. Instale em https://www.gyan.dev/ffmpeg/builds/
:tem_ffmpeg
if exist "producao\instalar-voz.js" if not exist "producao\voz\.pronto" (
  echo  [5/7] Baixando a voz gratuita ^(Piper, pt-BR^)... so na primeira vez.
  node producao\instalar-voz.js
)
REM vozes Kokoro (mais naturais; precisam de Python 3)
if exist "producao\voz\kokoro\.pronto" goto :tem_kokoro
where py >nul 2>nul || where python >nul 2>nul || (
  echo  [5/7] Instalando o Python ^(para as vozes Kokoro^)...
  call :winget Python.Python.3.12
  set "PATH=%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Launcher;%PATH%"
)
echo  [5/7] Baixando as vozes Kokoro ^(cerca de 350 MB, so na primeira vez^)...
node producao\instalar-kokoro.js || echo  [5/7] Aviso: Kokoro nao instalado; o canal usa a voz Piper.
:tem_kokoro
echo  [5/7] Canal gamer ok

REM --- 6. IA local gratis (Ollama + Qwen3) para perguntas simples, economiza o Claude ---
set "PATH=%LOCALAPPDATA%\Programs\Ollama;%PATH%"
if "%ESCRITORIO_MODELO_LOCAL%"=="" set "ESCRITORIO_MODELO_LOCAL=qwen3:4b-instruct"
where ollama >nul 2>nul
if not errorlevel 1 goto :tem_ollama
echo  [6/7] Instalando a IA local gratis ^(Ollama^)...
call :winget Ollama.Ollama
where ollama >nul 2>nul || ( echo  [6/7] Aviso: Ollama nao instalado. O chat continua usando so o Claude. & goto :fim_ollama )
:tem_ollama
ollama list 2>nul | findstr /i /c:"%ESCRITORIO_MODELO_LOCAL%" >nul
if not errorlevel 1 goto :ok_ollama
echo  [6/7] Baixando o modelo %ESCRITORIO_MODELO_LOCAL% ^(cerca de 2,5 GB, so na primeira vez^)...
start "" /b /min ollama serve >nul 2>nul
timeout /t 3 /nobreak >nul
ollama pull %ESCRITORIO_MODELO_LOCAL%
:ok_ollama
echo  [6/7] IA local ok ^(%ESCRITORIO_MODELO_LOCAL%^)
:fim_ollama

REM --- 7. vlog: transcricao local gratis (whisper.cpp) ---
if exist "vlog\instalar-ferramentas.js" if not exist "vlog\ferramentas\.pronto" (
  echo  [7/7] Baixando a transcricao gratis do vlog ^(whisper.cpp^)... so na primeira vez.
  node vlog\instalar-ferramentas.js
)
if not exist "vlog\brutos" mkdir "vlog\brutos"
echo  [7/7] Vlog ok ^(jogue os videos em vlog\brutos^)

REM --- atualizacoes (GitHub: BNBrasil/escritorio-ia) ---
set "REPO=https://github.com/BNBrasil/escritorio-ia.git"
where git >nul 2>nul || goto :fim_atualizacao
if not exist ".git" (
  echo  Conferindo acesso ao GitHub ^(na primeira vez abre o navegador para voce entrar^)...
  git ls-remote "%REPO%" HEAD >nul 2>nul && echo  GitHub ok: as atualizacoes aparecem na pagina do escritorio.
  goto :fim_atualizacao
)
echo  Procurando atualizacoes...
git fetch --quiet origin main 2>nul || ( echo  Nao consegui falar com o GitHub agora. & goto :fim_atualizacao )
set "NOVAS=0"
for /f %%n in ('git rev-list --count HEAD..origin/main 2^>nul') do set "NOVAS=%%n"
if "%NOVAS%"=="0" ( echo  Voce ja esta na versao mais nova. & goto :fim_atualizacao )
echo.
echo  *** Tem atualizacao: %NOVAS% novidade^(s^) ***
git log --format="    - %%s" -n 10 HEAD..origin/main
echo.
choice /c SN /t 15 /d N /m "  Baixar a atualizacao agora? (S = sim, N = depois; em 15 s segue sem atualizar)"
if errorlevel 2 goto :fim_atualizacao
if exist "data\aparencia.json" git checkout -- public/assets >nul 2>nul
git pull --rebase --autostash --quiet origin main || ( echo  A atualizacao falhou; seguindo com a versao atual. & git rebase --abort >nul 2>nul & goto :fim_atualizacao )
call npm install --no-audit --no-fund >nul
if exist "data\aparencia.json" node art\generate.js >nul
echo  Atualizado!
:fim_atualizacao

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
