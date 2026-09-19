from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"
OUT = "scripts/_chip_states"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto(f"{BASE}/#/login", wait_until="networkidle")
    page.wait_for_timeout(500)
    page.evaluate("() => document.querySelector('#quote-splash')?.remove()")
    page.fill("#login-form input[name=username]", "admin")
    page.fill("#login-form input[name=password]", "admin123")
    page.click("#login-btn")
    page.wait_for_timeout(800)
    page.goto(f"{BASE}/#/alerts", wait_until="networkidle")
    page.wait_for_timeout(500)
    page.evaluate("() => document.querySelector('#quote-splash')?.remove()")
    page.wait_for_selector("#card-vol")
    page.wait_for_timeout(800)

    card = page.locator("#card-vol")
    # default state (5m already active from seed?)
    card.screenshot(path=f"{OUT}_1_default.png")

    # hover an inactive chip (1m)
    page.hover("#card-vol .tf-chip[data-tf='1m']")
    page.wait_for_timeout(300)
    card.screenshot(path=f"{OUT}_2_hover_inactive.png")

    # click it to active
    page.click("#card-vol .tf-chip[data-tf='1m']")
    page.wait_for_timeout(300)
    card.screenshot(path=f"{OUT}_3_active.png")

    # hover the active one
    page.hover("#card-vol .tf-chip[data-tf='1m']")
    page.wait_for_timeout(300)
    card.screenshot(path=f"{OUT}_4_active_hover.png")

    # exchange chips too
    page.hover("#card-vol [data-ex='binance']")
    page.wait_for_timeout(200)
    card.screenshot(path=f"{OUT}_5_exchange.png")

    # sample computed styles
    styles = page.evaluate("""() => {
      const get = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { color: cs.color, bg: cs.backgroundColor, border: cs.borderColor, weight: cs.fontWeight };
      };
      return {
        inactive: get("#card-vol .tf-chip[data-tf='4H']"),
        active: get("#card-vol .tf-chip.active"),
      };
    }""")
    print("inactive:", styles.get("inactive"))
    print("active:", styles.get("active"))
    browser.close()
print("done")
