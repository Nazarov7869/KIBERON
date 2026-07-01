// Ipak Yo'li — i18n markazi (server-side render uchun)
const uz = require('./uz');
const cy = require('./cy');
const ru = require('./ru');
const en = require('./en');

const LOCALES = { uz, cy, ru, en };

// Bayroqlar (inline SVG) — flagsiz JS ham ko'rinadi
const FLAGS = {
  uz: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/><rect width="30" height="6" fill="#0099B5"/><rect y="14" width="30" height="6" fill="#1EB53A"/><rect y="6.3" width="30" height="0.9" fill="#CE1126"/><rect y="12.8" width="30" height="0.9" fill="#CE1126"/></svg>',
  ru: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/><rect y="6.7" width="30" height="6.6" fill="#0039A6"/><rect y="13.3" width="30" height="6.7" fill="#D52B1E"/></svg>',
  uk: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#012169"/><path d="M0,0 30,20 M30,0 0,20" stroke="#fff" stroke-width="4"/><path d="M0,0 30,20 M30,0 0,20" stroke="#C8102E" stroke-width="2"/><path d="M15,0 V20 M0,10 H30" stroke="#fff" stroke-width="6"/><path d="M15,0 V20 M0,10 H30" stroke="#C8102E" stroke-width="3.4"/></svg>',
};

// Har til uchun meta (URL, html lang, yorliq, bayroq, SEO)
const META = {
  uz: {
    code: 'uz', htmlLang: 'uz', path: '/', label: "O'Z", flag: 'uz',
    title: "Ipak Yo'li — Milliy agroeksport platformasi",
    description: "Kichik xo'jaliklar birlashib jahon bozoriga. Konteynerni birga to'ldiring, sifatdan o'ting va escrow to'lov bilan eksport qiling.",
  },
  cy: {
    code: 'cy', htmlLang: 'uz', path: '/cy', label: "Ў3", flag: 'uz',
    title: "Ипак Йўли — Миллий агроэкспорт платформаси",
    description: "Кичик хўжаликлар бирлашиб жаҳон бозорига. Контейнерни бирга тўлдиринг, сифатдан ўтинг ва escrow тўлов билан экспорт қилинг.",
  },
  ru: {
    code: 'ru', htmlLang: 'ru', path: '/ru', label: "РУ", flag: 'ru',
    title: "Ипак Йули — Национальная платформа агроэкспорта",
    description: "Малые хозяйства объединяются и выходят на мировой рынок. Заполните контейнер вместе, пройдите контроль качества и экспортируйте через escrow.",
  },
  en: {
    code: 'en', htmlLang: 'en', path: '/en', label: "EN", flag: 'uk',
    title: "Ipak Yo'li — National agri-export platform",
    description: "Small farms unite to reach the world market. Fill a container together, pass quality control and export with escrow settlement.",
  },
};

const SUPPORTED = ['uz', 'cy', 'ru', 'en'];
const ORDER = ['uz', 'cy', 'ru', 'en']; // switcher tartibi

function isSupported(lang) {
  return SUPPORTED.includes(lang);
}

// Accept-Language sarlavhasidan tilni aniqlash (uz standart)
function detect(acceptLanguage) {
  const s = (acceptLanguage || '').toLowerCase();
  if (s.startsWith('ru')) return 'ru';
  if (s.startsWith('en')) return 'en';
  return 'uz';
}

module.exports = { LOCALES, META, FLAGS, SUPPORTED, ORDER, isSupported, detect };
