#!/bin/bash
# =====================================================================
#  IPAK YO'LI — konteyner ICHIDA to'liq o'rnatish + ishga tushirish
#  Bitta skript. Dockerfile KERAK EMAS.
#  Loyiha papkasiga (backend/ frontend/ web/ yonига) qo'yib ishga tushiring.
#  Qayta ishga tushirsa ham xavfsiz (o'rnatilganini o'tkazadi, xizmatlarni qayta boshlaydi).
# =====================================================================
set -e

# ═══════════ SOZLAMALAR — shularni to'ldiring (yoki env bilan bering) ═══════════
DOMAIN="${DOMAIN:-elektronbozor.uz}"
DB_PASSWORD="${DB_PASSWORD:-KuchliParol_almashtiring}"
JWT_SECRET="${JWT_SECRET:-uzun-tasodifiy-secret-almashtiring}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"        # AI uchun; bo'sh bo'lsa AI o'chiq
# ════════════════════════════════════════════════════════════════════════════════

APP="$(cd "$(dirname "$0")" && pwd)"
PGDATA=/var/lib/postgresql/16/main
PGBIN=/usr/lib/postgresql/16/bin
LOG=/var/log/ipak
mkdir -p "$LOG"; chmod 777 "$LOG"    # postgres ham, root ham log yoza olsin
mkdir -p /tmp && chmod 1777 /tmp

echo "==> Ipak Yo'li ($APP)"

# ---- 1. Paketlar (faqat yo'q bo'lsa) ----
if ! command -v psql >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1 || ! command -v pip3 >/dev/null 2>&1; then
  echo "==> Paketlar o'rnatilmoqda: postgresql-16, python3, node20 ..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y --no-install-recommends \
    postgresql-16 postgresql-client-16 python3 python3-pip \
    curl ca-certificates gnupg >/dev/null
  if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
    apt-get install -y --no-install-recommends nodejs >/dev/null
  fi
  # Ubuntu avtomatik yaratgan klasterni o'chiramiz (bizniki yangisini yaratadi)
  pg_dropcluster --stop 16 main 2>/dev/null || true
  rm -rf "$PGDATA"; mkdir -p "$PGDATA"; chown -R postgres:postgres /var/lib/postgresql
  echo "==> Paketlar tayyor."
else
  echo "==> Paketlar bor — o'tkazildi."
fi

# ---- 2. Env ----
export DOMAIN DB_PASSWORD JWT_SECRET ANTHROPIC_API_KEY
export DATABASE_URL="postgresql://ipak:${DB_PASSWORD}@127.0.0.1:5432/ipak"
export FRONTEND_DIST="$APP/frontend/dist"
export CONTACT_EMAIL="${CONTACT_EMAIL:-info@ipakyoli.uz}"
export SITE_URL="https://ipak.$DOMAIN"
export LOGIN_URL="https://ipakadmin.$DOMAIN"
export ALLOWED_ORIGINS="https://ipak.$DOMAIN,https://ipakadmin.$DOMAIN,https://ipakapi.$DOMAIN,https://ipakmobil.$DOMAIN"

# ---- 3. PostgreSQL init (o'zar-yetarli klaster — postgresql.conf data papkada bo'lsa tayyor) ----
# Debian klasterida config /etc da bo'ladi -> data papkada postgresql.conf yo'q -> qayta yaratamiz
FRESH=0
if [ ! -f "$PGDATA/postgresql.conf" ]; then
  echo "==> PostgreSQL o'zar-yetarli klaster yaratilmoqda..."
  pg_dropcluster --stop 16 main 2>/dev/null || true   # apt o'rnatgan Debian klasterini o'chiramiz
  rm -rf "${PGDATA:?}/"* 2>/dev/null || true
  mkdir -p "$PGDATA"; chown postgres:postgres "$PGDATA"; chmod 700 "$PGDATA"
  # local=peer (parolsiz setup) · host=scram (TCP xavfsiz) — parol talab qilmaydi
  su postgres -c "$PGBIN/initdb -D $PGDATA --encoding=UTF8 --locale=C --auth-local peer --auth-host scram-sha-256" >/dev/null
  echo "listen_addresses = '127.0.0.1'" >> "$PGDATA/postgresql.conf"
  FRESH=1
fi

