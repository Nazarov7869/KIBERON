#!/usr/bin/env bash
# =====================================================================
#  Ipak Yo'li — bitta buyruq bilan uch qism (backend + frontend CRM + web)
#  Ishlatish (Linux / macOS):   chmod +x start.sh && ./start.sh
#  Manzillar:
#    Backend  : 0.0.0.0:5555   (API)
#    Frontend : 0.0.0.0:4444   (CRM,  domen: ipak.elektronbozor.uz)
#    Web      : 0.0.0.0:3535   (marketing sayt)
# =====================================================================
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# --- 0) Talablar ------------------------------------------------------
command -v python3 >/dev/null 2>&1 || { echo "XATO: python3 topilmadi. Python 3.10+ o'rnating."; exit 1; }
command -v node   >/dev/null 2>&1 || { echo "XATO: node topilmadi. Node.js 18+ o'rnating."; exit 1; }
command -v npm    >/dev/null 2>&1 || { echo "XATO: npm topilmadi (Node.js bilan keladi)."; exit 1; }

# --- 0b) Portlarni bo'shatish (oldingi ishga tushirish qolgan bo'lsa) ---
# 5555/4444/3535 band bo'lsa (EADDRINUSE), egallab turgan jarayonni to'xtatamiz.
free_port() {
  local port="$1" pids=""
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" >/dev/null 2>&1 && { echo "   port $port bo'shatildi"; sleep 0.3; }
    return
  fi
  if command -v lsof >/dev/null 2>&1; then
    pids=$(lsof -ti "tcp:${port}" 2>/dev/null || true)
  elif command -v ss >/dev/null 2>&1; then
    pids=$(ss -ltnpH "sport = :${port}" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
  fi
  if [ -n "$pids" ]; then
    echo "   port $port band edi — to'xtatilmoqda (PID: $pids)"
    kill $pids 2>/dev/null || true
    sleep 0.4
    kill -9 $pids 2>/dev/null || true
  else
    # zaxira: sof Python (/proc) — fuser/lsof/ss bo'lmasa
    python3 "$DIR/freeport.py" "$port" 2>/dev/null || true
  fi
}
for p in 5555 4444 3535; do free_port "$p"; done

# --- 1) Backend sozlash (0.0.0.0:5555) -------------------------------
echo "==> Backend sozlanmoqda..."
cd "$DIR/backend"
if [ ! -f .env ]; then cp .env.example .env; echo "   .env yaratildi (.env.example'dan) — SQLite, sozlash shart emas"; fi
if [ ! -d venv ]; then
  echo "   virtual muhit (venv) yaratilmoqda..."
  python3 -m venv venv
  ./venv/bin/python -m pip install --upgrade pip >/dev/null
  echo "   Python bog'liqliklari o'rnatilmoqda..."
  ./venv/bin/python -m pip install -r requirements.txt
fi
echo "   baza tayyorlanmoqda (init_db)..."
./venv/bin/python scripts/init_db.py

# --- 2) Frontend (CRM) sozlash (0.0.0.0:4444) ------------------------
echo "==> Frontend (CRM) sozlanmoqda..."
cd "$DIR/frontend"
if [ ! -f .env ]; then cp .env.example .env; echo "   .env yaratildi — API: https://ipak.elektronbozor.uz"; fi
if [ ! -d node_modules ]; then
  echo "   npm paketlari o'rnatilmoqda (biroz vaqt olishi mumkin)..."
  npm install
fi

# --- 3) Web (marketing sayt) sozlash (0.0.0.0:3535) ------------------
echo "==> Web sozlanmoqda..."
cd "$DIR/web"
if [ ! -f .env ]; then cp .env.example .env; echo "   .env yaratildi (web)"; fi
if [ ! -d node_modules ]; then
  echo "   web npm paketlari o'rnatilmoqda..."
  npm install
fi

# --- 4) Backend porti (.env dan) -------------------------------------
PORT="$(grep -E '^PORT=' "$DIR/backend/.env" | head -1 | cut -d= -f2 | tr -d '[:space:]')"
[ -n "$PORT" ] || PORT=5555

echo ""
echo "======================================================"
echo "  Ipak Yo'li ishga tushmoqda"
echo "  Backend :  http://0.0.0.0:$PORT        (API + /docs)"
echo "  Frontend:  http://0.0.0.0:4444        (CRM)"
echo "  Web     :  http://0.0.0.0:3535        (sayt)"
echo "  Domen   :  https://ipak.elektronbozor.uz  (CRM + API)"
echo "  Admin   :  admin@ipakyoli.uz / admin12345"
echo "  To'xtatish: Ctrl+C"
echo "======================================================"
echo ""

# Ctrl+C bosilganda barcha jarayonlarni to'xtatadi
trap 'echo; echo "To'\''xtatilmoqda..."; kill $BACK_PID $FRONT_PID $WEB_PID 2>/dev/null; kill 0 2>/dev/null' INT TERM

( cd "$DIR/backend"  && exec ./venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT" ) &
BACK_PID=$!
( cd "$DIR/frontend" && exec npm run dev ) &
FRONT_PID=$!
( cd "$DIR/web"      && exec npm start ) &
WEB_PID=$!
wait
