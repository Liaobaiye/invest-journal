from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1440, "height": 900})
    page.goto("http://127.0.0.1:3000/#/login", wait_until="networkidle")
    page.wait_for_timeout(600)
    page.evaluate("() => document.querySelector('#quote-splash')?.remove()")
    page.fill("#login-form input[name=username]", "admin")
    page.fill("#login-form input[name=password]", "admin123")
    page.click("#login-btn")
    page.wait_for_timeout(800)
    page.goto("http://127.0.0.1:3000/#/altcoin", wait_until="networkidle")
    page.wait_for_timeout(600)
    page.evaluate("() => document.querySelector('#quote-splash')?.remove()")
    page.wait_for_selector(".altcoin-page")
    page.wait_for_timeout(1500)
    hidden = page.eval_on_selector(
        "#ac-progress",
        "el => el.hidden && getComputedStyle(el).display === 'none'",
    )
    print("progress hidden idle:", hidden)

    page.fill("#ac-max", "20")
    page.click("#ac-scan")
    page.wait_for_timeout(600)
    shown = page.eval_on_selector(
        "#ac-progress",
        "el => !el.hidden && getComputedStyle(el).display !== 'none'",
    )
    print("progress shown during scan:", shown)

    for _ in range(30):
        page.wait_for_timeout(1500)
        st = page.evaluate("async () => (await fetch('/api/altcoin/status')).json()")
        if not st.get("running"):
            break
    page.wait_for_timeout(1800)
    hidden2 = page.eval_on_selector(
        "#ac-progress",
        "el => el.hidden && getComputedStyle(el).display === 'none'",
    )
    print("progress hidden after done:", hidden2)
    b.close()
