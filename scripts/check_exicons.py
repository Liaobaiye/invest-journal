import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        page = await b.new_page(viewport={"width": 1100, "height": 800})
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        await page.add_init_script(
            "localStorage.setItem('myweb_last_quote_date', new Date().toISOString().slice(0,10));"
        )
        await page.goto("http://localhost:3000/#/portfolio", wait_until="networkidle")
        await page.wait_for_timeout(800)
        icons = await page.locator(".crystal-node .ex-icon").count()
        print("crystal icons", icons)
        # crop crystal area
        slot = page.locator(".port-actions")
        await slot.screenshot(path=r"C:\Users\liaoby\OneDrive\Desktop\newweb\_exicons.png")
        print("errors", errs)
        await b.close()

asyncio.run(main())
