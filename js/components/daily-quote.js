import { SPLASH_QUOTES } from '../data/splash-quotes.js';

const STORAGE_KEY = 'myweb_last_quote_date';

export function mountDailyQuote() {
  const root = document.getElementById('quote-root');
  if (!root) return;

  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem(STORAGE_KEY) === today) return;

  const quote = SPLASH_QUOTES[Math.floor(Math.random() * SPLASH_QUOTES.length)] || '';
  const lines = String(quote).split('\n');

  root.innerHTML = `
    <div class="quote-splash" id="quote-splash">
      <canvas class="quote-canvas" id="quote-canvas"></canvas>
      <div class="quote-stage" id="quote-stage">
        ${lines.map((l) => `<p class="quote-text">${l}</p>`).join('')}
        <p class="tap-hint">轻触任意处进入</p>
      </div>
    </div>
  `;

  const splash = root.querySelector('#quote-splash');
  const stage = root.querySelector('#quote-stage');
  const canvas = root.querySelector('#quote-canvas');
  let animId = 0;

  // Starfield
  const ctx = canvas.getContext('2d');
  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);

  const stars = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 1.4 + 0.3,
    a: Math.random(),
    da: (Math.random() - 0.5) * 0.02,
  }));

  function drawStars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      s.a += s.da;
      if (s.a <= 0.1 || s.a >= 1) s.da *= -1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(240, 192, 96, ${s.a * 0.7})`;
      ctx.fill();
    }
    animId = requestAnimationFrame(drawStars);
  }
  drawStars();

  setTimeout(() => stage.classList.add('revealed'), 80);

  function dismiss() {
    stage.classList.remove('revealed');
    splash.classList.add('dismissing');
    setTimeout(() => {
      cancelAnimationFrame(animId);
      localStorage.setItem(STORAGE_KEY, today);
      root.innerHTML = '';
    }, 400);
  }

  splash.addEventListener('click', dismiss);
  setTimeout(dismiss, 8000);
}
