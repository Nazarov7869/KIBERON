@echo off
REM =====================================================================
REM  Ipak Yo'li - bitta buyruq bilan backend + frontend (Windows)
REM  Ishlatish: start.bat faylini ikki marta bosing (yoki cmd'da ishga tushiring)
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

REM --- 1) Backend sozlash --------------------------------------------
echo ==^> Backend sozlanmoqda...
cd /d "%~dp0backend"
if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo    .env yaratildi ^(SQLite -- sozlash shart emas^)
)

REM venv + Python paketlari. O'rnatish tugallanmagan bo'lsa (.installed yo'q) qayta uriniladi.
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

REM --- 2) Frontend sozlash ------------------------------------------
echo ==^> Frontend sozlanmoqda...
cd /d "%~dp0frontend"
if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo    .env yaratildi
)
if not exist "node_modules" (
  echo    npm paketlari o'rnatilmoqda ^(biroz vaqt olishi mumkin^)...
  call npm install
  if errorlevel 1 (
    echo.
    echo XATO: npm paketlari o'rnatilmadi. Internet aloqasini tekshiring va qayta urining.
    pause & exit /b 1
  )
)

REM --- 3) Portni backend\.env dan o'qish (standart 4000) -------------
set "PORT=4000"
for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0backend\.env") do (
  if /i "%%A"=="PORT" set "PORT=%%B"
)
set "PORT=%PORT: =%"

echo.
echo ======================================================
echo   Ipak Yo'li ishga tushmoqda
echo   Backend :  http://localhost:%PORT%   (API + /docs)
echo   Frontend:  http://localhost:5173
echo   Admin   :  admin@ipakyoli.uz / admin12345
echo ======================================================
echo.

REM --- 4) Backend va Frontend ni ikki oynada ishga tushirish ---------
REM  Yangi oynalar joriy papkani meros oladi (shuning uchun oldin cd qilamiz).
cd /d "%~dp0backend"
start "Ipak Yo'li - Backend" cmd /k venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port %PORT%
cd /d "%~dp0frontend"
start "Ipak Yo'li - Frontend" cmd /k npm run dev

echo Ikki oyna ochildi: Backend va Frontend.
echo Frontend tayyor bo'lgach brauzerda http://localhost:5173 ni oching.
echo Dasturni to'xtatish uchun ochilgan ikkala oynani yoping.
echo.
pause
endlocal
