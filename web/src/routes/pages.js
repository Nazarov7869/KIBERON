// Sahifa route'lari — landing va kalkulyator (har til uchun server render)
const express = require('express');
const router = express.Router();
const { LOCALES, META, FLAGS, ORDER, isSupported } = require('../i18n');
const config = require('../config');

const metaList = ORDER.map((c) => META[c]);

// ---- Landing ----
function renderLang(res, lang) {
  res.render('index', { lang, t: LOCALES[lang], meta: META[lang], metaList, FLAGS, config });
}

router.get('/', (req, res) => renderLang(res, 'uz'));
router.get('/uz', (req, res) => res.redirect(301, '/'));
router.get('/cy', (req, res) => renderLang(res, 'cy'));
router.get('/ru', (req, res) => renderLang(res, 'ru'));
router.get('/en', (req, res) => renderLang(res, 'en'));

// ---- Narx kalkulyatori ----
const calcPath = (c) => (c === 'uz' ? '/calculator' : '/calculator/' + c);
const calcList = ORDER.map((c) => ({
  code: c, label: META[c].label, flag: META[c].flag, htmlLang: META[c].htmlLang, path: calcPath(c),
}));

function renderCalc(res, lang) {
  res.render('calculator', {
    lang,
    t: LOCALES[lang],
    config,
    FLAGS,
    htmlLang: META[lang].htmlLang,
    homeHref: META[lang].path,
    currentPath: calcPath(lang),
    calcList,
  });
}

router.get('/calculator', (req, res) => renderCalc(res, 'uz'));
router.get('/calculator/:lang', (req, res, next) => {
  const l = req.params.lang;
  if (l === 'uz') return res.redirect(301, '/calculator');
  if (!isSupported(l)) return next();
  renderCalc(res, l);
});

module.exports = router;
