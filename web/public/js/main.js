// Ipak Yo'li — mijoz interaktivligi (matn/tarjima serverda render qilinadi)
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    // Nav — skrollda soya
    var navEl = document.getElementById('nav');
    if (navEl) {
      var onScroll = function () {
        navEl.classList.toggle('scrolled', window.scrollY > 10);
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    // Mobil menyu
    var hamb = document.getElementById('hamb');
    var links = document.getElementById('navLinks');
    if (hamb && links) {
      hamb.addEventListener('click', function () { links.classList.toggle('open'); });
      links.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () { links.classList.remove('open'); });
      });
    }

    // Skrollda paydo bo'lish
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

      // Statistika — sanash animatsiyasi
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var el = e.target, target = parseInt(el.dataset.count, 10) || 0, n = 0;
          var step = Math.max(1, Math.round(target / 24));
          var t = setInterval(function () {
            n += step;
            if (n >= target) { n = target; clearInterval(t); }
            el.textContent = n;
          }, 28);
          cio.unobserve(el);
        });
      }, { threshold: 0.5 });
      document.querySelectorAll('[data-count]').forEach(function (el) { cio.observe(el); });
    } else {
      document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
    }

    // Ariza formasi (agar mavjud bo'lsa) — /api/contact ga POST
    var form = document.getElementById('leadForm');
    if (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var status = document.getElementById('leadStatus');
        var btn = form.querySelector('button[type="submit"]');
        var data = {
          name: form.name.value.trim(),
          phone: form.phone.value.trim(),
          message: form.message ? form.message.value.trim() : '',
        };
        if (!data.name || !data.phone) {
          if (status) { status.textContent = form.dataset.msgRequired || 'Ism va telefonni kiriting'; status.className = 'lead-status err'; }
          return;
        }
        if (btn) btn.disabled = true;
        fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (res) {
            if (res.ok) {
              form.reset();
              if (status) { status.textContent = form.dataset.msgOk || 'Arizangiz qabul qilindi. Tez orada bog\'lanamiz.'; status.className = 'lead-status ok'; }
            } else {
              if (status) { status.textContent = (res.j && res.j.error) || form.dataset.msgErr || 'Xatolik. Qayta urinib ko\'ring.'; status.className = 'lead-status err'; }
            }
          })
          .catch(function () {
            if (status) { status.textContent = form.dataset.msgErr || 'Xatolik. Qayta urinib ko\'ring.'; status.className = 'lead-status err'; }
          })
          .finally(function () { if (btn) btn.disabled = false; });
      });
    }
  });
})();
