@echo off
echo ======================================
echo   INICIANDO VET - CLÍNICA VETERINÁRIA
echo ======================================
echo.

echo [1/2] Iniciando Backend (porta 3000)...
start "VET Backend" cmd /k "cd /d %~dp0backend && npm run dev"

echo [2/2] Iniciando Frontend (porta 5173)...
start "VET Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ======================================
echo  Sistema iniciado!
echo   Acesse: http://localhost:5173
echo ======================================
echo.
echo Mantenha esta janela aberta enquanto usar o sistema.
pause