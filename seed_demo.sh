#!/usr/bin/env bash
# =====================================================================
#  seed_demo.sh — Ipak Yo'li: barcha bo'limlarga to'liq DEMO ma'lumot
#  Backend ISHGA TUSHGAN bo'lishi kerak (avval ./start.sh ni ishlating).
# =====================================================================
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR/backend"

# venv python bo'lsa o'shani, bo'lmasa tizim python'ini ishlatamiz
# (seed_demo.py faqat standart kutubxonalardan foydalanadi)
if [ -x "venv/bin/python" ]; then
  PY="venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PY="python3"
else
  PY="python"
fi

echo "==> Demo ma'lumot qo'shilmoqda (backend ochiq turishi kerak)..."
exec "$PY" scripts/seed_demo.py
