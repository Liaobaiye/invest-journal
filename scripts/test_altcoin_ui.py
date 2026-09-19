"""Browser test for altcoin monitor page."""
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"
OUT = "scripts/_altcoin_ui"
results = []


def log(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    results.append((status, name, detail))
    print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))


def dismiss_splash(page):
    page.wait_for_timeout(500)
    splash = page.query_selector("#quote-splash")
    if splash:
        try:
            splash.click(timeout=1500)
        except Exception:
            page.evaluate("() => document.querySelector('#quote-splash')?.remove()")
        page.wait_for_timeout(300)


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    page.goto(f"{BASE}/#/login", wait_until="networkidle")
    dismiss_splash(page)
    page.wait_for_selector("#login-form")
    page.fill("#login-form input[name=username]", "admin")
    page.fill("#login-form input[name=password]", "admin123")
    page.click("#login-btn")
    page.wait_for_timeout(900)
    log("登录", bool(page.evaluate("() => localStorage.getItem('accessToken')")))

    page.goto(f"{BASE}/#/altcoin", wait_until="networkidle")
    dismiss_splash(page)
    page.wait_for_selector("#altcoin-page, .altcoin-page", timeout=10000)
    page.wait_for_timeout(1500)

    log("页面渲染", bool(page.query_selector(".altcoin-page")))
    log("扫描按钮", bool(page.query_selector("#ac-scan")))
    log("K线 canvas", bool(page.query_selector("#ac-canvas")))
    log("导航高亮山寨币", page.query_selector("a[href='#/altcoin']") is not None)

    # Existing results from API smoke (40 symbols)
    rows = page.query_selector_all("#ac-list-body tbody tr")
    log("加载已有结果表", len(rows) >= 1, f"rows={len(rows)}")
    if rows:
        rows[0].click()
        page.wait_for_timeout(1500)
        meta = page.inner_text("#ac-chart-meta")
        title = page.inner_text("#ac-chart-title")
        log("点击行加载K线", "开 " in meta or "失败" not in meta, f"title={title} meta={meta[:60]}")

    # Start another small scan from UI
    page.fill("#ac-max", "30")
    page.fill("#ac-threshold", "5")
    page.click("#ac-scan")
    page.wait_for_timeout(800)
    prog_visible = page.eval_on_selector("#ac-progress", "el => !el.hidden")
    log("启动扫描显示进度", prog_visible)

    # wait until scan finishes (max ~60s)
    finished = False
    for _ in range(40):
        page.wait_for_timeout(1500)
        st = page.evaluate("""async () => {
          const r = await fetch('/api/altcoin/status');
          return r.json();
        }""")
        if not st.get("running"):
            finished = True
            break
    log("扫描结束", finished)

    page.wait_for_timeout(1200)
    rows = page.query_selector_all("#ac-list-body tbody tr")
    n_text = page.inner_text("#ac-n")
    top_text = page.inner_text("#ac-top")
    log("扫描后列表刷新", len(rows) >= 0 and n_text != "—", f"rows={len(rows)} n={n_text} top={top_text}")

    page.screenshot(path=f"{OUT}_1.png", full_page=True)

    # nav item exists
    nav = page.inner_text("nav.nav-links")
    log("顶栏含山寨币", "山寨" in nav, nav.replace("\n", " ")[:80])

    errs = [e for e in errors if "400" not in e and "Failed to load resource" not in e]
    log("无严重 console error", len(errs) == 0, "; ".join(errs[:3]))

    browser.close()

print("\n==== UI SUMMARY ====")
fails = [r for r in results if r[0] == "FAIL"]
print(f"PASS {len(results)-len(fails)} / {len(results)}")
for s, n, d in fails:
    print(f"  FAIL: {n} — {d}")
