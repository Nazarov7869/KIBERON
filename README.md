# Ipak Yo'li — milliy agroeksport CRM

Jizzax viloyat hokimligi ishonchi ostidagi **eksportni birlashtirish (pooling)** platformasi:
kichik korxonalar bitta konteynerni birga to'ldiradi, ball asosida taqsimlanadi,
escrow orqali xavfsiz to'lov amalga oshadi. Uch qism — **Backend** (FastAPI + SQLite),
**Frontend CRM** (React + Vite) va **Web** (marketing sayt, Express) — bitta papkada,
bitta buyruq bilan ishga tushadi.

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
4. `npm install` (frontend + web paketlari)
5. **Uch qismni birga ishga tushiradi**

Manzillar (barchasi `0.0.0.0` da tinglaydi):
- **Frontend CRM:** http://localhost:4444   (domenda: https://ipak.elektronbozor.uz)
- **Backend API + Swagger:** http://localhost:5555/docs
- **Web (marketing sayt):** http://localhost:3535
- **Kirish (super-admin):** `admin@ipakyoli.uz` / `admin12345`

> **Domenlar.** CRM `https://ipak.elektronbozor.uz` da, API `https://ipakapi.elektronbozor.uz`
> da ishlaydi. Buning uchun nginx: `ipak.elektronbozor.uz` -> **frontend:4444**,
> `ipakapi.elektronbozor.uz` -> **backend:5555** (quyida "Domen / teskari-proksi" bo'limiga qarang).

> Super-admin sifatida kiring → **Xodimlar**dan elchixona/logistika/ombor foydalanuvchi yarating,
> **Korxonalar**dan ishtirokchilarni tasdiqlang. Eksportyor va importyor esa o'zi ro'yxatdan o'tadi.

## Karta (sputnik) — lokatsiya va yo'nalish takliflari

- **Karta** (chap menyu, barcha rollar) — bepul **sputnik karta** (Esri World Imagery, API kaliti kerak emas).
- Har bir foydalanuvchi (sotuvchi/xaridor/ombor/logistika) **avval o'z manzilini kartada belgilaydi** —
  bu majburiy (kartani bosib yoki GPS orqali). Manzil `app_user`ga (eksportyorda `company`ga ham) saqlanadi.
- So'ng rolga mos nuqtalar ko'rinadi: omborlar (kod + bo'sh joy), logistika firmalari (kod + turlari),
  bozorlar (tarif + koridor), hamkorlar (sotuvchi/xaridor).
- **Yo'nalish taklifi**: mahsulot + manzil bozorini tanlab, eng yaqin (mos) omborlar, koridor, unga xizmat
  qiluvchi logistika firmalari (kodlari bilan) va marshrut chizig'i (manzil → ombor → koridor → bozor)
  hamda umumiy masofa/kunlar hisoblab beriladi (haversine).
- Koordinatalar `init_db` bilan infratuzilmaga (ombor/logistika/bozor), `seed_demo` bilan demo korxona/
  foydalanuvchilarga to'liq qo'shiladi. Yangi ustunlar mavjud bazalarga ham avtomatik qo'shiladi (migratsiya).

## Bozor tahlili va foydalanuvchilar

- **Bozor tahlili** (chap menyu, barcha rollar) — agroeksport mahsulotlari narx dinamikasi
  trading uslubidagi **candlestick** grafikda (USD/tonna), ticker kartalar va 30/90/180 kunlik
  davrlar bilan. Narx tarixi `init_db` bilan avtomatik (namuna) yuklanadi.
  Real O'zbekiston ma'lumotlarini `price_history` jadvaliga (CSV/JSON) yuklab, `source`
  ustunini `uzex`/`stat` qilib belgilasangiz — grafik avtomatik real ma'lumotni ko'rsatadi.
  Ochiq manbalar: **data.egov.uz** (CSV/JSON/XML), **stat.uz** (dehqon bozori narxlari),
  **uzex.uz** (birja indekslari), Qishloq xo'jaligi vazirligi (kunlik narxlar).
- **Foydalanuvchilar** (super-admin) — ro'yxatdan o'tgan barcha foydalanuvchilar ro'yxati
  (rol, korxona, tasdiq holati), rol bo'yicha filtr va qidiruv bilan. Parollar ko'rsatilmaydi.

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
Portlar: **backend** `backend/.env` dagi `PORT` (standart **5555**), **frontend** `frontend/vite.config.js`
dagi `server.port` (standart **4444**), **web** `web/.env` dagi `PORT` (standart **3535**). Frontend qaysi
API manziliga ulanishini `frontend/.env` dagi `VITE_API_URL` belgilaydi (standart
`https://ipakapi.elektronbozor.uz`). Uchala qism ham `0.0.0.0` da tinglaydi.

## Domen / teskari-proksi (nginx)

Ikki alohida (sub)domen ishlatiladi:
- **CRM** — `ipak.elektronbozor.uz` -> frontend (4444)
- **API** — `ipakapi.elektronbozor.uz` -> backend (5555)

CRM `ipak.elektronbozor.uz` da ochiladi, API so'rovlarini esa `https://ipakapi.elektronbozor.uz`
ga yuboradi (bu cross-origin, shuning uchun backendda CORS `ALLOWED_ORIGINS` ga CRM domeni qo'shilgan).
Har (sub)domen uchun alohida nginx server bloki:

```nginx
# 1) CRM  ->  frontend (4444)
server {
    listen 443 ssl;
    server_name ipak.elektronbozor.uz;

    ssl_certificate     /etc/letsencrypt/live/ipak.elektronbozor.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ipak.elektronbozor.uz/privkey.pem;

    location / {
        proxy_pass          http://127.0.0.1:4444;
        proxy_http_version  1.1;
        proxy_set_header    Upgrade $http_upgrade;
        proxy_set_header    Connection "upgrade";
        proxy_set_header    Host $host;
    }
}

# 2) API  ->  backend (5555)
server {
    listen 443 ssl;
    server_name ipakapi.elektronbozor.uz;

    ssl_certificate     /etc/letsencrypt/live/ipakapi.elektronbozor.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ipakapi.elektronbozor.uz/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:5555;
        proxy_set_header   Host $host;
        proxy_set_header   X-Forwarded-For $remote_addr;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

> Har ikki subdomen uchun DNS A-yozuvi serveringiz IP'siga, hamda SSL sertifikat kerak
> (masalan `certbot --nginx -d ipak.elektronbozor.uz -d ipakapi.elektronbozor.uz`).

Marketing sayt (web, 3535) alohida domen yoki subdomenga qo'yilishi mumkin
(masalan `elektronbozor.uz`) — xuddi shunday `proxy_pass http://127.0.0.1:3535;` bilan.

> **Ishlab chiqish (dev).** Domen shart emas: to'g'ridan-to'g'ri `http://localhost:4444` (CRM),
> `http://localhost:5555/docs` (API) va `http://localhost:3535` (sayt) ni oching. Bunda API'ga
> to'g'ridan-to'g'ri ulanish uchun `frontend/.env` dagi `VITE_API_URL` ni
> `http://localhost:5555` ga o'zgartiring.

AI maslahatchini yoqishning **eng oson yo'li** — super-admin sifatida kirib,
**Sozlamalar** bo'limidan AI provayder va API kalitini kiritish. Kalit bazada
saqlanadi, `.env` ni tahrirlash yoki serverni qayta ishga tushirish shart emas;
kiritilgach maslahatchi darhol ishlaydi. "Sinash" tugmasi kalit to'g'riligini tekshiradi.

Muqobil ravishda kalitni `backend/.env` orqali ham berish mumkin (`ANTHROPIC_API_KEY`,
`OPENAI_API_KEY`, `GEMINI_API_KEY` yoki `AI_API_KEY`+`AI_BASE_URL`). Admin paneldagi
kalit `.env` dan ustun turadi. Kalitsiz ham maslahatchining "faqat kontekst" rejimi ishlaydi.

> **Portlar band bo'lsa.** `start.sh`/`start.bat` ishga tushishdan oldin 5555/4444/3535
> portlarini avtomatik bo'shatadi. Qo'lda to'xtatish uchun `./stop.sh` (yoki `stop.bat`).

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
