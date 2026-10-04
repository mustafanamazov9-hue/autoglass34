/* Прокрутка с параллаксом.

   1. «Стекло чистеет»: первый экран закрепляется (.hero-pin), прогресс прокрутки 0..1 уходит
      - в CSS-переменную --p (текст героя поднимается и гаснет);
      - в js/glass.js (сцена за стеклом сдвигается медленнее страницы, туман уходит, идёт дворник, капли скатываются);
      - в классы героя: has-scrolled / is-faded / is-hud (под конец услуги появляются как подсказки на лобовом).
   2. «Слоёное стекло»: раздел #layers закрепляется, слои-пластины разъезжаются по глубине, у каждого слоя своя услуга.

   При prefers-reduced-motion скрипт ничего не делает: герой статичный, вместо сцены слоёв — обычный список. */
(function () {
  'use strict';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var smooth = function (a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  var qs = function (s, r) { return (r || document).querySelector(s); };
  var qsa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- 1. Закреплённый первый экран ---------- */
  var pin = qs('#heroPin'), hero = qs('#top'), hud = qs('#hud');
  var hudFocusables = hud ? qsa('button, a', hud) : [];
  var hudOn = false;

  function setHud(on) {
    if (on === hudOn) return;
    hudOn = on;
    hero.classList.toggle('is-hud', on);
    hudFocusables.forEach(function (el) { el.tabIndex = on ? 0 : -1; });   // скрытые подсказки не ловят фокус
  }

  function updateHero() {
    if (!pin || !hero) return;
    var r = pin.getBoundingClientRect();
    var total = r.height - hero.offsetHeight;
    var p = total > 0 ? clamp(-r.top / total, 0, 1) : 0;
    hero.style.setProperty('--p', p.toFixed(4));
    hero.classList.toggle('has-scrolled', p > .03);
    hero.classList.toggle('is-faded', p > .42);
    setHud(hudOn ? p > .5 : p > .56);                   // с зазором, чтобы не мигало на границе
    if (window.AGGlass && window.AGGlass.setProgress) window.AGGlass.setProgress(p);
  }

  /* ---------- 2. Слоёное стекло ---------- */
  var section = qs('#layers'), track = qs('#layersTrack');
  var plates = qsa('#plates .plate');
  var sceneEl = qs('.layers__scene');
  var steps = qsa('#lySteps li');
  var panel = qs('#lyPanel'), nameEl = qs('#lyName'), textEl = qs('#lyText'), priceEl = qs('#lyPrice');
  var numEl = qs('#lyNum'), btn = qs('#lyBtn');
  var items = qsa('#layersList li').map(function (li) {
    return {
      service: li.getAttribute('data-service'),
      name: li.getAttribute('data-name'),
      price: li.getAttribute('data-price'),
      text: qs('p', li).textContent
    };
  });
  var N = plates.length, active = -2;                    // -2: ещё ничего не показано, -1: вступление
  var START = .1;                                        // до этой доли прокрутки слои собраны в стопку

  function showItem(i) {
    if (i === active) return;
    active = i;
    plates.forEach(function (pl, k) {
      pl.classList.toggle('is-on', k === i);
      pl.classList.toggle('is-dim', i >= 0 && k !== i);
    });
    steps.forEach(function (li, k) { li.classList.toggle('is-on', k === i); });
    var it = i >= 0 ? items[i] : null;
    if (it) {
      numEl.textContent = '0' + (i + 1) + ' / 0' + N;
      nameEl.textContent = it.name;
      textEl.textContent = it.text;
      priceEl.textContent = it.price;
      btn.setAttribute('data-service', it.service);
      btn.hidden = false;
    } else {
      numEl.textContent = '0' + 1 + ' / 0' + N;
      nameEl.textContent = 'Слой за слоем';
      textEl.textContent = 'Листайте: стекло и салон разъедутся на слои, и у каждого слоя своя услуга.';
      priceEl.textContent = '';
      btn.hidden = true;
    }
    panel.classList.remove('is-in');
    void panel.offsetWidth;                              // перезапуск анимации появления
    panel.classList.add('is-in');
  }

  function layerProgress() {
    var r = track.getBoundingClientRect();
    var total = r.height - window.innerHeight;
    return { p: total > 0 ? clamp(-r.top / total, 0, 1) : 0, total: total, top: window.pageYOffset + r.top };
  }

  function updateLayers() {
    if (!section || !track || !plates.length) return;
    var lp = layerProgress(), p = lp.p;
    section.style.setProperty('--lp', p.toFixed(4));
    var e = smooth(0, START + .08, p);                   // 0 — слои в стопке, 1 — разъехались
    var idx = p < START ? -1 : Math.min(N - 1, Math.floor((p - START) / (1 - START) * N));
    var gap = Math.min(104, (sceneEl ? sceneEl.offsetHeight : 520) * (window.innerWidth <= 900 ? .155 : .19));   // шаг между слоями зависит от высоты сцены (на телефоне она ниже)
    plates.forEach(function (pl, k) {
      var depth = N - 1 - k;                             // 0 — нижний слой, N-1 — верхний
      var z = depth * (8 + gap * e) + (k === idx ? 34 * e : 0);
      var x = (k - (N - 1) / 2) * 12 * e;                // лёгкий разнос в стороны для глубины
      pl.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,' + z.toFixed(1) + 'px)';
      pl.style.setProperty('--sheen', ((p * 1.6 + k * .18) % 1.4).toFixed(3));   // блик скользит по слоям
    });
    showItem(idx);
  }

  /* точки под панелью — быстрый переход к слою */
  steps.forEach(function (li, k) {
    qs('button', li).addEventListener('click', function () {
      var lp = layerProgress();
      var target = START + (1 - START) * ((k + .5) / N);
      window.scrollTo({ top: lp.top + lp.total * target, behavior: 'smooth' });
    });
  });

  /* ---------- общий цикл ---------- */
  var ticking = false;
  function update() { ticking = false; updateHero(); updateLayers(); }
  function request() { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } }
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();
})();
