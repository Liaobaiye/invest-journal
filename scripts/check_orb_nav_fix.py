from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"


def log(name, ok, detail=""):
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.add_init_script("localStorage.setItem('theme','dark')")
    page.goto(f"{BASE}/#/", wait_until="networkidle")
    page.wait_for_timeout(600)
    page.evaluate("() => document.querySelector('#quote-splash')?.remove()")
    page.wait_for_timeout(400)

    orb = page.locator("#theme-orb")
    box = orb.bounding_box()
    cx = box["x"] + box["width"] / 2
    cy = box["y"] + box["height"] / 2

    def is_awake():
        return page.eval_on_selector("#theme-orb", "el => el.classList.contains('awake')")

    # 1) approach → awake
    page.mouse.move(200, 200)
    page.wait_for_timeout(300)
    page.mouse.move(cx - 90, cy)
    page.wait_for_timeout(500)
    log("靠近苏醒", is_awake())

    # 2) click toggle (theme switch)
    page.mouse.move(cx, cy)
    page.wait_for_timeout(200)
    page.click("#theme-orb")
    page.wait_for_timeout(700)
    log("切换后苏醒", is_awake(), f"theme={page.evaluate('() => document.documentElement.dataset.theme')}")

    # 3) leave far away
    page.mouse.move(300, 200)
    page.wait_for_timeout(1500)
    log("切换后离开应休眠", not is_awake())

    # 4) come back near → awake
    page.mouse.move(cx - 100, cy)
    page.wait_for_timeout(500)
    log("再次靠近应苏醒", is_awake())

    # 5) leave again → must sleep (this was the bug)
    page.mouse.move(400, 300)
    page.wait_for_timeout(1500)
    log("再次离开应休眠", not is_awake())

    # 6) near then toggle then near then leave
    page.mouse.move(cx - 80, cy)
    page.wait_for_timeout(400)
    page.click("#theme-orb")
    page.wait_for_timeout(300)
    page.mouse.move(200, 400)
    page.wait_for_timeout(200)
    page.mouse.move(cx - 50, cy)
    page.wait_for_timeout(400)
    page.mouse.move(250, 250)
    page.wait_for_timeout(1500)
    log("切换中途折返后离开应休眠", not is_awake())

    # restore dark
    page.evaluate("() => localStorage.setItem('theme','dark')")
    page.evaluate("() => document.documentElement.setAttribute('data-theme','dark')")

    # --- nav highlight ---
    # login first for full nav test optional; public pages enough
    def active_hash():
        return page.evaluate("""() => {
          const a = document.querySelector('.nav-links a.active');
          return a ? a.getAttribute('data-hash') : null;
        }""")

    page.goto(f"{BASE}/#/", wait_until="networkidle")
    page.wait_for_timeout(500)
    page.evaluate("() => document.querySelector('#quote-splash')?.remove()")
    page.wait_for_timeout(400)
    log("首页高亮", active_hash() == "#/", str(active_hash()))

    # rapid switch: click portfolio then immediately alerts
    page.click("a[href='#/portfolio']")
    page.wait_for_timeout(80)  # very short — should already highlight
    h1 = active_hash()
    page.click("a[href='#/alerts']")
    page.wait_for_timeout(80)
    h2 = active_hash()
    page.wait_for_timeout(800)
    h3 = active_hash()
    log("快速切页高亮立即", h2 in ("#/alerts", "#/portfolio"), f"t80ms portfolio={h1} alerts={h2}")
    log("稳定后高亮正确", h3 == "#/alerts", str(h3))

    page.click("a[href='#/altcoin']")
    page.wait_for_timeout(100)
    log("山寨币高亮", active_hash() == "#/altcoin", str(active_hash()))

    browser.close()
print("done")
