@echo off
REM Ipak Yo'li portlarini (5555/4444/3535) bo'shatadi
setlocal
for %%P in (5555 4444 3535) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P " ^| findstr LISTENING') do (
    echo port %%P -^> PID %%A to'xtatilmoqda
    taskkill /F /PID %%A >nul 2>&1
  )
)
echo Tayyor.
pause
endlocal
