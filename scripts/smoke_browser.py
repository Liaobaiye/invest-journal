"""Browser smoke test for the rebuilt site."""
import asyncio
import sys
from playwright.async_api import async_playwright

BASE = "http://localhost:3000"
ROUTES = ["/", "/blog", "/portfolio", "/alerts", "/login", "/blog/1"]

async def main():
    errors = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type in ("error",) else None)

        for route in ROUTES:
            url = BASE + "/#" + route
            print(f"--- {route} ---")
            await page.goto(url, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(600)
            title = await page.title()
            main_text = await page.locator("#app-main").inner_text()
            print(f"title={title!r} main_len={len(main_text)}")
            if len(main_text.strip()) < 10:
                errors.append(f"{route}: empty main content")
            # check header
            nav = await page.locator(".nav-links").count()
            if nav == 0:
                errors.append(f"{route}: missing nav")

        # login flow
        print("--- login flow ---")
        await page.goto(BASE + "/#/login", wait_until="networkidle")
        await page.fill('input[name="username"]', "admin")
        await page.fill('input[name="password"]', "admin123")
        await page.click("#login-btn")
        await page.wait_for_timeout(1200)
        print("after login hash:", await page.evaluate("location.hash"))
        user_tag = await page.locator(".user-tag").count()
        print("user-tag count:", user_tag)
        if user_tag == 0:
            errors.append("login: user-tag not shown after login")

        # settings page
        await page.goto(BASE + "/#/settings", wait_until="networkidle")
        await page.wait_for_timeout(500)
        settings_text = await page.locator("#app-main").inner_text()
        print("settings len", len(settings_text))

        # blog editor
        await page.goto(BASE + "/#/blog/new", wait_until="networkidle")
        await page.wait_for_timeout(500)
        editor = await page.locator("#f-title").count()
        print("editor title field:", editor)

        await page.screenshot(path=r"C:\Users\liaoby\OneDrive\Desktop\newweb\_smoke.png", full_page=True)
        await browser.close()

    print("\n=== ERRORS ===")
    if errors:
        for e in errors:
            print(e)
        sys.exit(1)
    print("none")

if __name__ == "__main__":
    asyncio.run(main())
