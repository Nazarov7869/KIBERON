// Ipak Yo'li — sayt konfiguratsiyasi (.env orqali sozlanadi)
require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  siteUrl: (process.env.SITE_URL || 'https://ipakyoli.uz').replace(/\/$/, ''),

  // CRM/login manzili (masalan https://app.ipakyoli.uz yoki /app)
  loginUrl: process.env.LOGIN_URL || '#',

  // Android APK: public/downloads/ ichidagi fayl nomi
  androidApkFile: process.env.ANDROID_APK_FILE || 'ipak-yoli.apk',
  androidUrl: '/download/android',

  contactEmail: process.env.CONTACT_EMAIL || 'info@ipakyoli.uz',

  // Katalog statistikasi (backend seed bilan mos)
  stats: { products: 12, markets: 6, corridors: 6, roles: 6 },

  year: new Date().getFullYear(),
};
