import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        page = await b.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        await page.add_init_script(
            "localStorage.setItem('myweb_last_quote_date', new Date().toISOString().slice(0,10));"
        )
        await page.goto("http://localhost:3000/#/login", wait_until="networkidle")
        await page.fill('input[name="username"]', "admin")
        await page.fill('input[name="password"]', "admin123")
        await page.click("#login-btn")
        await page.wait_for_timeout(800)
        await page.goto("http://localhost:3000/#/alerts", wait_until="networkidle")
        await page.wait_for_timeout(4000)
        cards = await page.locator(".alert-card").count()
        sc = await page.locator("#card-sc").count()
        chips = await page.locator("#sc-coins .tag-chip").count()
        print("alert cards", cards, "sc card", sc, "sc chips", chips)
        meta = await page.locator("#sc-meta").inner_text()
        print("meta:", meta[:120])
        await page.screenshot(path=r"C:\Users\liaoby\OneDrive\Desktop\newweb\_alerts2.png", full_page=True)
        print("pageerrors", errs)
        await b.close()

asyncio.run(main())
