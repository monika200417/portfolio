(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Navigation ---------------- */
  const header = document.getElementById('header');
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('navmenu');
  const links = Array.from(menu.querySelectorAll('a[href^="#"]'));

  function setMenu(open) {
    menu.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('i').className = open ? 'bi bi-x' : 'bi bi-list';
  }
  toggle.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu.classList.contains('open')) { setMenu(false); toggle.focus(); }
  });
  document.addEventListener('click', e => {
    if (menu.classList.contains('open') && !header.contains(e.target)) setMenu(false);
  });

  // smooth scroll + keep focus moving to the target section
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      setMenu(false);
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      history.pushState(null, '', id);
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  });

  // links opened with a #section (including redirects from old pages) land on that section
  window.addEventListener('load', () => {
    const target = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
  });

  // active link = section crossing the middle of the viewport
  const sections = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  function setActive(id) {
    links.forEach(a => {
      const on = a.getAttribute('href') === '#' + id;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  }
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) setActive(en.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(s => spy.observe(s));
  }

  /* ---------------- Reveal on scroll (subtle) ---------------- */
  const revealEls = document.querySelectorAll('.section-head, .card, .timeline > li, .gallery-block, .about-grid');
  revealEls.forEach(el => el.classList.add('reveal'));
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); obs.unobserve(en.target); } });
    }, { threshold: .12 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }

  /* ---------------- Lightbox ---------------- */
  if (window.GLightbox) GLightbox({ selector: '.glightbox', touchNavigation: true, loop: true });

  /* ---------------- Contact form (EmailJS, same account/ids as before) ---------------- */
  const form = document.getElementById('contact-form');
  const statusEl = document.getElementById('formStatus');
  const sendBtn = document.getElementById('sendBtn');
  if (window.emailjs) emailjs.init({ publicKey: 'yt6lDfpasUGdckyBf' });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    statusEl.className = 'form-status';
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (!window.emailjs) {
      statusEl.textContent = 'The mail service could not load. Please email me directly.';
      statusEl.classList.add('err');
      return;
    }
    sendBtn.disabled = true; sendBtn.textContent = 'Sending…';
    try {
      await emailjs.sendForm('service_4p86i0l', 'template_q37o3e1', form);
      statusEl.textContent = 'Message sent successfully! Thank you.';
      statusEl.classList.add('ok');
      form.reset();
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Failed to send message. Please try again or email me directly.';
      statusEl.classList.add('err');
    } finally {
      sendBtn.disabled = false; sendBtn.textContent = 'Send message';
    }
  });

  /* ============================================================
     HERO: cursor-controlled dry-brush scratch reveal
     Canvas draws IMAGE 1 (cover), brush stamps erase it with
     destination-out, revealing IMAGE 2 (an <img> underneath).
     Nothing is revealed until the user moves over the hero.
     ============================================================ */
  const hero = document.getElementById('home');
  const canvas = document.getElementById('mask');
  const ctx = canvas.getContext('2d');
  const LIFETIME = 2.7, SAMPLES = 48, FOLLOW = 0.17, SPACING = 0.09, MAX_STAMPS = 1400;

  const topImg = new Image();
  topImg.src = 'assets/img/hero/hero-top.webp';

  let W = 0, H = 0, DPR = 1, brushR = 100;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    const r = hero.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    brushR = Math.min(W, H) * 0.175;
  }
  window.addEventListener('resize', resize);
  resize();

  // Opacity of IMAGE 1's white backdrop (1 = solid, lower = more of IMAGE 2 shows through).
  const BACKDROP_ALPHA = 0.75;
  let topLayer = null;           // IMAGE 1 with its translucent backdrop

  // Flood-fill from the image borders over light, neutral pixels, so only the
  // studio wall fades: eyes and other highlights inside the portrait stay solid.
  function fadeBackdrop(img) {
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    try {
      const data = g.getImageData(0, 0, w, h), px = data.data;
      const seen = new Uint8Array(w * h), stack = [];
      const visit = i => {
        if (seen[i]) return;
        seen[i] = 1;
        const r = px[i * 4], gr = px[i * 4 + 1], b = px[i * 4 + 2];
        const max = Math.max(r, gr, b), min = Math.min(r, gr, b);
        if (min < 190 || max - min > 24) return;     // not backdrop
        px[i * 4 + 3] = Math.round(255 * BACKDROP_ALPHA);
        stack.push(i);
      };
      for (let x = 0; x < w; x++) { visit(x); visit((h - 1) * w + x); }
      for (let y = 0; y < h; y++) { visit(y * w); visit(y * w + w - 1); }
      while (stack.length) {
        const i = stack.pop(), x = i % w;
        if (x > 0) visit(i - 1);
        if (x < w - 1) visit(i + 1);
        if (i >= w) visit(i - w);
        if (i < w * (h - 1)) visit(i + w);
      }
      g.putImageData(data, 0, 0);
    } catch (err) {
      console.warn('Backdrop transparency unavailable (open the page over http).', err);
    }
    return c;
  }

  function drawCover(img) {
    const iw = img.width, ih = img.height;
    const s = Math.max(W / iw, H / ih);
    const dw = iw * s, dh = ih * s;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  const stamps = [];
  let inside = false, tx = 0, ty = 0, sx = 0, sy = 0, lastX = 0, lastY = 0;
  let dirAngle = 0, stretch = 1, speedSm = 0, seedCounter = Math.random() * 1000;

  const pos = e => { const r = hero.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function enter(e) {
    const [x, y] = pos(e);
    tx = x; ty = y; sx = x; sy = y; lastX = x; lastY = y;
    speedSm = 0; inside = true;
  }
  function leave() { inside = false; }
  hero.addEventListener('pointerenter', enter);
  hero.addEventListener('pointerdown', enter);
  hero.addEventListener('pointermove', e => { if (!inside) enter(e); const p = pos(e); tx = p[0]; ty = p[1]; });
  hero.addEventListener('pointerleave', leave);
  hero.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') leave(); });
  hero.addEventListener('pointercancel', leave);
  window.addEventListener('blur', leave);

  function makeStamp(x, y, angle, str, now) {
    const seed = (seedCounter += 1.618);
    const noise = new Float32Array(SAMPLES);
    for (let i = 0; i < SAMPLES; i++) {
      let n = (hash(seed * 7.13 + i) - 0.5) * 0.11;
      if (hash(seed * 3.91 + i * 1.7) > 0.9) n -= 0.10 + hash(seed + i) * 0.12;
      else if (hash(seed * 5.17 + i * 2.3) > 0.92) n += 0.07;
      noise[i] = n;
    }
    const holes = [];
    if (hash(seed * 2.3) > 0.4) {
      const count = 1 + Math.floor(hash(seed * 4.4) * 3);
      for (let k = 0; k < count; k++) holes.push({
        a: hash(seed * 9.1 + k) * Math.PI * 2, d: 0.45 + hash(seed * 6.6 + k) * 0.4,
        len: 0.10 + hash(seed * 8.2 + k) * 0.20, wid: 0.015 + hash(seed * 1.9 + k) * 0.035,
        rot: hash(seed * 3.3 + k) * Math.PI
      });
    }
    return { x, y, angle, stretch: str, born: now, seed, noise, holes, r0: brushR * (0.92 + hash(seed * 1.3) * 0.16) };
  }

  const pts = Array.from({ length: SAMPLES }, () => [0, 0]);
  function drawStamp(s, now) {
    const age = now - s.born;
    const life = Math.max(0, 1 - age / LIFETIME);
    if (life <= 0) return;
    const R = s.r0 * Math.pow(life, 0.85);
    if (R < 0.5) return;
    const t = s.seed + age * 0.35;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.scale(s.stretch, 1 / Math.sqrt(s.stretch));
    for (let i = 0; i < SAMPLES; i++) {
      const a = (i / SAMPLES) * Math.PI * 2;
      const rad = R * (1 + 0.085 * Math.sin(3 * a + t + s.seed) + 0.048 * Math.sin(5 * a - t * 1.15 + s.seed * 2.1)
        + 0.022 * Math.sin(9 * a + t * 0.6 + s.seed * 3.7) + s.noise[i]);
      pts[i][0] = Math.cos(a) * rad; pts[i][1] = Math.sin(a) * rad;
    }
    ctx.beginPath();
    const n = SAMPLES;
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
    ctx.closePath();
    for (const h of s.holes) {
      const cx = Math.cos(h.a) * R * h.d, cy = Math.sin(h.a) * R * h.d;
      ctx.moveTo(cx + Math.cos(h.rot) * R * h.len, cy + Math.sin(h.rot) * R * h.len);
      ctx.ellipse(cx, cy, R * h.len, R * h.wid, h.rot, 0, Math.PI * 2);
    }
    ctx.fill('evenodd');
    ctx.restore();
  }

  let heroVisible = true, prev = performance.now(), running = false;
  function frame(nowMs) {
    if (!heroVisible && !stamps.length) { running = false; return; }
    const dt = Math.min(0.05, (nowMs - prev) / 1000);
    prev = nowMs;
    const now = nowMs / 1000;

    if (inside) {
      const k = 1 - Math.pow(1 - FOLLOW, dt * 60);
      const ox = sx, oy = sy;
      sx += (tx - sx) * k; sy += (ty - sy) * k;
      const speed = dt > 0 ? Math.hypot(sx - ox, sy - oy) / dt : 0;
      speedSm += (speed - speedSm) * 0.2;
      const spacing = Math.max(2, brushR * SPACING);
      const dx = sx - lastX, dy = sy - lastY;
      let dist = Math.hypot(dx, dy);
      if (dist >= spacing) {
        let diff = Math.atan2(dy, dx) - dirAngle;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        dirAngle += diff * 0.35;
        stretch += (1.06 + Math.min(0.28, speedSm / 2600 * 0.28) - stretch) * 0.25;
        const ux = dx / dist, uy = dy / dist;
        while (dist >= spacing) {
          lastX += ux * spacing; lastY += uy * spacing; dist -= spacing;
          stamps.push(makeStamp(lastX, lastY, dirAngle, stretch, now));
        }
        if (stamps.length > MAX_STAMPS) stamps.splice(0, stamps.length - MAX_STAMPS);
      }
    }
    let w = 0;
    for (let i = 0; i < stamps.length; i++) if (now - stamps[i].born < LIFETIME) stamps[w++] = stamps[i];
    stamps.length = w;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    if (topLayer) { drawCover(topLayer); hero.classList.add('ready'); }
    if (stamps.length) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
      for (let i = 0; i < stamps.length; i++) drawStamp(stamps[i], now);
      ctx.globalCompositeOperation = 'source-over';
    }
    requestAnimationFrame(frame);
  }
  function start() { if (!running) { running = true; prev = performance.now(); requestAnimationFrame(frame); } }
  topImg.decode().then(() => { topLayer = fadeBackdrop(topImg); start(); })
    .catch(err => console.error('Hero image failed to load', err));
  start();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; if (heroVisible) { inside = false; start(); } })
      .observe(hero);
  }
})();
