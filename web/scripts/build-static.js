// Har tilni self-contained (inline CSS/JS) statik HTML ga eksport qiladi -> dist/
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { LOCALES, META, FLAGS, ORDER } = require('../src/i18n');
const config = require('../src/config');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'public/css/styles.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'public/js/main.js'), 'utf8');
const tpl = fs.readFileSync(path.join(root, 'views/index.ejs'), 'utf8');
const metaList = ORDER.map((c) => META[c]);
const distDir = path.join(root, 'dist');
fs.mkdirSync(distDir, { recursive: true });

const fileFor = (lang) => (lang === 'uz' ? 'index.html' : lang + '.html');

ORDER.forEach((lang) => {
  let html = ejs.render(tpl, { lang, t: LOCALES[lang], meta: META[lang], metaList, FLAGS, config },
    { filename: path.join(root, 'views/index.ejs') });
  // tashqi CSS/JS -> inline
  html = html.replace('<link rel="stylesheet" href="/css/styles.css">', '<style>\n' + css + '\n</style>');
  html = html.replace('<script src="/js/main.js"></script>', '<script>\n' + js + '\n</script>');
  // til havolalarini statik fayllarga moslash
  html = html
    .replace(/href="\/"/g, 'href="index.html"')
    .replace(/href="\/cy"/g, 'href="cy.html"')
    .replace(/href="\/ru"/g, 'href="ru.html"')
    .replace(/href="\/en"/g, 'href="en.html"');
  fs.writeFileSync(path.join(distDir, fileFor(lang)), html);
  console.log('dist/' + fileFor(lang));
});
console.log('Statik eksport tayyor.');
