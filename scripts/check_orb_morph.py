from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"
OUT = "scripts/_orb_morph"

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
    clip = {"x": int(cx - 90), "y": int(cy - 90), "width": 180, "height": 180}

    def awake():
        return page.eval_on_selector("#theme-orb", "el => el.classList.contains('awake')")

    # --- continuous mouse movement far from orb should still sleep ---
    page.mouse.move(200, 200)
    page.wait_for_timeout(300)
    page.mouse.move(cx - 50, cy)  # wake
    page.wait_for_timeout(400)
    print("woken:", awake())

    # move continuously far away for 2s
    import math
    for i in range(40):
        x = 400 + 200 * math.cos(i / 4)
        y = 400 + 150 * math.sin(i / 4)
        page.mouse.move(x, y)
        page.wait_for_timeout(50)
    page.wait_for_timeout(200)
    still_awake = awake()
    print("still awake after continuous far movement:", still_awake)
    # after settle
    page.wait_for_timeout(800)
    print("asleep after settle:", not awake())

    # --- morph frames ---
    page.mouse.move(cx - 40, cy)
    page.wait_for_timeout(400)
    page.screenshot(path=f"{OUT}_0_moon.png", clip=clip)

    page.mouse.move(cx, cy)
    page.click("#theme-orb")
    # capture mid-morph
    page.wait_for_timeout(200)
    page.screenshot(path=f"{OUT}_1_morph_mid.png", clip=clip)
    page.wait_for_timeout(250)
    page.screenshot(path=f"{OUT}_2_morph_late.png", clip=clip)
    page.wait_for_timeout(600)
    page.mouse.move(cx, cy)
    page.wait_for_timeout(200)
    page.screenshot(path=f"{OUT}_3_sun.png", clip=clip)

    theme = page.evaluate("() => document.documentElement.dataset.theme")
    print("theme now:", theme)

    # morph back
    page.click("#theme-orb")
    page.wait_for_timeout(200)
    page.screenshot(path=f"{OUT}_4_back_mid.png", clip=clip)
    page.wait_for_timeout(800)
    page.screenshot(path=f"{OUT}_5_moon_again.png", clip=clip)
    print("theme back:", page.evaluate("() => document.documentElement.dataset.theme"))

    browser.close()
print("done")
