from playwright.sync_api import sync_playwright
import time

BASE = "http://127.0.0.1:3000"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.add_init_script("localStorage.setItem('theme','dark')")
    page.goto(f"{BASE}/#/", wait_until="networkidle")
    page.wait_for_timeout(600)
    page.evaluate("() => document.querySelector('#quote-splash')?.remove()")

    orb = page.locator("#theme-orb")
    box = orb.bounding_box()
    cx = box["x"] + box["width"] / 2
    cy = box["y"] + box["height"] / 2

    # wake
    page.mouse.move(cx - 40, cy)
    page.wait_for_timeout(400)
    print("awake:", page.eval_on_selector("#theme-orb", "el => el.classList.contains('awake')"))

    # measure morph frame times via rAF
    page.evaluate("""() => {
      window.__frames = [];
      let last = performance.now();
      function tick(t) {
        window.__frames.push(t - last);
        last = t;
        if (window.__frames.length < 40) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }""")
    page.mouse.move(cx, cy)
    page.click("#theme-orb")
    page.wait_for_timeout(900)
    frames = page.evaluate("() => window.__frames")
    if frames:
        avg = sum(frames) / len(frames)
        mx = max(frames)
        long_f = sum(1 for f in frames if f > 32)
        print(f"morph frames n={len(frames)} avg={avg:.1f}ms max={mx:.1f}ms long>32ms={long_f}")

    # wave uses transform scale?
    wave = page.evaluate("""() => {
      const w = document.querySelector('#theme-wave');
      const cs = getComputedStyle(w);
      return { transform: cs.transform, opacity: cs.opacity, width: cs.width };
    }""")
    print("wave after morph:", wave)

    # no filter on orb/svg
    filters = page.evaluate("""() => {
      const o = getComputedStyle(document.querySelector('#theme-orb')).filter;
      const l = getComputedStyle(document.querySelector('.orb-layer')).filter;
      return { orb: o, layer: l };
    }""")
    print("filters:", filters)

    # layers exist
    layers = page.evaluate("""() => ({
      moon: !!document.querySelector('.orb-layer-moon'),
      sun: !!document.querySelector('.orb-layer-sun'),
    })""")
    print("layers:", layers)

    # continuous far movement sleep still works
    import math
    for i in range(30):
        page.mouse.move(500 + 100 * math.cos(i / 3), 500 + 80 * math.sin(i / 3))
        page.wait_for_timeout(40)
    page.wait_for_timeout(900)
    print("asleep after far move:", not page.eval_on_selector("#theme-orb", "el => el.classList.contains('awake')"))

    browser.close()
print("done")
