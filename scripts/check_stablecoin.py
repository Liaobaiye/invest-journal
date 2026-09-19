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
        await page.goto("http://localhost:3000/#/stablecoins", wait_until="networkidle")
        await page.wait_for_timeout(2500)
        chips = await page.locator(".sc-coin-chip").count()
        rows = await page.locator("#sc-body tr").count()
        text = await page.locator("#sc-summary").inner_text()
        print("chips", chips, "rows", rows, "summary", text.replace("\n", " "))
        # add a coin
        await page.fill("#sc-new-coin", "FRAX")
        await page.click("#sc-add")
        await page.wait_for_timeout(300)
        chips2 = await page.locator(".sc-coin-chip").count()
        print("chips after add", chips2)
        await page.screenshot(path=r"C:\Users\liaoby\OneDrive\Desktop\newweb\_stablecoin.png", full_page=True)
        print("pageerrors", errs)
        await b.close()

asyncio.run(main())
