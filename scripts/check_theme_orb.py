from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"
OUT = "scripts/_theme_orb"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    # force dark
    page.add_init_script("localStorage.setItem('theme','dark')")
    page.goto(f"{BASE}/#/", wait_until="networkidle")
    page.wait_for_timeout(800)
    page.evaluate("() => document.querySelector('#quote-splash')?.remove()")
    page.wait_for_timeout(500)

    orb = page.locator("#theme-orb")
    # sleeping state (mouse far)
    page.mouse.move(100, 100)
    page.wait_for_timeout(600)
    page.screenshot(path=f"{OUT}_1_sleep.png", clip={"x": 1180, "y": 760, "width": 260, "height": 140})

    # approach orb
    box = orb.bounding_box()
    page.mouse.move(box["x"] - 80, box["y"] + 20)
    page.wait_for_timeout(700)
    page.screenshot(path=f"{OUT}_2_approach.png", clip={"x": 1180, "y": 760, "width": 260, "height": 140})

    # hover awake
    page.mouse.move(box["x"] + box["width"]/2, box["y"] + box["height"]/2)
    page.wait_for_timeout(700)
    page.screenshot(path=f"{OUT}_3_awake_moon.png", clip={"x": 1100, "y": 720, "width": 340, "height": 180})

    awake = page.eval_on_selector("#theme-orb", "el => el.classList.contains('awake')")
    print("awake on near:", awake)

    # click to light
    page.click("#theme-orb")
    page.wait_for_timeout(900)
    page.mouse.move(box["x"] + box["width"]/2, box["y"] + box["height"]/2)
    page.wait_for_timeout(700)
    page.screenshot(path=f"{OUT}_4_awake_sun.png", clip={"x": 1100, "y": 720, "width": 340, "height": 180})
    theme = page.evaluate("() => document.documentElement.getAttribute('data-theme')")
    print("theme after click:", theme)

    # move away → sleep
    page.mouse.move(200, 200)
    page.wait_for_timeout(1200)
    page.screenshot(path=f"{OUT}_5_sleep_light.png", clip={"x": 1180, "y": 760, "width": 260, "height": 140})
    awake2 = page.eval_on_selector("#theme-orb", "el => el.classList.contains('awake')")
    print("awake after leave:", awake2)

    # restore dark
    page.click("#theme-orb")
    page.wait_for_timeout(500)
    browser.close()
print("done")
