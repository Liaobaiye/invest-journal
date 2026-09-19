"""Visual + functional smoke after fixes."""
import asyncio
import sys
from playwright.async_api import async_playwright

BASE = "http://localhost:3000"

async def main():
    errors = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        # Home
        await page.goto(BASE + "/#/", wait_until="networkidle")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=r"C:\Users\liaoby\OneDrive\Desktop\newweb\_home.png", full_page=True)
        home = await page.locator("#app-main").inner_text()
        print("home:", home[:120].replace("\n", " | "))

        # Blog
        await page.goto(BASE + "/#/blog", wait_until="networkidle")
        await page.wait_for_timeout(800)
        cards = await page.locator(".blog-card").count()
        print("blog cards:", cards)
        if cards == 0:
            errors.append("blog: no cards")
        await page.screenshot(path=r"C:\Users\liaoby\OneDrive\Desktop\newweb\_blog.png")

        # Detail
        await page.goto(BASE + "/#/blog/1", wait_until="networkidle")
        await page.wait_for_timeout(600)
        body = await page.locator(".detail-body").inner_text()
        print("detail body sample:", body[:80].replace("\n", " "))
        if "市场背景" not in body and len(body) < 20:
            errors.append("blog detail empty")

        # Login
        await page.goto(BASE + "/#/login", wait_until="networkidle")
        await page.fill('input[name="username"]', "admin")
        await page.fill('input[name="password"]', "admin123")
        await page.click("#login-btn")
        await page.wait_for_timeout(1000)

        # Portfolio after login
        await page.goto(BASE + "/#/portfolio", wait_until="networkidle")
        await page.wait_for_timeout(1200)
        pos = await page.locator(".position-card").count()
        print("position cards:", pos)
        await page.screenshot(path=r"C:\Users\liaoby\OneDrive\Desktop\newweb\_portfolio.png", full_page=True)
        if pos == 0:
            # might still be loading
            text = await page.locator("#app-main").inner_text()
            print("portfolio text:", text[:200].replace("\n", " | "))

        # Alerts
        await page.goto(BASE + "/#/alerts", wait_until="networkidle")
        await page.wait_for_timeout(800)
        await page.screenshot(path=r"C:\Users\liaoby\OneDrive\Desktop\newweb\_alerts.png", full_page=True)

        # Theme toggle
        await page.click("#theme-orb")
        await page.wait_for_timeout(900)
        theme = await page.evaluate("document.documentElement.getAttribute('data-theme')")
        print("theme after toggle:", theme)
        if theme != "light":
            errors.append("theme toggle failed")

        await browser.close()

    print("\n=== ERRORS ===")
    print("\n".join(errors) if errors else "none")
    if any(e.startswith("pageerror") for e in errors):
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
