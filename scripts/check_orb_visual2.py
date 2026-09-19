from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"
OUT = "scripts/_orb_after_perf"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.add_init_script("localStorage.setItem('theme','dark')")
    page.goto(f"{BASE}/#/", wait_until="networkidle")
    page.wait_for_timeout(600)
    page.evaluate("() => document.querySelector('#quote-splash')?.remove()")
    orb = page.locator("#theme-orb")
    box = orb.bounding_box()
    cx, cy = box["x"] + box["width"]/2, box["y"] + box["height"]/2
    clip = {"x": int(cx-80), "y": int(cy-80), "width": 160, "height": 160}
    page.mouse.move(cx-30, cy)
    page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}_moon.png", clip=clip)
    page.click("#theme-orb")
    page.wait_for_timeout(250)
    page.screenshot(path=f"{OUT}_mid.png", clip=clip)
    page.wait_for_timeout(600)
    page.screenshot(path=f"{OUT}_sun.png", clip=clip)
    browser.close()
print("ok")
