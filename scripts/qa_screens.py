import asyncio
from playwright.async_api import async_playwright

OUT = r"C:\Users\liaoby\OneDrive\Desktop\newweb\_qa"
ROUTES = [
    ("home", "#/"),
    ("blog", "#/blog"),
    ("blog1", "#/blog/1"),
    ("blog2", "#/blog/2"),
    ("portfolio", "#/portfolio"),
    ("alerts", "#/alerts"),
    ("login", "#/login"),
]

async def main():
    import os
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        page = await b.new_page(viewport={"width": 1280, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(f"pageerror:{e}"))
        page.on("console", lambda m: errors.append(f"console:{m.text}") if m.type == "error" else None)

        await page.add_init_script(
            "localStorage.setItem('myweb_last_quote_date', new Date().toISOString().slice(0,10));"
        )

        for name, hash_ in ROUTES:
            await page.goto(f"http://localhost:3000/{hash_}", wait_until="networkidle")
            await page.wait_for_timeout(1200)
            await page.screenshot(path=f"{OUT}/{name}.png", full_page=True)
            main_len = await page.locator("#app-main").inner_text()
            print(f"{name}: main_len={len(main_len.strip())}")

        # login then portfolio + settings + editor
        await page.goto("http://localhost:3000/#/login", wait_until="networkidle")
        await page.fill('input[name="username"]', "admin")
        await page.fill('input[name="password"]', "admin123")
        await page.click("#login-btn")
        await page.wait_for_timeout(1000)

        for name, hash_ in [
            ("portfolio_auth", "#/portfolio"),
            ("settings_auth", "#/settings"),
            ("editor", "#/blog/new"),
            ("alerts_auth", "#/alerts"),
        ]:
            await page.goto(f"http://localhost:3000/{hash_}", wait_until="networkidle")
            await page.wait_for_timeout(2500)
            await page.screenshot(path=f"{OUT}/{name}.png", full_page=True)
            print(f"{name}: ok")

        # light theme home
        await page.goto("http://localhost:3000/#/", wait_until="networkidle")
        await page.click("#theme-orb")
        await page.wait_for_timeout(900)
        await page.screenshot(path=f"{OUT}/home_light.png", full_page=True)
        theme = await page.evaluate("document.documentElement.getAttribute('data-theme')")
        print("light theme", theme)

        await b.close()
        print("\nERRORS:")
        # filter noisy market 502 if any
        real = [e for e in errors if "502" not in e and "Failed to load resource" not in e]
        print("\n".join(real) if real else "none (filtered 502/network)")

if __name__ == "__main__":
    asyncio.run(main())
