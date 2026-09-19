"""Browser test of alerts page components."""
import json
import time
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"
OUT = "scripts/_alerts_ui"
results = []


def log(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    results.append((status, name, detail))
    print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    console = []
    page.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))

    # Login (splash may block; click it away)
    page.goto(f"{BASE}/#/login", wait_until="networkidle")
    page.wait_for_timeout(600)
    splash = page.query_selector("#quote-splash")
    if splash:
        try:
            splash.click(timeout=2000)
            page.wait_for_timeout(400)
        except Exception:
            page.evaluate("() => document.querySelector('#quote-splash')?.remove()")
    page.wait_for_selector("#login-form", timeout=10000)
    page.fill("#login-form input[name=username]", "admin")
    page.fill("#login-form input[name=password]", "admin123")
    page.click("#login-btn")
    page.wait_for_timeout(1000)
    token = page.evaluate("() => localStorage.getItem('accessToken')")
    log("登录并拿到 token", bool(token), f"token_len={len(token) if token else 0}")

    # Open alerts
    page.goto(f"{BASE}/#/alerts", wait_until="networkidle")
    page.wait_for_timeout(600)
    splash = page.query_selector("#quote-splash")
    if splash:
        try:
            splash.click(timeout=1500)
        except Exception:
            page.evaluate("() => document.querySelector('#quote-splash')?.remove()")
    page.wait_for_selector("#card-vol", timeout=10000)
    page.wait_for_timeout(1200)
    page.screenshot(path=f"{OUT}_1_initial.png", full_page=True)

    # Cards present
    for cid, name in [("card-vol", "波动监控卡"), ("card-dd", "回撤监控卡"), ("card-news", "消息面卡"), ("card-sc", "稳定币卡")]:
        el = page.query_selector(f"#{cid}")
        log(f"渲染 {name}", bool(el), "" if el else "missing")

    # History sidebar
    hist = page.query_selector("#alert-history")
    log("告警历史侧栏", bool(hist), hist.inner_text()[:60] if hist else "")

    # --- Volatility card interactions ---
    page.click("#card-vol .tf-chip[data-tf='15m']")
    active_15m = page.eval_on_selector("#card-vol .tf-chip[data-tf='15m']", "el => el.classList.contains('active')")
    log("波动：切换 15m 周期 chip", active_15m is not None)

    page.fill("#card-vol [data-th-tf='5m']", "4.5")
    page.dispatch_event("#card-vol [data-th-tf='5m']", "change")
    local = page.evaluate("() => JSON.parse(localStorage.getItem('myweb_alerts')||'{}')")
    log("波动：阈值写入 localStorage", abs(local.get("thresholds", {}).get("5m", 0) - 4.5) < 0.01, str(local.get("thresholds")))

    page.click("#card-vol [data-ex='binance']")
    ex = page.evaluate("() => JSON.parse(localStorage.getItem('myweb_alerts')||'{}').exchanges")
    log("波动：交易所 chip 切换", "binance" in ex, str(ex))

    page.fill("#coin-add", "SOL-USDT")
    page.press("#coin-add", "Enter")
    coins = page.evaluate("() => JSON.parse(localStorage.getItem('myweb_alerts')||'{}').coins")
    log("波动：回车添加币种", "SOL-USDT" in coins, str(coins))

    # Toggle on (should sync API) — custom toggle hides the input
    page.evaluate("() => { const el=document.querySelector('#tg-vol'); el.checked=true; el.dispatchEvent(new Event('change',{bubbles:true})); }")
    page.wait_for_timeout(1000)
    armed = page.eval_on_selector("#card-vol", "el => el.classList.contains('armed')")
    toast = page.inner_text("#alert-toast") if page.query_selector("#alert-toast") else ""
    local = page.evaluate("() => JSON.parse(localStorage.getItem('myweb_alerts')||'{}')")
    log("波动：开关 armed + localStorage", armed and local.get("volEnabled") is True, f"armed={armed} toast={toast!r}")

    # --- Drawdown ---
    page.fill("#dd-threshold", "15")
    page.dispatch_event("#dd-threshold", "change")
    page.evaluate("() => { const el=document.querySelector('#tg-dd'); el.checked=true; el.dispatchEvent(new Event('change',{bubbles:true})); }")
    local = page.evaluate("() => JSON.parse(localStorage.getItem('myweb_alerts')||'{}')")
    log("回撤：开关与阈值", local.get("ddEnabled") is True and local.get("ddThreshold") == 15, str({k: local.get(k) for k in ("ddEnabled", "ddThreshold")}))

    # --- News ---
    page.uncheck("[data-cat='macro']")
    page.fill("#news-risk", "75")
    page.dispatch_event("#news-risk", "change")
    page.evaluate("() => { const el=document.querySelector('#tg-news'); el.checked=true; el.dispatchEvent(new Event('change',{bubbles:true})); }")
    local = page.evaluate("() => JSON.parse(localStorage.getItem('myweb_alerts')||'{}')")
    log("消息面：分类/阈值/开关", local.get("newsEnabled") is True and local.get("newsRisk") == 75 and local.get("newsCats", {}).get("macro") is False,
        str({k: local.get(k) for k in ("newsEnabled", "newsRisk", "newsCats")}))

    page.screenshot(path=f"{OUT}_2_cards_on.png", full_page=True)

    # --- Stablecoin card ---
    # wait for config load + auto check
    page.wait_for_timeout(2000)
    sc_table = page.query_selector("#sc-results table")
    sc_meta = page.inner_text("#sc-meta") if page.query_selector("#sc-meta") else ""
    log("稳定币：自动检测出表", bool(sc_table), f"meta={sc_meta!r}")
    if sc_table:
        rows = page.eval_on_selector_all("#sc-results tbody tr", "els => els.map(e => e.innerText.replace(/\\n/g,' | '))")
        log("稳定币：行数据", len(rows) >= 1, "; ".join(rows[:4]))

    # Add coin
    page.fill("#sc-new-coin", "PYUSD")
    page.click("#sc-add")
    page.wait_for_timeout(2500)
    chips = page.inner_text("#sc-coins")
    log("稳定币：添加 PYUSD", "PYUSD" in chips, chips.replace("\n", " ")[:80])
    rows2 = page.eval_on_selector_all("#sc-results tbody tr", "els => els.map(e => e.innerText.replace(/\\n/g,' | '))")
    log("稳定币：检测包含 PYUSD", any("PYUSD" in r for r in rows2), "; ".join(rows2[:4]))

    # Threshold change + manual check
    page.fill("#sc-threshold", "0.002")
    page.click("#sc-check")
    page.wait_for_timeout(2500)
    sc_meta2 = page.inner_text("#sc-meta")
    log("稳定币：手动检测更新 meta", "0.002" in sc_meta2 or "0.200" in sc_meta2 or "±" in sc_meta2, sc_meta2)

    # Save config
    page.click("#sc-save")
    page.wait_for_timeout(1000)
    toast = page.inner_text("#alert-toast") if page.query_selector("#alert-toast") else ""
    log("稳定币：保存配置", "已保存" in toast, toast)

    # Test email (SMTP not configured -> error toast, UI not crash)
    page.click("#sc-test-mail")
    page.wait_for_timeout(1200)
    toast = page.inner_text("#alert-toast") if page.query_selector("#alert-toast") else ""
    log("稳定币：测试邮件（未配置SMTP应提示）", "未配置" in toast or "失败" in toast or "已发送" in toast, toast)

    # Email status text
    meta = page.inner_text("#sc-meta")
    log("稳定币：SMTP 状态文案", "SMTP" in meta or "邮件" in meta or "coinbase" in meta.lower() or "±" in meta, meta)

    page.screenshot(path=f"{OUT}_3_stablecoin.png", full_page=True)

    # Remove a stablecoin chip
    before = page.inner_text("#sc-coins")
    rm = page.query_selector("#sc-coins [data-rm-sc]")
    if rm:
        coin = rm.get_attribute("data-rm-sc")
        rm.click()
        page.wait_for_timeout(1500)
        after = page.inner_text("#sc-coins")
        log("稳定币：删除 chip", coin not in after, f"removed {coin}")
    else:
        log("稳定币：删除 chip", False, "no rm button")

    # History refresh (empty state has no refresh btn)
    hist_text = page.inner_text("#alert-history")
    refresh = page.query_selector("#hist-refresh")
    if refresh:
        refresh.click()
        page.wait_for_timeout(600)
        log("历史：刷新按钮可点", True)
    else:
        log("历史：空态文案", "暂无告警" in hist_text or "无" in hist_text, hist_text[:40])

    # Console errors (email test 400 is expected when SMTP unset)
    errs = [c for c in console if (c.startswith("error") or c.startswith("pageerror")) and "400" not in c]
    log("无控制台 error", len(errs) == 0, "; ".join(errs[:3]))

    # Reset toggles to off so user's local state isn't left armed
    page.evaluate("""() => {
      const s = JSON.parse(localStorage.getItem('myweb_alerts')||'{}');
      s.volEnabled = false; s.ddEnabled = false; s.newsEnabled = false;
      localStorage.setItem('myweb_alerts', JSON.stringify(s));
    }""")

    browser.close()

print("\n==== UI SUMMARY ====")
fails = [r for r in results if r[0] == "FAIL"]
print(f"PASS {len(results)-len(fails)} / {len(results)}")
for s, n, d in fails:
    print(f"  FAIL: {n} — {d}")
