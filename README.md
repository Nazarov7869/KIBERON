# Ipak Yo'li — milliy agroeksport CRM

Jizzax viloyat hokimligi ishonchi ostidagi **eksportni birlashtirish (pooling)** platformasi:
kichik korxonalar bitta konteynerni birga to'ldiradi, ball asosida taqsimlanadi,
escrow orqali xavfsiz to'lov amalga oshadi. Backend (FastAPI + SQLite) va
Frontend (React + Vite) — bitta papkada, bitta buyruq bilan ishga tushadi.

## Talablar (bir marta o'rnatiladi)
- **Python 3.10+**  → https://www.python.org  (Windows'da "Add Python to PATH" ni belgilang)
- **Node.js 18+**   → https://nodejs.org  (npm bilan birga keladi)

## Ishga tushirish

**Linux / macOS**
```bash
chmod +x start.sh
./start.sh
```

**Windows** — `start.bat` faylini ikki marta bosing (yoki `cmd`da ishga tushiring).

Skript hammasini avtomatik bajaradi:
1. `backend/.env` va `frontend/.env` ni namunadan yaratadi (agar yo'q bo'lsa)
2. Python `venv` yaratib, bog'liqliklarni o'rnatadi
3. Bazani tayyorlaydi — SQLite fayli (`backend/ipak.db`), sxema, boshlang'ich ma'lumot va super-admin paroli (`init_db.py`, idempotent)
4. `npm install` (frontend paketlari)
5. **Backend + Frontend ni birga ishga tushiradi**

So'ng oching:
- **Frontend:** http://localhost:5173
- **Backend API + Swagger:** http://localhost:4000/docs
- **Kirish (super-admin):** `admin@ipakyoli.uz` / `admin12345`

> Super-admin sifatida kiring → **Xodimlar**dan elchixona/logistika/ombor foydalanuvchi yarating,
> **Korxonalar**dan ishtirokchilarni tasdiqlang. Eksportyor va importyor esa o'zi ro'yxatdan o'tadi.

## Demo ma'lumot (ixtiyoriy)

Dasturning **barcha bo'limlarini** namuna ma'lumot bilan to'ldirish uchun (korxonalar,
barcha roldagi foydalanuvchilar, lotlar, pool'lar, buyurtmalar — to'liq hayotiy sikl,
leadlar, sug'urta/hujjat/reyting/nizo):

1. Avval dasturni ishga tushiring (`./start.sh` yoki `start.bat`) — backend ochiq turishi kerak.
2. So'ng demo skriptini ishga tushiring:
   - **Linux / macOS:** `./seed_demo.sh`
   - **Windows:** `seed_demo.bat` faylini ikki marta bosing

Skript ishlagach barcha rollar uchun demo login chiqadi (barcha parol: `demo1234`), masalan:
eksportyor `zarafshon@demo.uz`, importyor `dubai@demo.uz`, logistika `logistika@demo.uz`,
elchixona `elchixona@demo.uz`, ombor `ombor@demo.uz`. Shu foydalanuvchilar bilan kirib,
har bir panelni to'la ma'lumot bilan ko'rishingiz mumkin.

> Demo ma'lumotni tozalab, boshidan boshlash uchun: `backend/ipak.db` faylini o'chiring va
> dasturni qayta ishga tushiring (baza toza holda qayta quriladi).

## Sozlash

Baza — tashqi server talab qilmaydigan **SQLite** fayli. Standart holatda `backend/ipak.db`
avtomatik yaratiladi; hech narsa sozlash shart emas. Fayl joyini o'zgartirmoqchi bo'lsangiz,
`backend/.env` dagi `DATABASE_URL` ni tahrirlang:
```
DATABASE_URL=sqlite:///./ipak.db
```
Backend portini o'zgartirsangiz (`PORT`), `frontend/.env` dagi `VITE_API_URL` ni ham
shu portga moslang.

AI maslahatchini yoqish uchun `backend/.env` ga kalit qo'shing (`ANTHROPIC_API_KEY`,
`OPENAI_API_KEY`, `GEMINI_API_KEY` yoki `AI_API_KEY`+`AI_BASE_URL`). Kalitsiz ham
maslahatchining "faqat kontekst" rejimi ishlaydi.

## Papka tuzilishi
```
ipak-yoli/
├─ backend/        FastAPI + SQLite (47 endpoint)
│  ├─ app/         routerlar, pooling/settlement/advisor dvigatellari, xavfsizlik
│  ├─ db/          schema_sqlite.sql, seed_sqlite.sql
│  └─ scripts/     init_db.py (bootstrap), seed_demo.py (demo), set_password.py
├─ frontend/       React + Vite (Koshin dizayn, 6 rol paneli)
│  └─ src/         sahifalar, komponentlar, API mijoz
├─ start.sh        Linux/macOS ishga tushirgich
├─ start.bat       Windows ishga tushirgich
├─ seed_demo.sh    Demo ma'lumot (Linux/macOS) — backend ochiq turishi kerak
└─ seed_demo.bat   Demo ma'lumot (Windows)
```

## Qo'lda ishga tushirish (ixtiyoriy)
```bash
# backend
cd backend && python -m venv venv && ./venv/bin/python -m pip install -r requirements.txt
cp .env.example .env            # SQLite — sozlash shart emas
./venv/bin/python scripts/init_db.py
./venv/bin/python -m uvicorn app.main:app --port 4000

# frontend (yangi terminal)
cd frontend && npm install && cp .env.example .env && npm run dev
```
