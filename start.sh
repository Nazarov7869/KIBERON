#!/usr/bin/env bash
# =====================================================================
#  Ipak Yo'li — bitta buyruq bilan backend + frontend
#  Ishlatish (Linux / macOS):   chmod +x start.sh && ./start.sh
# =====================================================================
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# --- 0) Talablar ------------------------------------------------------
command -v python3 >/dev/null 2>&1 || { echo "XATO: python3 topilmadi. Python 3.10+ o'rnating."; exit 1; }
command -v node   >/dev/null 2>&1 || { echo "XATO: node topilmadi. Node.js 18+ o'rnating."; exit 1; }
command -v npm    >/dev/null 2>&1 || { echo "XATO: npm topilmadi (Node.js bilan keladi)."; exit 1; }

# --- 1) Backend sozlash ----------------------------------------------
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

# --- 2) Frontend sozlash ---------------------------------------------
echo "==> Frontend sozlanmoqda..."
cd "$DIR/frontend"
if [ ! -f .env ]; then cp .env.example .env; echo "   .env yaratildi (.env.example'dan)"; fi
if [ ! -d node_modules ]; then
  echo "   npm paketlari o'rnatilmoqda (biroz vaqt olishi mumkin)..."
  npm install
fi

# --- 3) Port (backend/.env dan) --------------------------------------
PORT="$(grep -E '^PORT=' "$DIR/backend/.env" | head -1 | cut -d= -f2 | tr -d '[:space:]')"
[ -n "$PORT" ] || PORT=4000

# --- 4) Ikkalasini birga ishga tushirish -----------------------------
echo ""
echo "======================================================"
echo "  Ipak Yo'li ishga tushmoqda"
echo "  Backend :  http://localhost:$PORT   (API + /docs)"
echo "  Frontend:  http://localhost:5173"
echo "  Admin   :  admin@ipakyoli.uz / admin12345"
echo "  To'xtatish: Ctrl+C"
echo "======================================================"
echo ""

# Ctrl+C bosilganda ikkala jarayonni ham to'xtatadi
trap 'echo; echo "To'\''xtatilmoqda..."; kill 0' INT TERM

( cd "$DIR/backend"  && exec ./venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT" ) &
( cd "$DIR/frontend" && exec npm run dev -- --host ) &
wait
