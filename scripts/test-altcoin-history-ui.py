# -*- coding: utf-8 -*-
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    page.on("pageerror", lambda e: errors.append("page:" + str(e)))
    page.on("console", lambda m: errors.append(f"{m.type}:{m.text}") if m.type in ("error", "warning") else None)
    failed = []
    page.on("response", lambda r: failed.append(f"{r.status} {r.url}") if r.status >= 400 and "altcoin" in r.url else None)

    login = page.request.post(BASE + "/api/auth/login", data={"username": "admin", "password": "admin123"})
    token = (login.json() or {}).get("accessToken")
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.evaluate("(t) => localStorage.setItem('accessToken', t)", token)
    page.reload(wait_until="networkidle")
    page.goto(BASE + "/#/altcoin", wait_until="networkidle")
    page.wait_for_selector(".altcoin-page", timeout=15000)
    page.wait_for_timeout(2000)

    # force network check
    hist_api = page.request.get(BASE + "/api/altcoin/history")
    print("API_STATUS", hist_api.status)
    print("API_COUNT", len(hist_api.json().get("items") or []))

    print("HAS_SECTION", page.locator(".ac-history").count())
    print("HAS_BODY", page.locator("#ac-history-body").count())
    print("ROWS", page.locator(".ac-history-table tbody tr").count())
    print("EMPTY", page.locator("#ac-history-body .empty-state").count())
    body_text = page.locator("#ac-history-body").inner_text() if page.locator("#ac-history-body").count() else ""
    print("BODY_TEXT", body_text[:200].replace("\n", " | "))
    # is history in viewport after scroll
    page.locator(".ac-history").scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    box = page.locator(".ac-history").bounding_box()
    print("HISTORY_BOX", box)
    page.screenshot(path="scripts/altcoin-history-check.png", full_page=True)
    print("ERRORS", errors[:10])
    print("FAILED_REQ", failed[:10])
    browser.close()
