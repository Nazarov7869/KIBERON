// API route'lari — sog'liq, APK yuklab olish, ariza (lead)
const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const config = require('../config');

// Sog'liq tekshiruvi
router.get('/healthz', (req, res) => {
  res.json({ ok: true, service: 'ipak-web', env: config.nodeEnv, ts: Date.now() });
});

// Android APK yuklab olish
router.get('/download/android', (req, res) => {
  const file = path.join(__dirname, '..', '..', 'public', 'downloads', config.androidApkFile);
  if (fs.existsSync(file)) {
    return res.download(file, config.androidApkFile);
  }
  res.status(404).json({
    ok: false,
    error: "APK hali joylanmagan. Faylni public/downloads/ ga qo'ying.",
  });
});

// Ariza (lead) — oddiy JSON faylga saqlash
router.post('/api/contact', (req, res) => {
  const { name, phone, message } = req.body || {};
  const nm = String(name || '').trim();
  const ph = String(phone || '').trim();
  if (nm.length < 2 || ph.length < 5) {
    return res.status(400).json({ ok: false, error: "Ism va telefon to'g'ri kiritilishi shart." });
  }
  const lead = {
    name: nm.slice(0, 120),
    phone: ph.slice(0, 40),
    message: String(message || '').trim().slice(0, 1000),
    ts: new Date().toISOString(),
    ip: req.ip,
  };
  try {
    const dir = path.join(__dirname, '..', '..', 'data');
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, 'leads.json');
    const arr = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
    arr.push(lead);
    fs.writeFileSync(f, JSON.stringify(arr, null, 2));
  } catch (e) {
    console.error('lead save error:', e.message);
    return res.status(500).json({ ok: false, error: 'Server xatosi. Keyinroq urinib koʻring.' });
  }
  res.json({ ok: true });
});

module.exports = router;
