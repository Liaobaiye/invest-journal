# -*- coding: utf-8 -*-
"""UI smoke: altcoin page toggle + history list"""
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    page.on("pageerror", lambda e: errors.append("page:" + str(e)))
    page.on("console", lambda m: errors.append(f"console:{m.type}:{m.text}") if m.type == "error" else None)

    # login via API, inject token
    login = page.request.post(
        BASE + "/api/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    print("LOGIN_STATUS", login.status)
    data = login.json()
    token = data.get("accessToken") or data.get("token")
    print("HAS_TOKEN", bool(token))
    if not token:
        print(data)
        browser.close()
        raise SystemExit(1)

    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.evaluate(
        """(t) => {
          localStorage.setItem('accessToken', t);
        }""",
        token,
    )
    page.reload(wait_until="networkidle")
    page.goto(BASE + "/#/altcoin", wait_until="networkidle")
    page.wait_for_selector(".altcoin-page", timeout=15000)
    page.wait_for_timeout(1500)

    has_toggle = page.locator("#ac-auto-toggle").count() > 0
    hint = page.locator("#ac-auto-hint").inner_text() if page.locator("#ac-auto-hint").count() else ""
    hist_rows = page.locator(".ac-history-table tbody tr").count()
    hist_empty = page.locator("#ac-history-body .empty-state").count()
    title = page.locator(".altcoin-page h1").inner_text()

    toggle = page.locator("#ac-auto-toggle")
    label = page.locator(".ac-auto-label")
    hint_on = meta_on = hint_off = "NO_TOGGLE"
    if has_toggle:
        if not toggle.is_checked():
            label.click()
        page.wait_for_timeout(800)
        hint_on = page.locator("#ac-auto-hint").inner_text()
        meta_on = page.locator("#ac-meta").inner_text()
        if toggle.is_checked():
            label.click()
        page.wait_for_timeout(500)
        hint_off = page.locator("#ac-auto-hint").inner_text()

    openable = False
    if hist_rows > 0:
        href = page.locator(".ac-history-table tbody tr").first.get_attribute("data-file")
        if href:
            resp = page.request.get(BASE + "/api/altcoin/history/" + href)
            openable = resp.status == 200 and b"canvas" in resp.body()

    page.screenshot(path="scripts/altcoin-ui.png", full_page=True)
    print("TITLE", title)
    print("TOGGLE", has_toggle)
    print("HINT_INIT", hint)
    print("HINT_ON", hint_on)
    print("META_ON", meta_on)
    print("HINT_OFF", hint_off)
    print("HIST_ROWS", hist_rows, "EMPTY", hist_empty)
    print("HIST_OPENABLE", openable)
    print("ERRORS", errors[:10])
    browser.close()
