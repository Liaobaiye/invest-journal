import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        page = await b.new_page()
        await page.add_init_script(
            "localStorage.setItem('myweb_last_quote_date', new Date().toISOString().slice(0,10));"
        )
        await page.goto("http://localhost:3000/#/", wait_until="networkidle")
        await page.wait_for_timeout(2500)
        cards = await page.locator("#home-posts .blog-card").count()
        titles = await page.locator("#home-posts .blog-card-title").all_inner_texts()
        print("home cards", cards, titles)
        banner = await page.locator("#demo-banner").inner_text() if await page.locator("#demo-banner").count() else None
        print("banner", banner)
        await b.close()

asyncio.run(main())
