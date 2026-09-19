import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        page = await b.new_page(viewport={"width": 1100, "height": 900})
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        await page.add_init_script(
            "localStorage.setItem('myweb_last_quote_date', new Date().toISOString().slice(0,10));"
        )
        for pid in ["1", "2"]:
            await page.goto(f"http://localhost:3000/#/blog/{pid}", wait_until="networkidle")
            await page.wait_for_timeout(500)
            card = await page.locator(".trade-data-card").count()
            chips = await page.locator(".td-chip").count()
            rangeb = await page.locator(".td-range").count()
            blocks = await page.locator(".td-block").count()
            raw_json = await page.locator(".trade-data-card pre").count()
            print(f"post {pid}: card={card} chips={chips} range={rangeb} blocks={blocks} pre={raw_json}")
            await page.screenshot(path=rf"C:\Users\liaoby\OneDrive\Desktop\newweb\_trade_{pid}.png", full_page=True)
        print("errors", errs)
        await b.close()

asyncio.run(main())
