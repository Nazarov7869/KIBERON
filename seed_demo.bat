@echo off
REM =====================================================================
REM  seed_demo.bat - Ipak Yo'li: barcha bo'limlarga to'liq DEMO ma'lumot
REM  Backend ISHGA TUSHGAN bo'lishi kerak (avval start.bat ni ishlating).
REM =====================================================================
setlocal
cd /d "%~dp0backend"

REM venv python bo'lsa o'shani, bo'lmasa tizim python'ini ishlatamiz
REM (seed_demo.py faqat standart kutubxonalardan foydalanadi)
set "PY=python"
if exist "venv\Scripts\python.exe" set "PY=venv\Scripts\python.exe"

echo ==^> Demo ma'lumot qo'shilmoqda ^(backend ochiq turishi kerak^)...
call "%PY%" scripts\seed_demo.py
echo.
pause
endlocal
