/** Reveal-on-scroll helpers + animated number + confirm dialog */

export function applyReveal(root = document) {
  const els = [...root.querySelectorAll('.reveal:not(.is-visible)')];
  if (!els.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.01, rootMargin: '0px 0px -4% 0px' }
  );
  els.forEach((el) => io.observe(el));
  // Fallback: if still hidden after a beat (IO miss / zero-size), show them
  setTimeout(() => {
    els.forEach((el) => {
      if (!el.classList.contains('is-visible')) {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) {
          el.classList.add('is-visible');
          io.unobserve(el);
        }
      }
    });
  }, 120);
}

export function revealDelay(ms) {
  return `style="--reveal-delay:${ms}ms"`;
}

export function animateNumber(el, value, type = 'number', duration = 1100) {
  if (!el) return;
  const start = performance.now();
  const from = 0;
  const to = Number(value) || 0;

  function format(v) {
    if (type === 'currency') return `$${Math.round(v).toLocaleString('en-US')}`;
    if (type === 'percent') return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
    return Math.round(v).toLocaleString('en-US');
  }

  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(2, -10 * t); // easeOutExpo-ish
    el.textContent = format(from + (to - from) * (t === 1 ? 1 : eased));
    if (t < 1) requestAnimationFrame(frame);
    else el.textContent = format(to);
  }
  requestAnimationFrame(frame);
}

let confirmResolve = null;

export function initConfirmDialog() {
  const root = document.getElementById('confirm-root');
  if (!root) return;
  root.innerHTML = `
    <div class="confirm-backdrop is-hidden" id="confirm-backdrop">
      <div class="confirm-dialog" role="dialog" aria-modal="true">
        <h3 id="confirm-title">确认操作</h3>
        <p id="confirm-message"></p>
        <div class="confirm-actions">
          <button type="button" class="btn-ghost" id="confirm-cancel">取消</button>
          <button type="button" class="btn-danger" id="confirm-ok">确认</button>
        </div>
      </div>
    </div>
  `;
  const bd = root.querySelector('#confirm-backdrop');
  root.querySelector('#confirm-cancel').onclick = () => closeConfirm(false);
  root.querySelector('#confirm-ok').onclick = () => closeConfirm(true);
  bd.addEventListener('click', (e) => {
    if (e.target === bd) closeConfirm(false);
  });
}

function closeConfirm(ok) {
  const bd = document.getElementById('confirm-backdrop');
  if (bd) bd.classList.add('is-hidden');
  if (confirmResolve) {
    confirmResolve(ok);
    confirmResolve = null;
  }
}

export function showConfirm(title, message) {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    const bd = document.getElementById('confirm-backdrop');
    const t = document.getElementById('confirm-title');
    const m = document.getElementById('confirm-message');
    if (t) t.textContent = title;
    if (m) m.textContent = message || '';
    if (bd) bd.classList.remove('is-hidden');
  });
}

/** Floating background canvas */
export function startBgShapes() {
  const c = document.getElementById('bg-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  if (!ctx) return;

  let running = true;
  let animId = 0;

  const resize = () => {
    c.width = window.innerWidth;
    c.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);

  const isDark = () =>
    !document.documentElement.getAttribute('data-theme') ||
    document.documentElement.getAttribute('data-theme') === 'dark';

  const shapes = Array.from({ length: 12 }, () => ({
    x: Math.random() * c.width,
    y: Math.random() * c.height,
    size: Math.random() * 40 + 10,
    speedX: (Math.random() - 0.5) * 0.5,
    speedY: (Math.random() - 0.5) * 0.5 - 0.2,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.006,
    opacity: Math.random() * 0.08 + 0.02,
    type: Math.floor(Math.random() * 3),
    hue: Math.random() > 0.5 ? 40 : 260,
  }));

  function draw() {
    if (!running) return;
    ctx.clearRect(0, 0, c.width, c.height);
    const dark = isDark();

    for (const s of shapes) {
      s.x += s.speedX;
      s.y += s.speedY;
      s.rotation += s.rotSpeed;
      if (s.x < -60) s.x = c.width + 60;
      if (s.x > c.width + 60) s.x = -60;
      if (s.y < -60) s.y = c.height + 60;
      if (s.y > c.height + 60) s.y = -60;

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
      ctx.globalAlpha = dark ? s.opacity : s.opacity * 0.6;
      const hsl = dark
        ? `hsla(${s.hue}, 80%, 65%, ${s.opacity * 5})`
        : `hsla(${s.hue}, 60%, 50%, ${s.opacity * 3})`;
      ctx.fillStyle = hsl;
      ctx.strokeStyle = hsl;
      ctx.lineWidth = 1;

      if (s.type === 0) {
        ctx.beginPath();
        ctx.arc(0, 0, s.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (s.type === 1) {
        ctx.beginPath();
        ctx.moveTo(0, -s.size / 2);
        ctx.lineTo(s.size / 2, 0);
        ctx.lineTo(0, s.size / 2);
        ctx.lineTo(-s.size / 2, 0);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.beginPath();
        const r = s.size / 2;
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.87, r * 0.5);
        ctx.lineTo(-r * 0.87, r * 0.5);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }
    animId = requestAnimationFrame(draw);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(animId);
    } else if (!running) {
      running = true;
      animId = requestAnimationFrame(draw);
    }
  });

  draw();
}
