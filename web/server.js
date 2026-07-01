// Ipak Yo'li — web server (Express)
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const config = require('./src/config');

const app = express();
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Xavfsizlik (CSP — Google Fonts va inline style atributlariga ruxsat)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
if (config.nodeEnv !== 'test') {
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
}
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// Statik fayllar (cache bilan)
app.use('/css', express.static(path.join(__dirname, 'public/css'), { maxAge: '7d' }));
app.use('/js', express.static(path.join(__dirname, 'public/js'), { maxAge: '7d' }));

// Ariza uchun rate-limit
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Juda koʻp soʻrov. Birozdan soʻng urinib koʻring.' },
});
app.use('/api/contact', contactLimiter);

// Route'lar
app.use('/', require('./src/routes/api'));
app.use('/', require('./src/routes/pages'));

// 404
app.use((req, res) => res.status(404).send('404 — sahifa topilmadi'));

// Xato ushlagich
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('500 — server xatosi');
});

if (require.main === module) {
  app.listen(config.port, config.host, () => {
    console.log(`Ipak Yo'li web ${config.host}:${config.port} da ishlayapti (${config.nodeEnv})`);
  });
}

module.exports = app;
