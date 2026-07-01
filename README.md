<div align="center">

# 🚀 KIBERON

### Ipak Yo'li platformasi uchun zamonaviy logistika va savdo boshqaruv tizimi

Eksport • Import • Logistika • Ombor • Hujjatlar • Analitika

<br>

<a href="https://saytingiz.uz">
<img src="https://img.shields.io/badge/🌐_Rasmiy_Sayt-22C55E?style=for-the-badge">
</a>

<a href="https://saytingiz.uz/docs">
<img src="https://img.shields.io/badge/📚_API_Hujjatlari-0EA5E9?style=for-the-badge">
</a>

<a href="https://github.com/Nazarov7869/KIBERON">
<img src="https://img.shields.io/badge/💻_GitHub_Loyiha-181717?style=for-the-badge&logo=github">
</a>

</div>

---

# 📖 Loyiha haqida

**KIBERON** — eksport va import jarayonlarini boshqarish, logistika xizmatlarini avtomatlashtirish hamda mijozlar bilan ishlashni yagona platformada birlashtiruvchi zamonaviy boshqaruv tizimi.

Loyiha korxonalar, logistika kompaniyalari va tadbirkorlar uchun ishlab chiqilgan bo'lib, barcha asosiy biznes jarayonlarini raqamlashtirishni maqsad qiladi.

Platforma yuqori tezlik, xavfsizlik va foydalanish qulayligini ta'minlash uchun **FastAPI** texnologiyasi asosida ishlab chiqilgan.

---

# ✨ Asosiy imkoniyatlari

* 🚚 Logistika jarayonlarini boshqarish
* 📦 Buyurtmalarni kuzatish
* 📄 Elektron hujjatlar bilan ishlash
* 👤 Foydalanuvchilar va rollarni boshqarish
* 🔐 JWT autentifikatsiyasi
* 📊 Analitika va hisobotlar
* 🔔 Bildirishnomalar
* 📱 Mobil ilova bilan integratsiya
* ⚡ REST API xizmatlari

---

# 🛠 Texnologiyalar

### Backend

* Python
* FastAPI
* SQLAlchemy
* Alembic

### Ma'lumotlar bazasi

* PostgreSQL
* SQLite

### Mobil ilova

* Python
* Flet

### Qo'shimcha vositalar

* Git
* GitHub
* Docker

---

# 🏗 Tizim arxitekturasi

```text
            Mobil Ilova
                 │
                 ▼
        FastAPI REST API
                 │
        ┌────────┴────────┐
        ▼                 ▼
 PostgreSQL         Fayllar xizmati
```

---

# 📂 Loyiha tuzilishi

```text
KIBERON/

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

### 1. Loyihani yuklab olish

```bash
git clone https://github.com/Nazarov7869/KIBERON.git
```

### 2. Loyiha papkasiga kirish

```bash
cd KIBERON
```

### 3. Virtual muhit yaratish

```bash
python -m venv venv
```

### 4. Virtual muhitni faollashtirish

Windows

```bash
venv\Scripts\activate
```

Linux / macOS

```bash
source venv/bin/activate
```

### 5. Kutubxonalarni o'rnatish

```bash
pip install -r requirements.txt
```

### 6. Serverni ishga tushirish

```bash
uvicorn app.main:app --reload
```

yoki

```bash
python main.py
```

---

# 📚 API hujjatlari

Server ishga tushgandan so'ng:

### Swagger UI

```
http://localhost:8000/docs
```

### ReDoc

```
http://localhost:8000/redoc
```

---

# 🔒 Xavfsizlik

Loyiha quyidagi xavfsizlik mexanizmlaridan foydalanadi:

* JWT Authentication
* Password Hashing
* Role Based Access
* Token Validation
* API Security

---

# 📌 Kelajakdagi rejalar

* 🤖 Sun'iy intellekt yordamida tavsiyalar
* 🌍 Ko'p tilli interfeys
* 📱 Android va iOS ilovalari
* 📈 Batafsil analitika
* ☁️ Bulutli saqlash
* 🔔 Real vaqt bildirishnomalari

---

# 🤝 Hamkorlik

Loyihani rivojlantirishda ishtirok etmoqchi bo'lsangiz:

1. Repository'ni Fork qiling.
2. Yangi Branch yarating.
3. O'zgartirishlarni kiriting.
4. Commit va Push qiling.
5. Pull Request yuboring.

---

# 📄 Litsenziya

Ushbu loyiha **MIT License** asosida tarqatiladi.

---

<div align="center">

## ⭐ KIBERON loyihasini qo'llab-quvvatlang

Agar loyiha sizga foydali bo'lgan bo'lsa, GitHub'da ⭐ **Star** bosishni unutmang.

### Made with ❤️ by Nazarov

</div>
