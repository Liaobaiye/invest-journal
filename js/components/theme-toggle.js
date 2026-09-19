/**
 * 主题切换球：暗色=月亮，亮色=太阳
 * 默认休眠；靠近 140px 苏醒；月↔日形变过渡
 */
export function mountThemeToggle() {
  const root = document.getElementById('theme-root');
  if (!root) return;

  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  const isLight = saved === 'light';

  root.innerHTML = `
    <div class="theme-wave" id="theme-wave"></div>
    <div class="theme-orb ${isLight ? 'light' : ''}" id="theme-orb" title="切换主题" role="button" tabindex="0" aria-label="切换主题">
      <div class="orb-glow"></div>
      <div class="orb-core">
        <div class="orb-layer orb-layer-moon">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <defs>
              <radialGradient id="moonFill" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stop-color="#fff6d6"/>
                <stop offset="45%" stop-color="#f0d78c"/>
                <stop offset="100%" stop-color="#b8893a"/>
              </radialGradient>
            </defs>
            <g transform="translate(1, 11)">
              <path fill="url(#moonFill)" d="M40 6c-2.2 1.8-3.6 4.6-3.6 7.8 0 5.8 4.7 10.5 10.5 10.5 1.4 0 2.7-.3 3.9-.8C47.8 31.2 40.2 38 30.8 38 19.3 38 10 28.7 10 17.2 10 9.2 14.4 2.4 20.8.2 26.8-1.8 34.2.4 40 6z"/>
              <circle cx="24" cy="18" r="2.4" fill="rgba(120,80,20,0.18)"/>
              <circle cx="30" cy="26" r="1.6" fill="rgba(120,80,20,0.14)"/>
              <circle cx="20" cy="26" r="1.2" fill="rgba(120,80,20,0.12)"/>
            </g>
          </svg>
        </div>
        <div class="orb-layer orb-layer-sun">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <defs>
              <radialGradient id="sunFill" cx="40%" cy="35%" r="65%">
                <stop offset="0%" stop-color="#fff3c4"/>
                <stop offset="50%" stop-color="#fdcb6e"/>
                <stop offset="100%" stop-color="#e17055"/>
              </radialGradient>
            </defs>
            <g class="sun-rays">
              <line x1="32" y1="4" x2="32" y2="10"/>
              <line x1="32" y1="54" x2="32" y2="60"/>
              <line x1="4" y1="32" x2="10" y2="32"/>
              <line x1="54" y1="32" x2="60" y2="32"/>
              <line x1="12.2" y1="12.2" x2="16.4" y2="16.4"/>
              <line x1="47.6" y1="47.6" x2="51.8" y2="51.8"/>
              <line x1="12.2" y1="51.8" x2="16.4" y2="47.6"/>
              <line x1="47.6" y1="16.4" x2="51.8" y2="12.2"/>
            </g>
            <circle cx="32" cy="32" r="14" fill="url(#sunFill)"/>
          </svg>
        </div>
      </div>
    </div>
  `;

  const orb = root.querySelector('#theme-orb');
  const wave = root.querySelector('#theme-wave');
  const HOT = 140;
  let hideTimer = null;
  let morphTimer = null;
  let awake = false;
  let hovering = false;
  let lastX = -9999;
  let lastY = -9999;
  let morphing = false;
  /** 缓存球心，避免每次 mousemove 都 getBoundingClientRect */
  let orbCx = 0;
  let orbCy = 0;
  let centerDirty = true;

  function refreshCenter() {
    const r = orb.getBoundingClientRect();
    orbCx = r.left + r.width / 2;
    orbCy = r.top + r.height / 2;
    centerDirty = false;
  }

  refreshCenter();
  window.addEventListener('resize', () => { centerDirty = true; refreshCenter(); }, { passive: true });
  window.addEventListener('scroll', () => { centerDirty = true; }, { passive: true });

  function setAwake(on) {
    if (on === awake) return;
    awake = on;
    orb.classList.toggle('awake', on);
  }

  function nearOrb(x, y) {
    if (centerDirty) refreshCenter();
    const dx = x - orbCx;
    const dy = y - orbCy;
    return dx * dx + dy * dy <= HOT * HOT;
  }

  function clearHide() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  /**
   * 只在尚未排定时才启动休眠计时。
   * 鼠标持续移动时不要不断 clear+重排，否则永远收不回去。
   */
  function scheduleHide(ms) {
    if (hideTimer) return;
    hideTimer = setTimeout(() => {
      hideTimer = null;
      if (morphing) return;
      if (hovering) return;
      if (lastX > -9000 && nearOrb(lastX, lastY)) return;
      setAwake(false);
    }, ms);
  }

  function pokeAwake() {
    clearHide();
    setAwake(true);
  }

  let moveRaf = 0;
  window.addEventListener('mousemove', (e) => {
    lastX = e.clientX;
    lastY = e.clientY;
    if (moveRaf) return;
    moveRaf = requestAnimationFrame(() => {
      moveRaf = 0;
      if (nearOrb(lastX, lastY) || hovering) {
        pokeAwake();
      } else if (awake) {
        scheduleHide(700);
      }
    });
  }, { passive: true });

  orb.addEventListener('mouseenter', () => {
    hovering = true;
    pokeAwake();
  });
  orb.addEventListener('mouseleave', () => {
    hovering = false;
    scheduleHide(900);
  });
  orb.addEventListener('focus', () => {
    hovering = true;
    pokeAwake();
  });
  orb.addEventListener('blur', () => {
    hovering = false;
    scheduleHide(600);
  });
  orb.addEventListener('touchstart', () => {
    pokeAwake();
  }, { passive: true });

  function toggle() {
    if (morphing) return;
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    const toLight = next === 'light';

    morphing = true;
    pokeAwake();
    clearHide();
    localStorage.setItem('theme', next);

    // 立刻形变 + 切主题（无全屏遮罩等待，总时长 ~0.35s）
    orb.classList.add('morphing');
    orb.classList.toggle('to-light', toLight);
    orb.classList.toggle('to-dark', !toLight);

    requestAnimationFrame(() => {
      orb.classList.toggle('light', toLight);
      document.documentElement.setAttribute('data-theme', next);
    });

    clearTimeout(morphTimer);
    morphTimer = setTimeout(() => {
      morphing = false;
      orb.classList.remove('morphing', 'to-light', 'to-dark');
      const stillNear = lastX > -9000 && nearOrb(lastX, lastY);
      if (!hovering && !stillNear) {
        scheduleHide(400);
      }
    }, 360);
  }

  orb.addEventListener('click', toggle);
  orb.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });
}
