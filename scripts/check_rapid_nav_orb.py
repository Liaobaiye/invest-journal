from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"
errors = []

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    page.goto(f"{BASE}/#/login", wait_until="networkidle")
    page.wait_for_timeout(500)
    page.evaluate("() => document.querySelector('#quote-splash')?.remove()")
    page.fill("#login-form input[name=username]", "admin")
    page.fill("#login-form input[name=password]", "admin123")
    page.click("#login-btn")
    page.wait_for_timeout(800)

    # Rapid navigation: alerts <-> altcoin <-> portfolio many times
    for _ in range(6):
        page.evaluate("() => { window.location.hash = '#/alerts'; }")
        page.wait_for_timeout(30)
        page.evaluate("() => { window.location.hash = '#/altcoin'; }")
        page.wait_for_timeout(30)
        page.evaluate("() => { window.location.hash = '#/portfolio'; }")
        page.wait_for_timeout(30)
        page.evaluate("() => { window.location.hash = '#/alerts'; }")
        page.wait_for_timeout(40)

    page.wait_for_timeout(2500)
    body = page.inner_text("#app-main")
    failed = "页面加载失败" in body
    print("alerts failed after rapid nav:", failed)
    print("main snippet:", body[:120].replace("\n", " | "))

    real_errors = [e for e in errors if "页面加载失败" in e or "innerHTML" in e or "Cannot set" in e]
    print("page errors:", real_errors[:5] if real_errors else "(none)")

    # more rapid + then check no crash banner
    for i in range(8):
        page.evaluate(f"() => {{ window.location.hash = '#/{'blog' if i%2==0 else 'alerts'}'; }}")
        page.wait_for_timeout(25)
    page.wait_for_timeout(2000)
    body2 = page.inner_text("#app-main")
    print("failed after second burst:", "页面加载失败" in body2)
    real_errors2 = [e for e in errors if "Cannot set" in e or "null" in e]
    print("null innerHTML errors:", real_errors2[:5] if real_errors2 else "(none)")

    # theme orb: toggle and check moon/sun centers roughly
    page.add_init_script("localStorage.setItem('theme','dark')")
    page.goto(f"{BASE}/#/", wait_until="networkidle")
    page.wait_for_timeout(600)
    page.evaluate("() => document.querySelector('#quote-splash')?.remove()")

    def orb_boxes():
        return page.evaluate("""() => {
          const moon = document.querySelector('.orb-moon');
          const sun = document.querySelector('.orb-sun');
          const orb = document.querySelector('#theme-orb');
          const ob = orb.getBoundingClientRect();
          const mb = moon.getBoundingClientRect();
          const sb = sun.getBoundingClientRect();
          return {
            orb: {cx: ob.left+ob.width/2, cy: ob.top+ob.height/2},
            moonCy: mb.top+mb.height/2,
            sunCy: sb.top+sb.height/2,
            moonCyRel: mb.top+mb.height/2 - (ob.top+ob.height/2),
            sunCyRel: sb.top+sb.height/2 - (ob.top+ob.height/2),
          };
        }""")

    page.evaluate("() => { const o=document.querySelector('#theme-orb'); o.classList.add('awake'); }")
    page.wait_for_timeout(200)
    dark = orb_boxes()
    page.click("#theme-orb")
    page.wait_for_timeout(700)
    page.evaluate("() => { const o=document.querySelector('#theme-orb'); o.classList.add('awake'); }")
    page.wait_for_timeout(200)
    light = orb_boxes()
    print("dark moon center offset from orb:", round(dark["moonCyRel"], 2))
    print("light sun center offset from orb:", round(light["sunCyRel"], 2))
    # should both be near 0
    ok_center = abs(dark["moonCyRel"]) < 8 and abs(light["sunCyRel"]) < 8
    print("centers aligned:", ok_center)

    browser.close()

print("DONE")
