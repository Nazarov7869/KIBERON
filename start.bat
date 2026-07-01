@echo off
REM =====================================================================
REM  Ipak Yo'li - uch qism (backend + frontend CRM + web) Windows uchun
REM  Ishlatish: start.bat faylini ikki marta bosing (yoki cmd'da).
REM  Manzillar:
REM    Backend  : 0.0.0.0:5555   (API)
REM    Frontend : 0.0.0.0:4444   (CRM,  domen: ipak.elektronbozor.uz)
REM    Web      : 0.0.0.0:3535   (marketing sayt)
REM  Talab: Python 3.10+ (PATH'da), Node.js 18+ (npm bilan). Tashqi baza KERAK EMAS.
REM =====================================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"

REM --- 0) Talablar ----------------------------------------------------
where python >nul 2>&1
if errorlevel 1 (
  echo XATO: python topilmadi. Python 3.10+ o'rnating va "Add Python to PATH" ni belgilang.
  echo        https://www.python.org/downloads/
  pause & exit /b 1
)
where node >nul 2>&1
if errorlevel 1 (
  echo XATO: node topilmadi. Node.js 18+ o'rnating ^(https://nodejs.org^).
  pause & exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo XATO: npm topilmadi. Node.js'ni qayta o'rnating ^(npm u bilan birga keladi^).
  pause & exit /b 1
)

REM --- 0b) Portlarni bo'shatish (oldingi ishga tushirish qolgan bo'lsa) ---
for %%P in (5555 4444 3535) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P " ^| findstr LISTENING') do (
    taskkill /F /PID %%A >nul 2>&1
  )
)

REM --- 1) Backend sozlash (0.0.0.0:5555) -----------------------------
echo ==^> Backend sozlanmoqda...
cd /d "%~dp0backend"
if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo    .env yaratildi ^(SQLite -- sozlash shart emas^)
)
set "NEED_INSTALL=0"
if not exist "venv\Scripts\python.exe" set "NEED_INSTALL=1"
if not exist "venv\.installed" set "NEED_INSTALL=1"
if "!NEED_INSTALL!"=="1" (
  if not exist "venv\Scripts\python.exe" (
    echo    virtual muhit ^(venv^) yaratilmoqda...
    python -m venv venv
    if errorlevel 1 ( echo XATO: venv yaratilmadi. & pause & exit /b 1 )
  )
  call "venv\Scripts\python.exe" -m pip install --upgrade pip >nul
  echo    Python paketlari o'rnatilmoqda ^(biroz vaqt olishi mumkin^)...
  call "venv\Scripts\python.exe" -m pip install -r requirements.txt
  if errorlevel 1 (
    echo.
    echo XATO: Python paketlari o'rnatilmadi. Internet aloqasini tekshiring va qayta urining.
    pause & exit /b 1
  )
  echo ok> "venv\.installed"
)
echo    baza tayyorlanmoqda ^(init_db^)...
call "venv\Scripts\python.exe" scripts\init_db.py
if errorlevel 1 (
  echo.
  echo XATO: baza tayyorlanmadi. backend\.env'dagi DATABASE_URL to'g'rimi va papkaga yozish huquqi bormi?
  pause & exit /b 1
)

REM --- 2) Frontend (CRM) sozlash (0.0.0.0:4444) ---------------------
echo ==^> Frontend ^(CRM^) sozlanmoqda...
cd /d "%~dp0frontend"
if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo    .env yaratildi -- API: https://ipak.elektronbozor.uz
)
if not exist "node_modules" (
  echo    npm paketlari o'rnatilmoqda ^(biroz vaqt olishi mumkin^)...
  call npm install
  if errorlevel 1 ( echo. & echo XATO: frontend npm paketlari o'rnatilmadi. & pause & exit /b 1 )
)

REM --- 3) Web (marketing sayt) sozlash (0.0.0.0:3535) --------------
echo ==^> Web sozlanmoqda...
cd /d "%~dp0web"
if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo    .env yaratildi ^(web^)
)
if not exist "node_modules" (
  echo    web npm paketlari o'rnatilmoqda...
  call npm install
  if errorlevel 1 ( echo. & echo XATO: web npm paketlari o'rnatilmadi. & pause & exit /b 1 )
)

REM --- 4) Backend portini backend\.env dan o'qish (standart 5555) --
set "PORT=5555"
for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0backend\.env") do (
  if /i "%%A"=="PORT" set "PORT=%%B"
)
set "PORT=%PORT: =%"

echo.
echo ======================================================
echo   Ipak Yo'li ishga tushmoqda
echo   Backend :  http://0.0.0.0:%PORT%        (API + /docs)
echo   Frontend:  http://0.0.0.0:4444        (CRM)
echo   Web     :  http://0.0.0.0:3535        (sayt)
echo   Domen   :  https://ipak.elektronbozor.uz  (CRM + API)
echo   Admin   :  admin@ipakyoli.uz / admin12345
echo ======================================================
echo.

REM --- 5) Uch oynada ishga tushirish -------------------------------
cd /d "%~dp0backend"
start "Ipak Yo'li - Backend"  cmd /k venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port %PORT%
cd /d "%~dp0frontend"
start "Ipak Yo'li - Frontend" cmd /k npm run dev
cd /d "%~dp0web"
start "Ipak Yo'li - Web"      cmd /k npm start

echo Uch oyna ochildi: Backend, Frontend (CRM), Web.
echo Frontend tayyor bo'lgach brauzerda http://localhost:4444 ni oching.
echo Dasturni to'xtatish uchun ochilgan uchala oynani yoping.
echo.
pause
endlocal
