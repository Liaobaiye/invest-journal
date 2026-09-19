from playwright.sync_api import sync_playwright
import time

BASE = "http://127.0.0.1:3000"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.add_init_script("localStorage.setItem('theme','dark')")
    page.goto(f"{BASE}/#/", wait_until="networkidle")
    page.wait_for_timeout(500)
    page.evaluate("() => document.querySelector('#quote-splash')?.remove()")

    orb = page.locator("#theme-orb")
    box = orb.bounding_box()
    cx, cy = box["x"] + box["width"]/2, box["y"] + box["height"]/2
    page.mouse.move(cx-30, cy)
    page.wait_for_timeout(350)

    t0 = time.time()
    page.click("#theme-orb")
    # wait until morphing class gone
    for _ in range(40):
        page.wait_for_timeout(20)
        if not page.eval_on_selector("#theme-orb", "el => el.classList.contains('morphing')"):
            break
    dt = (time.time() - t0) * 1000
    theme = page.evaluate("() => document.documentElement.dataset.theme")
    light = page.eval_on_selector("#theme-orb", "el => el.classList.contains('light')")
    print(f"toggle done in ~{dt:.0f}ms theme={theme} light={light}")

    page.click("#theme-orb")
    page.wait_for_timeout(400)
    print("back:", page.evaluate("() => document.documentElement.dataset.theme"))

    # continuous far move sleep
    import math
    for i in range(20):
        page.mouse.move(500+60*math.cos(i/3), 400+50*math.sin(i/3))
        page.wait_for_timeout(30)
    page.wait_for_timeout(800)
    print("asleep:", not page.eval_on_selector("#theme-orb", "el => el.classList.contains('awake')"))
    browser.close()
print("ok")
