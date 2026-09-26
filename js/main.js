(function () {
  'use strict';
  document.documentElement.classList.add('js');

  var CFG = window.AG_CONFIG || {};
  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var qs = function (s, r) { return (r || document).querySelector(s); };
  var qsa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- Год ---------- */
  var yearEl = qs('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Telegram: пока ник не задан в js/config.js, все ссылки скрыты ---------- */
  var tgUser = String(CFG.telegram || '').replace(/^@/, '').trim();
  var tgUrl = tgUser ? 'https://t.me/' + tgUser : '';
  if (tgUrl) {
    qsa('[data-tg]').forEach(function (a) {
      a.href = tgUrl; a.hidden = false;
      if (a.hasAttribute('data-tg-text')) a.textContent = '@' + tgUser;
    });
    qsa('[data-tg-item]').forEach(function (el) { el.hidden = false; });
  }

  /* ---------- Тема День / Ночь ---------- */
  var themeBtn = qs('#themeToggle');
  var metaTheme = qs('meta[name="theme-color"]');
  var applyTheme = function (t) {
    root.setAttribute('data-theme', t);
    if (metaTheme) metaTheme.setAttribute('content', t === 'day' ? '#f4f7fb' : '#06080c');
    if (themeBtn) {
      themeBtn.setAttribute('aria-label', t === 'day' ? 'Включить ночную тему' : 'Включить дневную тему');
      themeBtn.setAttribute('aria-pressed', String(t === 'night'));
    }
  };
  applyTheme(root.getAttribute('data-theme') === 'day' ? 'day' : 'night');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'day' ? 'night' : 'day';
      if (!reduceMotion) {
        root.classList.add('theme-anim');
        setTimeout(function () { root.classList.remove('theme-anim'); }, 600);
      }
      applyTheme(next);
      try { localStorage.setItem('ag34-theme', next); } catch (e) {}
    });
  }

  /* ---------- Шапка ---------- */
  var header = qs('#header');
  var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 20); };
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var burger = qs('#burger'), mnav = qs('#mobileNav');
  var closeNav = function () {
    burger.classList.remove('is-active'); burger.setAttribute('aria-expanded', 'false');
    mnav.classList.remove('is-open'); header.classList.remove('is-menu-open');
  };
  burger.addEventListener('click', function () {
    var open = mnav.classList.toggle('is-open');
    burger.classList.toggle('is-active', open);
    burger.setAttribute('aria-expanded', String(open));
    header.classList.toggle('is-menu-open', open);
  });
  qsa('a', mnav).forEach(function (a) { a.addEventListener('click', closeNav); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNav(); });
  window.addEventListener('resize', function () { if (window.innerWidth > 1040) closeNav(); });

  /* активный пункт меню */
  var navLinks = qsa('.nav__link');
  var navSections = navLinks.map(function (l) { return qs(l.getAttribute('href')); });
  if ('IntersectionObserver' in window) {
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var id = '#' + en.target.id;
        navLinks.forEach(function (l) { l.classList.toggle('is-active', l.getAttribute('href') === id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    navSections.forEach(function (s) { if (s) navIO.observe(s); });
  }

  /* ---------- Услуги -> выпадающий список формы (один источник — карточки) ---------- */
  var serviceSelect = qs('#f-service');
  var cardServices = qsa('#serviceCards .card').map(function (c) { return c.getAttribute('data-service'); });
  cardServices.forEach(function (name) {
    var o = document.createElement('option');
    o.value = name; o.textContent = name;
    serviceSelect.appendChild(o);
  });

  /* фото услуг: если файл images/services/NN.jpg (01.jpg … 06.jpg по порядку карточек) существует, он ложится поверх заглушки */
  qsa('#serviceCards .card').forEach(function (card, i) {
    var media = qs('.card__media', card);
    var img = new Image();
    img.alt = ''; img.decoding = 'async';
    img.onload = function () { media.appendChild(img); };
    img.src = 'images/services/' + String(i + 1).padStart(2, '0') + '.jpg';
  });

  /* ---------- Появление через блюр ---------- */
  var revealTargets = qsa('.card, .shead, .price-row, .stat, .quote, .booking__intro, .form__frame, .contacts__info, .contacts__map, .works__track');
  if ('IntersectionObserver' in window && !reduceMotion) {
    revealTargets.forEach(function (el) { el.setAttribute('data-reveal', ''); });
    var revealIO = new IntersectionObserver(function (entries) {
      var step = 0;
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        revealIO.unobserve(el);
        var delay = Math.min(step, 7) * 50;
        step += 1;
        el.style.setProperty('--rd', delay + 'ms');
        el.classList.add('is-visible');
        setTimeout(function () {                     // после появления возвращаем обычные hover-переходы
          el.removeAttribute('data-reveal'); el.classList.remove('is-visible'); el.style.removeProperty('--rd');
        }, 1000 + delay);
      });
    }, { threshold: 0.12 });
    revealTargets.forEach(function (el) { revealIO.observe(el); });
  }

  /* ---------- Набегающие цифры ---------- */
  var fmt = function (n) { return Math.round(n).toLocaleString('ru-RU'); };
  var serviceCount = cardServices.length;
  var countEls = qsa('[data-count]');
  if (countEls.length && 'IntersectionObserver' in window && !reduceMotion) {
    var countIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target, target = el._target, t0 = null;
        countIO.unobserve(el);
        var tick = function (now) {
          if (t0 === null) t0 = now;
          var t = Math.min((now - t0) / 1800, 1);
          el.textContent = fmt(target * (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)));   // резкий старт, долгий доезд
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.4 });
    countEls.forEach(function (el) {
      var raw = el.getAttribute('data-count');
      var target = raw === 'services' ? serviceCount : parseInt(raw, 10);
      if (!target) return;
      el._target = target; el.textContent = fmt(0);
      countIO.observe(el);
    });
  } else {
    countEls.forEach(function (el) {
      if (el.getAttribute('data-count') === 'services') el.textContent = fmt(serviceCount);
    });
  }

  /* ---------- Кнопки «Записаться» -> форма ---------- */
  var bookingSection = qs('#booking'), nameInput = qs('#f-name');
  qsa('.js-book').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      var service = btn.getAttribute('data-service');
      if (service) {
        var ok = qsa('option', serviceSelect).some(function (o) {
          if (o.value === service) { serviceSelect.value = o.value; return true; }
          return false;
        });
        if (!ok) serviceSelect.value = '';
      }
      if (btn.tagName === 'BUTTON' || btn.getAttribute('href') === '#booking') {
        e.preventDefault();
        bookingSection.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        setTimeout(function () { nameInput.focus({ preventScroll: true }); }, 500);
      }
    });
  });

  /* ---------- Toast ---------- */
  var toastEl = qs('#toast'), toastTimer = 0;
  var showToast = function (msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible'); }, 4600);
  };

  /* ---------- Заявка ---------- */
  var form = qs('#bookingForm');
  var fields = { name: qs('#f-name'), phone: qs('#f-phone'), car: qs('#f-car') };

  var setError = function (input, msg) {
    var f = input.closest('.field'), err = qs('.field__error', f);
    f.classList.toggle('has-error', !!msg);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (err) err.textContent = msg || '';
  };
  Object.keys(fields).forEach(function (k) {
    fields[k].addEventListener('input', function () { if (fields[k].value.trim()) setError(fields[k], ''); });
  });

  /* Телефон: только цифры, маска +7 (XXX) XXX-XX-XX, ровно 11 цифр.
     Ведущие 8 и 7 понимаются как код страны; если начали с 9, «+7» подставляется сам. */
  var PHONE_LEN = 11;
  var phoneDigits = function (raw) {
    var d = String(raw).replace(/\D/g, '');
    if (!d) return '';
    if (d[0] === '8') d = '7' + d.slice(1);
    else if (d[0] !== '7') d = '7' + d;
    return d.slice(0, PHONE_LEN);
  };
  var phoneMask = function (d) {
    if (!d) return '';
    var s = '+7';
    if (d.length > 1) s += ' (' + d.slice(1, 4);
    if (d.length > 4) s += ') ' + d.slice(4, 7);
    if (d.length > 7) s += '-' + d.slice(7, 9);
    if (d.length > 9) s += '-' + d.slice(9, 11);
    return s;
  };
  var phoneInput = fields.phone;
  phoneInput.maxLength = 18;                        // длина «+7 (917) 646-12-76»
  phoneInput.addEventListener('input', function (e) {
    var raw = phoneInput.value, caret = phoneInput.selectionStart;
    var digitsBeforeCaret = raw.slice(0, caret).replace(/\D/g, '').length;
    var d = phoneDigits(raw);
    var deleting = e.inputType && e.inputType.indexOf('delete') === 0;
    if (deleting && d === '7') d = '';               // стёрли всё, кроме кода страны — поле очищается
    var masked = phoneMask(d);
    phoneInput.value = masked;
    // курсор остаётся после того же по счёту числа цифр, а не прыгает в конец
    if (document.activeElement === phoneInput && caret < raw.length) {
      var left = phoneDigits(raw.slice(0, caret)).length || (digitsBeforeCaret ? 1 : 0), pos = 0, seen = 0;
      while (pos < masked.length && seen < left) { if (/\d/.test(masked[pos])) seen++; pos++; }
      phoneInput.setSelectionRange(pos, pos);
    }
  });
  phoneInput.addEventListener('keydown', function (e) {   // буквы и знаки не набираются вовсе
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    if (!/\d/.test(e.key)) e.preventDefault();
  });
  phoneInput.addEventListener('blur', function () { phoneInput.value = phoneMask(phoneDigits(phoneInput.value)); });

  var dateInput = qs('#f-date');
  var d0 = new Date();
  dateInput.min = d0.getFullYear() + '-' + String(d0.getMonth() + 1).padStart(2, '0') + '-' + String(d0.getDate()).padStart(2, '0');

  /* запасной путь: чат в Telegram с готовым текстом; без ника — просто показываем телефон */
  var fallback = function (message) {
    if (!tgUrl) {
      showToast('Не удалось отправить заявку. Позвоните нам: ' + (CFG.phoneText || ''));
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(message).catch(function () {});
    } catch (e) {}
    window.open(tgUrl + '?text=' + encodeURIComponent(message), '_blank', 'noopener');
    showToast('Текст скопирован — если в Telegram он не подставился, вставьте его сами');
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var valid = true;
    Object.keys(fields).forEach(function (k) {
      var v = fields[k].value.trim(), msg = '';
      if (!v) msg = 'Заполните это поле';
      else if (k === 'phone' && phoneDigits(v).length !== PHONE_LEN) msg = 'Введите номер полностью: 11 цифр, например +7 (917) 646-12-76';
      setError(fields[k], msg);
      if (msg) valid = false;
    });
    if (!valid) {
      var bad = qs('.field.has-error input', form);
      if (bad) bad.focus();
      return;
    }

    var v = {
      name: fields.name.value.trim(), phone: fields.phone.value.trim(), car: fields.car.value.trim(),
      service: serviceSelect.value.trim(), comment: qs('#f-comment').value.trim(), date: ''
    };
    if (dateInput.value) {
      var d = new Date(dateInput.value + 'T00:00:00');
      v.date = isNaN(d.getTime()) ? dateInput.value : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    }
    var lines = ['Здравствуйте! Хочу записаться в AUTOGLASS 34.', 'Имя: ' + v.name, 'Телефон: ' + v.phone, 'Авто: ' + v.car];
    if (v.service) lines.push('Услуга: ' + v.service);
    if (v.date) lines.push('Желаемая дата: ' + v.date);
    if (v.comment) lines.push('Комментарий: ' + v.comment);
    var message = lines.join('\n');

    var btn = qs('[type="submit"]', form);
    btn.disabled = true;
    fetch('/.netlify/functions/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: v.name, phone: v.phone, car: v.car, service: v.service, date: v.date, comment: v.comment,
        website: form.elements.website.value
      })
    }).then(function (r) {
      if (r.ok) { form.reset(); showToast('Заявка отправлена — скоро свяжемся с вами'); }
      else if (r.status === 400) showToast('Проверьте имя, телефон и автомобиль');
      else throw new Error(String(r.status));
    }).catch(function () {
      fallback(message);
    }).then(function () { btn.disabled = false; });
  });

  /* ---------- Нижняя панель на телефоне: появляется после первого экрана ---------- */
  var mbar = qs('#mobileBar'), hero = qs('#top');
  if (mbar && hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { mbar.classList.toggle('is-visible', !en[0].isIntersecting); }, { threshold: 0 }).observe(hero);
  }

  /* ---------- Карусель «Работы»: фото и видео вперемешку (js/media.js) ---------- */
  var worksSection = qs('#works'), track = qs('#worksTrack');
  var prevBtn = qs('#worksPrev'), nextBtn = qs('#worksNext'), countEl = qs('#worksCount');
  var list = (window.AG_MEDIA || []).filter(function (m) { return m && m.src; });
  var slides = [], active = -1, worksVisible = false, saveData = !!(navigator.connection && navigator.connection.saveData);
  var autoplay = !reduceMotion && !saveData;
  var raf = 0;

  var hideWorks = function () {
    worksSection.hidden = true;
    qsa('a[href="#works"]').forEach(function (a) { a.remove(); });
  };
  var icon = function (id) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg'), use = document.createElementNS(ns, 'use');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    use.setAttribute('href', '#' + id); svg.appendChild(use);
    return { svg: svg, use: use };
  };

  var scrollToSlide = function (i) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    var el = slides[i].el;
    track.scrollTo({ left: el.offsetLeft + el.offsetWidth / 2 - track.clientWidth / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
  };
  var nearest = function () {
    var c = track.scrollLeft + track.clientWidth / 2, best = 0, bd = Infinity;
    slides.forEach(function (s, i) {
      var d = Math.abs(s.el.offsetLeft + s.el.offsetWidth / 2 - c);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  };
  var sync = function () {                           // играет только центральный ролик и только пока раздел на экране
    slides.forEach(function (s, i) {
      if (!s.video) return;
      if (i === active && worksVisible && !document.hidden && s.want) {
        var p = s.video.play(); if (p && p.catch) p.catch(function () {});
      } else if (!s.video.paused) s.video.pause();
    });
  };
  var setActive = function (i) {
    if (i === active || !slides[i]) return;
    if (active >= 0 && slides[active]) {
      var o = slides[active]; o.el.classList.remove('is-active');
      if (o.video) { o.video.muted = true; o.soundUse.setAttribute('href', '#i-mute'); o.sound.setAttribute('aria-pressed', 'false'); }
    }
    active = i;
    var s = slides[i];
    s.el.classList.add('is-active');
    s.want = autoplay;
    countEl.textContent = (i + 1) + ' / ' + slides.length;
    prevBtn.disabled = i <= 0; nextBtn.disabled = i >= slides.length - 1;
    sync();
  };
  var relabel = function () {
    slides.forEach(function (s, i) { s.el.setAttribute('aria-label', (i + 1) + ' из ' + slides.length + ': ' + s.title); });
  };
  var removeSlide = function (s) {
    var idx = slides.indexOf(s);
    if (idx < 0) return;
    s.el.remove(); slides.splice(idx, 1);
    if (!slides.length) { hideWorks(); return; }
    relabel(); active = -1; setActive(Math.min(nearest(), slides.length - 1));
  };

  var buildSlide = function (m, i) {
    var isVideo = m.type === 'video';
    var caption = m.title || '';
    var title = caption || (isVideo ? 'Видео студии' : 'Фото студии');
    var el = document.createElement('figure');
    el.className = 'slide';
    el.setAttribute('role', 'group'); el.setAttribute('aria-roledescription', 'слайд');
    var s = { el: el, title: title, want: false };

    if (isVideo) {
      var v = document.createElement('video');
      v.className = 'slide__media'; v.muted = true; v.loop = true; v.playsInline = true;
      v.setAttribute('playsinline', ''); v.preload = saveData ? 'none' : 'metadata';
      if (m.poster) v.poster = m.poster;
      v.src = m.src + '#t=0.1';
      v.addEventListener('loadedmetadata', function () { if (v.videoWidth && v.videoHeight) el.style.setProperty('--ar', (v.videoWidth / v.videoHeight).toFixed(4)); });
      v.addEventListener('play', function () { el.classList.remove('is-paused'); });
      v.addEventListener('pause', function () { el.classList.add('is-paused'); });
      v.addEventListener('timeupdate', function () { if (v.duration) el.style.setProperty('--p', (v.currentTime / v.duration).toFixed(3)); });
      v.addEventListener('error', function () { removeSlide(s); });
      s.video = v; el.classList.add('is-paused');
      el.appendChild(v);
    } else {
      var img = document.createElement('img');
      img.className = 'slide__media'; img.alt = caption; img.decoding = 'async';
      img.loading = i < 3 ? 'eager' : 'lazy'; img.src = m.src;
      img.addEventListener('load', function () { if (img.naturalWidth && img.naturalHeight) el.style.setProperty('--ar', (img.naturalWidth / img.naturalHeight).toFixed(4)); });
      img.addEventListener('error', function () { removeSlide(s); });
      el.appendChild(img);
    }

    var shade = document.createElement('span'); shade.className = 'slide__shade'; el.appendChild(shade);
    if (caption) { var cap = document.createElement('figcaption'); cap.className = 'slide__cap'; cap.textContent = caption; el.appendChild(cap); }

    var toggle = document.createElement('button');
    toggle.type = 'button'; toggle.className = 'slide__toggle';
    toggle.setAttribute('aria-label', isVideo ? 'Воспроизвести или остановить: ' + title : 'Показать по центру: ' + title);
    toggle.addEventListener('click', function () {
      var idx = slides.indexOf(s);
      if (idx !== active) { scrollToSlide(idx); return; }
      if (s.video) { s.want = s.video.paused; sync(); }
    });
    el.appendChild(toggle);

    if (isVideo) {
      var bar = document.createElement('span'); bar.className = 'slide__bar'; el.appendChild(bar);
      var play = icon('i-play'); play.svg.setAttribute('class', 'slide__play'); el.appendChild(play.svg);
      var snd = document.createElement('button');
      snd.type = 'button'; snd.className = 'slide__sound';
      snd.setAttribute('aria-label', 'Включить или выключить звук: ' + title); snd.setAttribute('aria-pressed', 'false');
      var si = icon('i-mute'); snd.appendChild(si.svg);
      snd.addEventListener('click', function () {
        s.video.muted = !s.video.muted;
        snd.setAttribute('aria-pressed', String(!s.video.muted));
        si.use.setAttribute('href', s.video.muted ? '#i-mute' : '#i-vol');
      });
      el.appendChild(snd);
      s.sound = snd; s.soundUse = si.use;
    }
    return s;
  };

  if (worksSection && track) {
    if (!list.length) {
      /* пока файлов нет — показываем примеры-заглушки, чтобы было видно, как будет выглядеть карусель */
      var demo = [
        { t: 'Ваши фото и видео', s: 'появятся здесь — файлы кладутся в папку media/' },
        { t: 'Замена лобового', s: 'до / после' },
        { t: 'Тонировка', s: 'пример работы' },
        { t: 'Полиуретановая плёнка', s: 'пример работы' }
      ];
      demo.forEach(function (d, i) {
        var el = document.createElement('figure');
        el.className = 'slide slide--demo'; el.setAttribute('role', 'group');
        var ic = icon(['i-windshield', 'i-chip', 'i-tint', 'i-film'][i]);
        el.appendChild(ic.svg);
        var p = document.createElement('p'); p.textContent = d.t; el.appendChild(p);
        var sm = document.createElement('small'); sm.textContent = d.s; el.appendChild(sm);
        var toggle = document.createElement('button');
        toggle.type = 'button'; toggle.className = 'slide__toggle'; toggle.setAttribute('aria-label', 'Показать по центру: ' + d.t);
        var s = { el: el, title: d.t };
        toggle.addEventListener('click', function () { scrollToSlide(slides.indexOf(s)); });
        el.appendChild(toggle);
        slides.push(s);
      });
    } else {
      list.forEach(function (m, i) { slides.push(buildSlide(m, i)); });
    }
    var frag = document.createDocumentFragment();
    slides.forEach(function (s) { frag.appendChild(s.el); });
    track.appendChild(frag);
    relabel(); setActive(0);

    track.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = 0; if (slides.length) setActive(nearest()); });
    }, { passive: true });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); scrollToSlide(active + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); scrollToSlide(active - 1); }
    });
    prevBtn.addEventListener('click', function () { scrollToSlide(active - 1); });
    nextBtn.addEventListener('click', function () { scrollToSlide(active + 1); });
    document.addEventListener('visibilitychange', sync);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { worksVisible = en[0].isIntersecting; sync(); }, { threshold: 0.25 }).observe(worksSection);
    }
    /* первая карточка встаёт по центру после загрузки размеров */
    window.addEventListener('load', function () { if (slides.length) scrollToSlide(active < 0 ? 0 : active); });
  }
})();
