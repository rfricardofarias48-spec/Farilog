@echo off
cd /d "C:\Users\Home\Desktop\App\App Farilog"
git add .
git commit -m "atualização"
git push
echo.
echo ✅ Enviado! Deploy iniciado no GitHub Actions.
pause