# ---- 4. PG start (ishlamayotgan bo'lsa) ----
if ! su postgres -c "$PGBIN/pg_ctl -D $PGDATA status" >/dev/null 2>&1; then
  echo "==> PostgreSQL ishga tushirilmoqda (127.0.0.1:5432, ichki)..."
  su postgres -c "$PGBIN/pg_ctl -D $PGDATA -o '-p 5432 -k /tmp' -w -t 60 -l $LOG/pg.log start"
fi

# ---- 5. Rol + baza (idempotent) ----
su postgres -c "psql -h /tmp -p 5432 -tAc \"SELECT 1 FROM pg_roles WHERE rolname='ipak'\"" | grep -q 1 || \
  su postgres -c "psql -h /tmp -p 5432 -c \"CREATE ROLE ipak LOGIN PASSWORD '${DB_PASSWORD}'\""
su postgres -c "psql -h /tmp -p 5432 -tAc \"SELECT 1 FROM pg_database WHERE datname='ipak'\"" | grep -q 1 || {
  su postgres -c "psql -h /tmp -p 5432 -c \"CREATE DATABASE ipak OWNER ipak\""
  FRESH=1
}

# ---- 6. Backend kutubxonalari (faqat yo'q bo'lsa) ----
if ! python3 -c "import uvicorn, fastapi, psycopg" >/dev/null 2>&1; then
  echo "==> Backend kutubxonalari o'rnatilmoqda (pip)..."
  pip3 install --break-system-packages --no-cache-dir -r "$APP/backend/requirements.txt" >/dev/null
fi

# ---- 7. Schema + seed (faqat birinchi marta — admin parolini qayta yozmaslik uchun) ----
if [ "$FRESH" = "1" ]; then
  echo "==> Schema + seed yuklanmoqda (12 mahsulot, 6 bozor, svetofor, admin)..."
  (cd "$APP/backend" && python3 scripts/init_db.py) || echo "   (init_db ogohlantirish — davom)"
else
  echo "==> Baza mavjud — seed o'tkazildi (ma'lumot saqlanadi)."
fi

# ---- 8. React CRM build (faqat yo'q bo'lsa) ----
if [ ! -f "$APP/frontend/dist/index.html" ]; then
  echo "==> React CRM build qilinmoqda (VITE_API_URL=/api)..."
  (cd "$APP/frontend" && npm ci >/dev/null && VITE_API_URL=/api npm run build >/dev/null)
fi

# ---- 9. Marketing sayt kutubxonalari (faqat yo'q bo'lsa) ----
if [ ! -d "$APP/web/node_modules" ]; then
  echo "==> Marketing sayt kutubxonalari o'rnatilmoqda (npm)..."
  (cd "$APP/web" && npm ci --omit=dev >/dev/null)
fi

# ---- 10. Eski jarayonlarni to'xtatish (qayta ishga tushirish) ----
pkill -f "uvicorn app.main" 2>/dev/null || true
pkill -f "web/server.js"    2>/dev/null || true
sleep 1

# ---- 11. Ishga tushirish (nohup — ssh/exec yopilsa ham ishlaydi) ----
echo "==> Marketing web ishga tushmoqda (3535)..."
nohup env NODE_ENV=production PORT=3535 node "$APP/web/server.js" >"$LOG/web.log" 2>&1 &
echo "==> Backend API + CRM ishga tushmoqda (4444)..."
( cd "$APP/backend" && nohup uvicorn app.main:app --host 0.0.0.0 --port 4444 \
    --proxy-headers --forwarded-allow-ips="*" >"$LOG/api.log" 2>&1 & )

sleep 4
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  TAYYOR ✓"
echo "  API + CRM : http://127.0.0.1:4444   log: $LOG/api.log"
echo "  Marketing : http://127.0.0.1:3535   log: $LOG/web.log"
echo "  PostgreSQL: 127.0.0.1:5432 (ichki)  log: $LOG/pg.log"
echo "  CRM kirish: admin@ipakyoli.uz / admin12345"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "  Tekshirish:"
echo "    curl localhost:4444/health"
echo "    curl localhost:4444/health/db"
echo "    curl localhost:3535/healthz"
echo ""
echo "  Domen (host'da, domctl bilan):"
echo "    domctl add ipakadmin.$DOMAIN 127.0.0.1:4444"
echo "    domctl add ipakapi.$DOMAIN   127.0.0.1:4444"
echo "    domctl add ipak.$DOMAIN      127.0.0.1:3535"
