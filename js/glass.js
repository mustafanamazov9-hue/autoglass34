/* Главный герой: «Лобовое под дождём».

   Кадр собирается на одном canvas из трёх слоёв:
     A — чёткая сцена за стеклом (рисуется кодом: небо, огни-боке, надпись AUTOGLASS 34);
     B — она же, размытая и «запотевшая»;
     M — маска чистоты: след курсора, взмах дворника и дорожки от капель.
   Каждый кадр: рисуем B, поверх — A только там, где маска непрозрачна; потом капли (каждая крупная — линза с
   перевёрнутой чёткой картинкой). Маска гаснет за ~4 с, и стекло снова запотевает.

   Управление: мышь протирает стекло, на телефоне дворник проходит сам раз в ~7 с и по касанию.
   Вне экрана и на скрытой вкладке цикл стоит. При prefers-reduced-motion рисуется один статичный кадр. */
(function () {
  'use strict';

  var hero = document.getElementById('top');
  var canvas = document.getElementById('glass');
  if (!hero || !canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var root = document.documentElement;

  var cw = 0, ch = 0, W = 0, H = 0, dpr = 1;
  var A = document.createElement('canvas');      // чёткая сцена
  var B = document.createElement('canvas');      // размытая сцена
  var T = document.createElement('canvas');      // рабочий слой для склейки
  var M = document.createElement('canvas');      // маска чистоты (в половину разрешения)
  var actx = A.getContext('2d');
  var bctx = B.getContext('2d');
  var tctx = T.getContext('2d');
  var mctx = M.getContext('2d');

  var running = false, visible = true, rafId = 0, last = 0, clock = 0;
  var entries = [];                               // штрихи маски
  var drops = [];
  var isDay = false;

  /* ---------- Утилиты ---------- */
  var seed = 34034;
  function rnd() {                                // mulberry32: сцена одна и та же при каждой загрузке
    seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function frand(a, b) { return a + Math.random() * (b - a); }   // случайность капель живая, не детерминированная
  function ease(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  /* ---------- Сцена за стеклом (A) ---------- */
  function bokehSpec() {
    seed = 20260926;
    var list = [], i;
    for (i = 0; i < 54; i++) {
      var c = rnd();
      list.push({
        x: rnd(), y: 0.38 + Math.pow(rnd(), 0.8) * 0.6,
        r: 0.012 + rnd() * rnd() * 0.05,
        a: 0.10 + rnd() * 0.30,
        c: c < 0.62 ? 0 : c < 0.9 ? 1 : 2           // 0 — синий, 1 — белый, 2 — тёплый
      });
    }
    return list;
  }
  var BOKEH = bokehSpec();

  function drawSpaced(c, text, cx, y, spacing) {
    var i, total = 0, ws = [];
    for (i = 0; i < text.length; i++) { ws[i] = c.measureText(text[i]).width; total += ws[i] + spacing; }
    total -= spacing;
    var x = cx - total / 2;
    for (i = 0; i < text.length; i++) { c.fillText(text[i], x, y); x += ws[i] + spacing; }
  }

  function drawScene(c, day) {
    var w = W, h = H, i, g;

    /* небо */
    g = c.createLinearGradient(0, 0, 0, h);
    if (day) {
      g.addColorStop(0, '#7fa3dc'); g.addColorStop(.42, '#b7cff0'); g.addColorStop(.78, '#e7eefa'); g.addColorStop(1, '#f4f7fb');
    } else {
      g.addColorStop(0, '#02040a'); g.addColorStop(.46, '#071433'); g.addColorStop(.76, '#0c2354'); g.addColorStop(1, '#04070d');
    }
    c.fillStyle = g; c.fillRect(0, 0, w, h);

    if (day) {
      /* солнечный блик и облака */
      g = c.createRadialGradient(w * .82, h * .1, 0, w * .82, h * .1, w * .42);
      g.addColorStop(0, 'rgba(255,255,255,.98)'); g.addColorStop(.35, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      seed = 777;
      for (i = 0; i < 7; i++) {
        var cx = rnd() * w, cy = h * (.12 + rnd() * .5), rr = w * (.08 + rnd() * .12);
        g = c.createRadialGradient(cx, cy, 0, cx, cy, rr);
        g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.save(); c.translate(cx, cy); c.scale(1.9, .55); c.translate(-cx, -cy);
        c.fillStyle = g; c.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); c.restore();
      }
    } else {
      /* свечение горизонта и полосы света на трассе */
      g = c.createRadialGradient(w * .5, h * .74, 0, w * .5, h * .74, w * .62);
      g.addColorStop(0, 'rgba(48,108,240,.55)'); g.addColorStop(.5, 'rgba(30,72,190,.22)'); g.addColorStop(1, 'rgba(20,50,140,0)');
      c.save(); c.translate(w * .5, h * .74); c.scale(1, .5); c.translate(-w * .5, -h * .74);
      c.fillStyle = g; c.fillRect(0, h * .74 - w * .7, w, w * 1.4); c.restore();
      for (i = 0; i < 5; i++) {
        var ly = h * (.71 + i * .012);
        g = c.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, 'rgba(120,170,255,0)'); g.addColorStop(.5, 'rgba(160,200,255,' + (.28 - i * .04) + ')'); g.addColorStop(1, 'rgba(120,170,255,0)');
        c.fillStyle = g; c.fillRect(0, ly, w, Math.max(1, dpr * (1.6 - i * .2)));
      }
    }

    /* боке */
    c.save();
    c.globalCompositeOperation = day ? 'source-over' : 'lighter';
    for (i = 0; i < BOKEH.length; i++) {
      var b = BOKEH[i], bx = b.x * w, by = b.y * h, br = b.r * Math.max(w, h * 1.4);
      var col = day ? (b.c === 2 ? '255,236,200' : b.c === 1 ? '255,255,255' : '190,214,250')
                    : (b.c === 2 ? '255,190,110' : b.c === 1 ? '225,238,255' : '70,130,255');
      var al = day ? b.a * .85 : b.a;
      g = c.createRadialGradient(bx, by, br * .1, bx, by, br);
      g.addColorStop(0, 'rgba(' + col + ',' + (al * .55) + ')');
      g.addColorStop(.78, 'rgba(' + col + ',' + (al * .7) + ')');
      g.addColorStop(.92, 'rgba(' + col + ',' + al + ')');
      g.addColorStop(1, 'rgba(' + col + ',0)');
      c.fillStyle = g; c.beginPath(); c.arc(bx, by, br, 0, 6.2832); c.fill();
    }
    c.restore();

    /* надпись AUTOGLASS 34 в синем металлике */
    var portrait = w / h < .9;
    var lines = portrait ? [{ t: 'AUTOGLASS', k: 1 }, { t: '34', k: 1.6 }] : [{ t: 'AUTOGLASS 34', k: 1 }];
    var face = '900 100px "Exo 2", "Arial Black", sans-serif';
    c.font = face;
    var targetW = w * (portrait ? .88 : .8);
    var fs = 100 * targetW / c.measureText(lines[0].t).width;
    fs = Math.min(fs, h * (portrait ? .13 : .21));
    /* высота строки — по заглавным (≈0.74 кегля); первая базовая линия так, чтобы блок стоял по центру заданной высоты */
    var capH = function (k) { return fs * k * .74; }, gap = fs * .2;
    var totalH = gap * (lines.length - 1);
    for (i = 0; i < lines.length; i++) totalH += capH(lines[i].k);
    var y = h * (portrait ? .29 : .37) - totalH / 2 + capH(lines[0].k);
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    for (i = 0; i < lines.length; i++) {
      var f = fs * lines[i].k;
      c.font = face.replace('100px', f + 'px');
      var tw = c.measureText(lines[i].t).width;
      /* буквы рисуем на отдельном слое: блик source-atop должен ложиться только на них, а не на фон сцены */
      var pad = Math.ceil(60 * dpr), base = pad + f;
      var lw = Math.ceil(tw) + pad * 2, lh = Math.ceil(base + f * .3 + pad);
      var lay = document.createElement('canvas'); lay.width = lw; lay.height = lh;
      var l = lay.getContext('2d');
      l.font = c.font; l.textAlign = 'left'; l.textBaseline = 'alphabetic';
      g = l.createLinearGradient(pad, 0, pad + tw, 0);
      if (day) {
        g.addColorStop(0, '#0a2a6b'); g.addColorStop(.24, '#2f64d6'); g.addColorStop(.45, '#0b2f86');
        g.addColorStop(.66, '#4f84ec'); g.addColorStop(.86, '#0a2a6b'); g.addColorStop(1, '#1d4ed8');
      } else {
        g.addColorStop(0, '#5b8df0'); g.addColorStop(.2, '#e3ecff'); g.addColorStop(.42, '#3a6fe0');
        g.addColorStop(.56, '#1a48b8'); g.addColorStop(.74, '#86adff'); g.addColorStop(.9, '#e6eeff'); g.addColorStop(1, '#4a7ff0');
      }
      l.fillStyle = g; l.fillText(lines[i].t, pad, base);
      l.globalCompositeOperation = 'source-atop';       // тонкий блик по верху букв — металл
      var hl = l.createLinearGradient(0, base - f * .75, 0, base - f * .2);
      hl.addColorStop(0, day ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.42)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      l.fillStyle = hl; l.fillRect(pad, base - f * .75, tw, f * .55);
      /* слой ложится в сцену со свечением (тень считается от формы букв) */
      c.shadowColor = day ? 'rgba(255,255,255,.75)' : 'rgba(60,120,255,.55)';
      c.shadowBlur = 36 * dpr;
      c.drawImage(lay, Math.round(w / 2 - lw / 2), Math.round(y - base));
      c.shadowBlur = 0; c.shadowColor = 'transparent';
      if (i + 1 < lines.length) y += gap + capH(lines[i + 1].k);
    }

    /* подпись */
    var capFs = Math.max(10 * dpr, Math.min(w * .0105, 15 * dpr));
    c.font = '600 ' + capFs + 'px Onest, system-ui, sans-serif';
    c.fillStyle = day ? 'rgba(10,15,26,.62)' : 'rgba(238,242,248,.66)';
    drawSpaced(c, 'ВАШ АВТОМОБИЛЬ В НАДЁЖНЫХ РУКАХ', w / 2, y + capFs * 3.4, capFs * .32);
  }

  /* размытая версия: последовательное уменьшение и возврат даёт мягкий блюр без ctx.filter (он есть не везде) */
  function drawFog() {
    var s1 = document.createElement('canvas'), s2 = document.createElement('canvas');
    var w1 = Math.max(8, Math.round(W / 4)), h1 = Math.max(8, Math.round(H / 4));
    var w2 = Math.max(6, Math.round(W / 13)), h2 = Math.max(6, Math.round(H / 13));
    s1.width = w1; s1.height = h1; s2.width = w2; s2.height = h2;
    var c1 = s1.getContext('2d'), c2 = s2.getContext('2d');
    c1.imageSmoothingQuality = c2.imageSmoothingQuality = bctx.imageSmoothingQuality = 'high';
    c1.drawImage(A, 0, 0, w1, h1);
    c2.drawImage(s1, 0, 0, w2, h2);
    c1.clearRect(0, 0, w1, h1);
    c1.drawImage(s2, 0, 0, w1, h1);
    bctx.clearRect(0, 0, W, H);
    bctx.drawImage(s1, 0, 0, W, H);
    /* вуаль запотевания */
    bctx.fillStyle = isDay ? 'rgba(255,255,255,.34)' : 'rgba(120,150,205,.17)';
    bctx.fillRect(0, 0, W, H);
    var g = bctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, isDay ? 'rgba(255,255,255,.06)' : 'rgba(150,180,235,.02)');
    g.addColorStop(1, isDay ? 'rgba(255,255,255,.22)' : 'rgba(150,180,235,.12)');
    bctx.fillStyle = g; bctx.fillRect(0, 0, W, H);
  }

  function buildScenes() {
    isDay = root.getAttribute('data-theme') === 'day';
    actx.setTransform(1, 0, 0, 1, 0, 0);
    actx.clearRect(0, 0, W, H);
    var c = actx;
    drawScene(c, isDay);
    drawFog();
  }

  /* ---------- Капли ---------- */
  function newDrop(anyY) {
    var u = Math.random(), r;
    if (u < .6) r = frand(1.1, 2.4);
    else if (u < .9) r = frand(2.4, 4.4);
    else r = frand(4.4, 8.6);
    return { x: Math.random() * cw, y: anyY ? Math.random() * ch : -r * 2, r: r, st: 0, v: 0, dist: 0, left: 0, px: 0, py: 0, ph: Math.random() * 6.28 };
  }
  function dropCount() {
    var n = Math.round(cw * ch / 11000);
    n = Math.max(48, Math.min(140, n));
    return cw < 720 ? Math.round(n * .7) : n;
  }
  function seedDrops(keepOld) {
    var want = dropCount(), i;
    if (keepOld && drops.length) {
      while (drops.length > want) drops.pop();
      while (drops.length < want) drops.push(newDrop(true));
      return;
    }
    drops = [];
    for (i = 0; i < want; i++) drops.push(newDrop(true));
  }
  function startSlide(d, fast) {
    if (d.st) return;
    d.st = 1; d.v = fast ? frand(90, 160) : frand(16, 40);
    d.left = fast ? frand(160, 380) : frand(50, 260);
    d.px = d.x; d.py = d.y;
  }
  function addEntry(e) {
    e.born = clock;
    entries.push(e);
    if (entries.length > 420) entries.splice(0, entries.length - 420);
  }
  function respawn(d) {
    var n = newDrop(true);
    n.r = frand(1.1, 2.6);
    d.x = n.x; d.y = n.y; d.r = n.r; d.st = 0; d.v = 0; d.ph = n.ph;
  }

  function updateDrops(dt) {
    var i, j, d, o;
    for (i = 0; i < drops.length; i++) {
      d = drops[i];
      if (d.st === 0) {
        if (d.r > 4.6 && Math.random() < dt * .06 * (d.r / 6)) startSlide(d, false);
        continue;
      }
      var acc = 420 * (.55 + d.r / 9);
      var vmax = 300 * (.5 + d.r / 10);
      d.v = Math.min(vmax, d.v + acc * dt);
      var step = d.v * dt;
      d.y += step; d.left -= step;
      d.x += Math.sin(clock * 6 + d.ph) * dt * 5 * (d.r / 6);
      /* дорожка: узкая полоска чистого стекла */
      if (Math.hypot(d.x - d.px, d.y - d.py) > 10) {
        addEntry({ k: 's', x0: d.px, y0: d.py, x1: d.x, y1: d.y, w: d.r * 1.15, hold: .35, fade: 2.3 });
        d.px = d.x; d.py = d.y;
      }
      /* слияние с каплями ниже */
      for (j = 0; j < drops.length; j++) {
        o = drops[j];
        if (o === d || o.st || o.y < d.y || o.y > d.y + d.r * 3 + o.r) continue;
        if (Math.abs(o.x - d.x) < (d.r + o.r) * .8) {
          d.r = Math.min(9.2, Math.sqrt(d.r * d.r + o.r * o.r * .7));
          respawn(o);
        }
      }
      if (d.left <= 0) {
        d.st = 0; d.v = 0; d.r = Math.max(2.2, d.r * .88);
      }
      if (d.y > ch + d.r * 2) respawn(d);
    }
    /* новые капли от дождя: то в одном, то в другом месте */
    if (drops.length && Math.random() < dt * 6) {
      var k = (Math.random() * drops.length) | 0;
      if (!drops[k].st && drops[k].r < 3) respawn(drops[k]);
    }
  }

  function drawDrops(c) {
    var i, d, r, rx, ry;
    var tint = isDay ? 'rgba(255,255,255,.10)' : 'rgba(150,190,255,.07)';
    var rim = isDay ? 'rgba(10,30,70,.42)' : 'rgba(0,0,0,.6)';
    for (i = 0; i < drops.length; i++) {
      d = drops[i]; r = d.r;
      if (d.y < -r || d.y > ch + r) continue;
      rx = r * .86; ry = r * 1.08;
      if (r < 3.6) {
        /* мелкая капля: светлая точка с тёмным краем */
        c.fillStyle = isDay ? 'rgba(255,255,255,.55)' : 'rgba(190,215,255,.26)';
        c.beginPath(); c.ellipse(d.x, d.y, rx, ry, 0, 0, 6.2832); c.fill();
        c.fillStyle = rim; c.globalAlpha = .55;
        c.beginPath(); c.ellipse(d.x + rx * .1, d.y + ry * .35, rx * .8, ry * .55, 0, 0, 6.2832); c.fill();
        c.globalAlpha = 1;
        c.fillStyle = 'rgba(255,255,255,.9)';
        c.beginPath(); c.arc(d.x - rx * .32, d.y - ry * .4, Math.max(.5, r * .22), 0, 6.2832); c.fill();
        continue;
      }
      /* крупная капля — линза: внутри чёткая картинка, перевёрнутая и увеличенная */
      c.save();
      c.beginPath(); c.ellipse(d.x, d.y, rx, ry, 0, 0, 6.2832); c.clip();
      c.translate(d.x, d.y); c.scale(1, -1);
      var sw = rx * 2 * dpr * 2.6, sh = ry * 2 * dpr * 2.6;
      c.drawImage(A, d.x * dpr - sw / 2, d.y * dpr - sh / 2, sw, sh, -rx, -ry, rx * 2, ry * 2);
      c.scale(1, -1); c.translate(-d.x, -d.y);
      c.fillStyle = tint; c.fillRect(d.x - rx, d.y - ry, rx * 2, ry * 2);
      var g = c.createRadialGradient(d.x, d.y - ry * .2, ry * .3, d.x, d.y, ry * 1.05);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.7, 'rgba(0,0,0,0)'); g.addColorStop(1, rim);
      c.fillStyle = g; c.fillRect(d.x - rx, d.y - ry, rx * 2, ry * 2);
      c.restore();
      c.strokeStyle = isDay ? 'rgba(255,255,255,.7)' : 'rgba(190,215,255,.3)'; c.lineWidth = .8;
      c.beginPath(); c.ellipse(d.x, d.y, rx, ry, 0, 0, 6.2832); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.88)';
      c.beginPath(); c.ellipse(d.x - rx * .34, d.y - ry * .42, Math.max(.7, rx * .22), Math.max(.9, ry * .16), -.5, 0, 6.2832); c.fill();
    }
  }

  /* ---------- Дворник ---------- */
  var wiper = { on: false, t: 0, dirBack: false, prev: 0 };
  var FWD = 1.3, BACK = 1.0;
  var A0 = 178 * Math.PI / 180, A1 = 2 * Math.PI / 180;
  function pivot() { return { x: cw * .5, y: ch + 16 }; }
  function wipeLen() { return Math.hypot(cw, ch) * 1.15; }
  function startWipe() {
    if (wiper.on) return;
    wiper.on = true; wiper.t = 0; wiper.dirBack = false; wiper.prev = A0;
    hero.classList.add('is-wiped');
  }
  function wiperAngle() {
    if (!wiper.dirBack) return A0 + (A1 - A0) * ease(Math.min(1, wiper.t / FWD));
    return A1 + (A0 - A1) * ease(Math.min(1, (wiper.t - FWD) / BACK));
  }
  function updateWiper(dt) {
    if (!wiper.on) return;
    wiper.t += dt;
    if (!wiper.dirBack && wiper.t >= FWD) wiper.dirBack = true;
    var a = wiperAngle();
    if (Math.abs(a - wiper.prev) > .002) {
      addEntry({ k: 'w', a0: wiper.prev, a1: a, hold: 1.5, fade: 3.2 });
      /* капли под лезвием смахиваются */
      var p = pivot(), L = wipeLen(), i, d, ang;
      for (i = 0; i < drops.length; i++) {
        d = drops[i];
        ang = Math.atan2(p.y - d.y, d.x - p.x);
        if (ang >= Math.min(a, wiper.prev) - .015 && ang <= Math.max(a, wiper.prev) + .015 && Math.hypot(d.x - p.x, d.y - p.y) < L) respawn(d);
      }
      wiper.prev = a;
    }
    if (wiper.t >= FWD + BACK) wiper.on = false;
  }
  function drawWiper(c) {
    if (!wiper.on) return;
    var a = wiperAngle(), p = pivot(), L = wipeLen();
    var ex = p.x + Math.cos(a) * L, ey = p.y - Math.sin(a) * L;
    var fade = Math.min(1, wiper.t / .2, (FWD + BACK - wiper.t) / .25);
    c.save();
    c.globalAlpha = Math.max(0, fade);
    c.lineCap = 'round';
    c.strokeStyle = isDay ? '#1b2231' : '#03050a';
    c.lineWidth = 6; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(ex, ey); c.stroke();
    c.strokeStyle = isDay ? 'rgba(255,255,255,.5)' : 'rgba(140,175,235,.4)';
    c.lineWidth = 1.2; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(ex, ey); c.stroke();
    var bx = p.x + Math.cos(a) * L * .42, by = p.y - Math.sin(a) * L * .42;
    c.strokeStyle = isDay ? '#0c1018' : '#000'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(bx, by); c.lineTo(ex, ey); c.stroke();
    c.restore();
  }

  /* ---------- Курсор ---------- */
  var ptr = { in: false, tx: 0, ty: 0, x: 0, y: 0, has: false, moved: 0 };
  function radius() { return Math.min(420, Math.max(160, cw * .16)); }
  function updateCursor(dt) {
    if (!fine || !ptr.in) return;
    var k = 1 - Math.pow(.9, dt * 60);              // лерп 0.1 за кадр
    var nx = ptr.x + (ptr.tx - ptr.x) * k, ny = ptr.y + (ptr.ty - ptr.y) * k;
    var dx = nx - ptr.x, dy = ny - ptr.y, dist = Math.hypot(dx, dy);
    var R = radius(), space = R * .26;
    if (!ptr.has) { ptr.has = true; addEntry({ k: 'c', x: nx, y: ny, r: R, hold: .9, fade: 3.3 }); }
    if (dist > .3) {
      var n = Math.max(1, Math.floor(dist / space)), i;
      if (dist >= space || entries.length === 0 || ptr._acc + dist >= space) {
        for (i = 1; i <= n; i++) addEntry({ k: 'c', x: ptr.x + dx * i / n, y: ptr.y + dy * i / n, r: R, hold: .9, fade: 3.3 });
        ptr._acc = 0;
      } else { ptr._acc += dist; }
      ptr.moved += dist;
      if (ptr.moved > 500) hero.classList.add('is-wiped');
      ptr.x = nx; ptr.y = ny;
      /* «антидождь»: капли рядом с протёртым местом скатываются */
      var j, d, rr = R * .7;
      for (j = 0; j < drops.length; j++) {
        d = drops[j];
        if (!d.st && d.r > 2.2 && Math.hypot(d.x - nx, d.y - ny) < rr && Math.random() < .12) startSlide(d, true);
      }
    }
  }
  ptr._acc = 0;

  /* ---------- Маска и кадр ---------- */
  function alphaOf(e) {
    var age = clock - e.born;
    if (age <= e.hold) return 1;
    var t = (age - e.hold) / e.fade;
    return t >= 1 ? 0 : 1 - t * t * (3 - 2 * t);
  }
  function drawMask() {
    var i, e, a, g, p, L;
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, M.width, M.height);
    mctx.setTransform(M.width / cw, 0, 0, M.height / ch, 0, 0);
    p = pivot(); L = wipeLen();
    for (i = 0; i < entries.length; i++) {
      e = entries[i];
      a = e.perm ? 1 : alphaOf(e);
      if (a <= 0.004) continue;
      mctx.globalAlpha = a;
      if (e.k === 'c') {
        g = mctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r);
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.5, 'rgba(0,0,0,.92)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = g;
        mctx.fillRect(e.x - e.r, e.y - e.r, e.r * 2, e.r * 2);
      } else if (e.k === 's') {
        mctx.strokeStyle = '#000'; mctx.lineWidth = e.w; mctx.lineCap = 'round';
        mctx.beginPath(); mctx.moveTo(e.x0, e.y0); mctx.lineTo(e.x1, e.y1); mctx.stroke();
      } else if (e.k === 'w') {
        mctx.fillStyle = '#000';
        mctx.beginPath(); mctx.moveTo(p.x, p.y);
        mctx.lineTo(p.x + Math.cos(e.a0) * L, p.y - Math.sin(e.a0) * L);
        mctx.lineTo(p.x + Math.cos(e.a1) * L, p.y - Math.sin(e.a1) * L);
        mctx.closePath(); mctx.fill();
      }
    }
    mctx.globalAlpha = 1;
  }
  function pruneEntries() {
    var i, out = [], e;
    for (i = 0; i < entries.length; i++) {
      e = entries[i];
      if (e.perm || clock - e.born < e.hold + e.fade) out.push(e);
    }
    entries = out;
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(B, 0, 0);
    if (entries.length) {
      drawMask();
      tctx.globalCompositeOperation = 'source-over';
      tctx.clearRect(0, 0, W, H);
      tctx.drawImage(A, 0, 0);
      tctx.globalCompositeOperation = 'destination-in';
      tctx.drawImage(M, 0, 0, M.width, M.height, 0, 0, W, H);
      tctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(T, 0, 0);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawDrops(ctx);
    drawWiper(ctx);
  }

  function frame(now) {
    rafId = 0;
    if (!running) return;
    var dt = last ? Math.min(.05, (now - last) / 1000) : .016;
    last = now; clock += dt;
    updateCursor(dt); updateWiper(dt); updateDrops(dt);
    pruneEntries();
    render();
    rafId = requestAnimationFrame(frame);
  }
  function play() {
    if (reduce || running || !visible || document.hidden || !W || !drops.length) return;   // размера ещё нет — ждём resize
    running = true; last = 0; rafId = requestAnimationFrame(frame);
  }
  function stop() { running = false; if (rafId) cancelAnimationFrame(rafId); rafId = 0; }

  /* ---------- Размер и запуск ---------- */
  var ready = false;
  function resize() {
    var nw = hero.clientWidth, nh = hero.clientHeight;
    if (!nw || !nh) return;
    var oldW = cw, oldH = ch;
    cw = nw; ch = nh;
    dpr = Math.min(window.devicePixelRatio || 1, nw < 720 ? 1.25 : 1.5);
    W = Math.round(cw * dpr); H = Math.round(ch * dpr);
    canvas.width = A.width = B.width = T.width = W;
    canvas.height = A.height = B.height = T.height = H;
    M.width = Math.max(8, Math.round(W / 2)); M.height = Math.max(8, Math.round(H / 2));
    buildScenes();
    if (oldW && drops.length) {
      var i, sx = cw / oldW, sy = ch / oldH;
      for (i = 0; i < drops.length; i++) { drops[i].x *= sx; drops[i].y *= sy; drops[i].px *= sx; drops[i].py *= sy; }
      seedDrops(true);
      entries = entries.filter(function (e) { return e.perm; });
    } else {
      seedDrops(false);
    }
    if (reduce) staticFrame(); else { render(); play(); }
  }
  function staticFrame() {
    entries = [{ k: 'w', a0: 124 * Math.PI / 180, a1: 56 * Math.PI / 180, born: 0, hold: 1, fade: 1, perm: true }];
    render();
  }

  var rt = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { if (ready) resize(); }, 160);
  });
  new MutationObserver(function () { if (ready && W) { buildScenes(); if (reduce) staticFrame(); else render(); } })
    .observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else play(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible && ready && !W) resize();           // на старте размера не было (скрытая вкладка/панель) — считаем сейчас
      if (visible) play(); else stop();
    }, { threshold: 0 }).observe(hero);
  }

  /* мышь: протираем; касание: дворник */
  if (fine) {
    hero.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'touch') return;
      var r = canvas.getBoundingClientRect();
      ptr.in = true; ptr.tx = ptr.x = e.clientX - r.left; ptr.ty = ptr.y = e.clientY - r.top; ptr.has = false;
    });
    hero.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var r = canvas.getBoundingClientRect();
      ptr.in = true; ptr.tx = e.clientX - r.left; ptr.ty = e.clientY - r.top;
    });
    hero.addEventListener('pointerleave', function () { ptr.in = false; ptr.has = false; });
  }
  canvas.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && fine) return;   // мышью стекло уже протирается движением
    startWipe();
  });
  canvas.addEventListener('click', function () { if (fine) startWipe(); });

  function init() {
    resize();
    ready = true;
    hero.classList.add('has-glass');
    if (reduce) return;                               // без движения: статичный кадр, подсказки «проведите» нет
    play();
    setTimeout(function () { hero.classList.add('is-live'); startWipe(); hero.classList.remove('is-wiped'); }, 450);
    if (!fine) {
      setInterval(function () { if (visible && !document.hidden && !wiper.on) startWipe(); }, 7000);
    }
  }

  /* ждём шрифт, чтобы надпись сразу рисовалась Exo 2; не дольше 1.5 с */
  var started = false;
  function go() { if (started) return; started = true; init(); }
  if (document.fonts && document.fonts.load) {
    Promise.race([
      document.fonts.load('900 100px "Exo 2"'),
      new Promise(function (r) { setTimeout(r, 1500); })
    ]).then(go, go);
    document.fonts.ready.then(function () { if (ready && W) { buildScenes(); if (reduce) staticFrame(); else render(); } });
  } else {
    go();
  }

  window.AGGlass = { wipe: startWipe };
})();
