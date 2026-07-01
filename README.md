<p align="center">
<img src="assets/banner.png" width="100%">
</p>

<h1 align="center">
🚀 KIBERON
</h1>

<p align="center">

<b>Ipak Yo'li platformasi uchun logistika va savdo boshqaruv tizimi</b>

</p>

<p align="center">

Eksport • Import • Logistika • Ombor • Analitika • Elektron Hujjatlar

</p>

<p align="center">

<a href="https://saytingiz.uz">
<img src="https://img.shields.io/badge/🌐_Rasmiy_Sayt-22c55e?style=for-the-badge">
</a>

<a href="https://saytingiz.uz/docs">
<img src="https://img.shields.io/badge/📚_API_Documentation-0ea5e9?style=for-the-badge">
</a>

<a href="https://github.com/Nazarov7869/KIBERON">
<img src="https://img.shields.io/badge/💻_GitHub-181717?style=for-the-badge&logo=github">
</a>

</p>

---

# 📖 Loyiha haqida

**KIBERON** — eksport, import va logistika jarayonlarini yagona platforma orqali boshqarishga mo'ljallangan zamonaviy axborot tizimi.

Loyiha logistika kompaniyalari, eksportyorlar, importyorlar va korxonalar uchun ishlab chiqilgan bo'lib, yuklarni boshqarish, buyurtmalarni kuzatish, elektron hujjatlar bilan ishlash va biznes jarayonlarini avtomatlashtirish imkonini beradi.

Backend qismi **FastAPI** asosida ishlab chiqilgan bo'lib, yuqori tezlik, xavfsizlik va kengaytirish imkoniyatlarini ta'minlaydi.

---

# ✨ Asosiy imkoniyatlar

| 🚚 Logistika | 📦 Buyurtmalar |
|-------------|----------------|
| Yuklarni boshqarish | Buyurtmalarni real vaqt rejimida kuzatish |

| 📄 Elektron hujjatlar | 👤 Foydalanuvchilar |
|----------------------|--------------------|
| Hujjatlarni boshqarish | Rollar va ruxsatlar |

| 🔐 Xavfsizlik | 📊 Analitika |
|--------------|--------------|
| JWT Authentication | Hisobotlar va statistika |

| 📱 Mobil ilova | ⚡ REST API |
|---------------|-------------|
| Flet asosida | Yuqori unumdor API |

---

# 🛠 Texnologiyalar

<p align="center">

<img src="https://skillicons.dev/icons?i=python,fastapi,postgres,docker,git,github,vscode"/>

</p>

| Backend | Ma'lumotlar bazasi | Mobil ilova |
|----------|-------------------|-------------|
| Python | PostgreSQL | Flet |
| FastAPI | SQLite | Python |
| SQLAlchemy | Alembic | Android |

---

# 🏗 Tizim arxitekturasi

```text
                   📱 Mobil ilova
                          │
                          ▼
                 ⚡ FastAPI REST API
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
        PostgreSQL             Fayllar xizmati
```

---

# 📁 Loyiha tuzilishi

```text
KIBERON/

├── assets/
│   ├── banner.png
│   ├── dashboard.png
│   ├── login.png
│   └── demo.gif
│
├── backend/
│   ├── app/
│   ├── api/
│   ├── core/
│   ├── database/
│   ├── models/
│   ├── routers/
│   ├── schemas/
│   ├── services/
│   └── main.py
│
├── mobile/
│
├── requirements.txt
│
└── README.md
```

---

# 🚀 Loyihani ishga tushirish

### 1️⃣ Repository'ni yuklab oling

```bash
git clone https://github.com/Nazarov7869/KIBERON.git
```

### 2️⃣ Loyiha papkasiga kiring

```bash
cd KIBERON
```

### 3️⃣ Virtual muhit yarating

```bash
python -m venv venv
```

### 4️⃣ Virtual muhitni faollashtiring

Windows

```bash
venv\Scripts\activate
```

Linux / macOS

```bash
source venv/bin/activate
```

### 5️⃣ Kutubxonalarni o'rnating

```bash
pip install -r requirements.txt
```

### 6️⃣ Serverni ishga tushiring

```bash
uvicorn app.main:app --reload
```

yoki

```bash
python main.py
```

---

# 📚 API Hujjatlari

Swagger

```
http://localhost:8000/docs
```

ReDoc

```
http://localhost:8000/redoc
```

---

# 🔒 Xavfsizlik

- JWT Authentication
- Parollarni Hashlash
- Token Validatsiyasi
- Rollarga asoslangan ruxsatlar
- REST API himoyasi

---

# 📌 Kelajakdagi rejalar

- 🤖 Sun'iy intellekt yordamida tavsiyalar
- 🌍 Ko'p tilli interfeys
- 📱 Android va iOS ilovalari
- ☁️ Cloud Storage
- 📈 Batafsil analitika
- 🔔 Real vaqt bildirishnomalari

---

# 🤝 Hamkorlik

Loyihani rivojlantirishda ishtirok etishni istasangiz:

- Repository'ni Fork qiling
- Yangi Branch yarating
- O'zgartirishlarni kiriting
- Commit qiling
- Pull Request yuboring

---

# 📄 Litsenziya

Ushbu loyiha **MIT License** asosida tarqatiladi.

---

<div align="center">

# ⭐ KIBERON

Agar loyiha sizga foydali bo'lgan bo'lsa,

GitHub'da ⭐ **Star** bosishni unutmang.

<br>

<a href="https://saytingiz.uz">
<img src="https://img.shields.io/badge/🌐_Rasmiy_Sayt-22c55e?style=for-the-badge">
</a>

<a href="https://github.com/Nazarov7869">
<img src="https://img.shields.io/badge/GitHub_Profil-181717?style=for-the-badge&logo=github">
</a>

<br><br>

Made with ❤️ by **Nazarov**

</div>
