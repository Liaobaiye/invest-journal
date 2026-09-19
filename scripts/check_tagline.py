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
        await page.goto("http://localhost:3000/#/", wait_until="networkidle")
        await page.wait_for_timeout(600)
        footer = await page.locator(".footer-tagline").inner_text()
        print("tagline:", footer)
        print("errors:", errs)
        await b.close()

asyncio.run(main())
