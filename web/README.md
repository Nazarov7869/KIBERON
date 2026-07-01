# Ipak Yo'li — web sayti (Node.js / Express)

Milliy agroeksport platformasining marketing sayti. **Server-side 4 til**
(O'zbek lotin, O'zbek kirill, Rus, Ingliz), professional animatsiyalar, ariza
(lead) formasi va Android ilovani yuklab olish. Ko'k palitrada.

## Texnologiya
Node.js (Express) · EJS (server-side render) · Helmet · Compression · Morgan ·
express-rate-limit. Tashqi framework yo'q — sof, tez, SEO-ga mos.

## Ishga tushirish
```bash
npm install
cp .env.example .env      # sozlamalarni to'ldiring
npm run dev               # ishlab chiqish (nodemon)
# yoki
npm start                 # ishlab chiqarish
```
Sayt: `http://localhost:3000`

## Tillar (URL'lar)
`/` (O'zbek) · `/cy` (Kirill) · `/ru` (Rus) · `/en` (Ingliz).
Har til alohida to'liq render bo'ladi — SEO uchun `hreflang` va `canonical`
teglar avtomatik qo'yiladi. Til almashtirgich yuqori o'ng burchakda.

## Sozlash (.env)
| O'zgaruvchi | Vazifasi |
|---|---|
| `PORT` | Server porti (3000) |
| `SITE_URL` | To'liq domen (canonical/hreflang uchun) |
| `LOGIN_URL` | CRM/login manzili (masalan `https://app.ipakyoli.uz`) |
| `ANDROID_APK_FILE` | `public/downloads/` ichidagi APK fayl nomi |
| `CONTACT_EMAIL` | Footer'dagi email |

## Android APK
Ilovani build qilib, APK'ni `public/downloads/ipak-yoli.apk` ga qo'ying.
Sayt uni `/download/android` orqali beradi ("Android APK" tugmasi).

## API
- `GET /healthz` — sog'liq tekshiruvi (JSON)
- `GET /download/android` — APK yuklab olish
- `POST /api/contact` — ariza (name, phone, message) → `data/leads.json` ga saqlanadi (rate-limit: 15 daqiqada 20 ta)

## Statik eksport (ixtiyoriy)
CDN yoki oddiy hosting uchun har tilni **self-contained** (inline CSS/JS) HTML
ga eksport qilish:
```bash
npm run build:static      # -> dist/index.html, cy.html, ru.html, en.html
```

## Tuzilma
```
ipak-web/
├─ server.js                 # Express ilova
├─ src/
│  ├─ config.js              # .env sozlamalari
│  ├─ i18n/                  # uz, cy, ru, en + index (meta, bayroqlar)
│  └─ routes/                # pages.js (sahifalar) · api.js (API)
├─ views/index.ejs           # asosiy shablon (server render)
├─ public/
│  ├─ css/styles.css         # dizayn (ko'k palitra)
│  ├─ js/main.js             # mijoz interaktivligi
│  └─ downloads/             # APK shu yerga
└─ scripts/build-static.js   # statik eksport
```

## Dizayn — ko'k palitra
`#06283D` navy · `#1363DF` kobalt (asosiy) · `#47B5FF` yorqin ko'k (urg'u) ·
`#DFF6FF` och ko'k. Shriftlar: Unbounded (sarlavha) + Manrope (matn), Kiril
qo'llab-quvvatlanadi. `prefers-reduced-motion` hurmat qilinadi.
