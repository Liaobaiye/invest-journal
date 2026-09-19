from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"
OUT = "scripts/_orb_clean"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.add_init_script("localStorage.setItem('theme','dark')")
    page.goto(f"{BASE}/#/", wait_until="networkidle")
    page.wait_for_timeout(600)
    page.evaluate("() => document.querySelector('#quote-splash')?.remove()")

    orb = page.locator("#theme-orb")
    box = orb.bounding_box()
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    clip = {"x": int(cx - 90), "y": int(cy - 90), "width": 180, "height": 180}

    page.mouse.move(cx - 40, cy)
    page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}_1_moon.png", clip=clip)

    # no ::after ring?
    has_after = page.evaluate("""() => {
      const el = document.querySelector('.orb-core');
      return getComputedStyle(el, '::after').content;
    }""")
    print("orb-core::after content:", has_after)

    page.click("#theme-orb")
    page.wait_for_timeout(100)
    # covering
    wave = page.evaluate("""() => {
      const w = document.querySelector('#theme-wave');
      const cs = getComputedStyle(w);
      return { opacity: cs.opacity, classes: w.className, bg: w.style.background || cs.backgroundColor };
    }""")
    print("wave covering:", wave)

    page.wait_for_timeout(250)
    page.screenshot(path=f"{OUT}_2_mid.png", clip=clip)
    theme = page.evaluate("() => document.documentElement.dataset.theme")
    print("theme mid:", theme)

    page.wait_for_timeout(700)
    page.mouse.move(cx, cy)
    page.wait_for_timeout(200)
    page.screenshot(path=f"{OUT}_3_sun.png", clip=clip)

    # page should be light, no ring
    body_bg = page.evaluate("() => getComputedStyle(document.body).backgroundColor")
    print("body bg:", body_bg)

    # toggle back
    page.click("#theme-orb")
    page.wait_for_timeout(900)
    print("theme back:", page.evaluate("() => document.documentElement.dataset.theme"))

    # continuous move sleep
    import math
    for i in range(25):
        page.mouse.move(400 + 80 * math.cos(i / 3), 400 + 60 * math.sin(i / 3))
        page.wait_for_timeout(35)
    page.wait_for_timeout(900)
    print("asleep:", not page.eval_on_selector("#theme-orb", "el => el.classList.contains('awake')"))

    browser.close()
print("done")
