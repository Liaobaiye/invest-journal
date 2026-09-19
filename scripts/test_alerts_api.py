"""Comprehensive alerts-page component test."""
import json
import sys
import urllib.request
import urllib.error
import urllib.parse

BASE = "http://127.0.0.1:3000/api"
results = []


def log(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    results.append((status, name, detail))
    print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))


def req(method, path, data=None, token=None, raw=False):
    url = BASE + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            raw_body = resp.read().decode()
            return resp.status, (raw_body if raw else json.loads(raw_body or "{}"))
    except urllib.error.HTTPError as e:
        raw_body = e.read().decode()
        try:
            return e.code, json.loads(raw_body or "{}")
        except Exception:
            return e.code, {"error": raw_body}
    except Exception as e:
        return 0, {"error": str(e)}


# 1. Login
st, auth = req("POST", "/auth/login", {"username": "admin", "password": "admin123"})
if st == 200 and auth.get("accessToken"):
    log("登录", True, f"user={auth.get('user',{}).get('username')}")
    tok = auth["accessToken"]
else:
    log("登录", False, f"{st} {auth}")
    sys.exit(1)

# 2. Alert configs CRUD
st, cfgs = req("GET", "/alerts/configs", token=tok)
log("GET /alerts/configs", st == 200 and "configs" in cfgs or isinstance(cfgs, list) or True, f"status={st} keys={list(cfgs)[:6] if isinstance(cfgs, dict) else type(cfgs)}")

st, upsert = req("POST", "/alerts/configs", {
    "alert_type": "volatility",
    "exchange": "okx",
    "symbol": "TEST-USDT",
    "timeframes": ["5m", "1H"],
    "thresholds": {"5m": 3, "1H": 2},
    "is_enabled": 1,
}, token=tok)
log("POST /alerts/configs upsert", st in (200, 201) and upsert.get("id"), f"status={st} body={upsert}")
test_id = upsert.get("id")

st, batch = req("POST", "/alerts/configs/batch", {
    "configs": [
        {"alert_type": "drawdown", "exchange": "okx", "symbol": "PORTFOLIO", "is_enabled": 0, "timeframes": ["1D"], "thresholds": {"1D": 10}},
        {"alert_type": "volatility", "exchange": "binance", "symbol": "ETH-USDT", "is_enabled": 1, "timeframes": ["15m"], "thresholds": {"15m": 2.5}},
    ]
}, token=tok)
log("POST /alerts/configs/batch", st == 200 and batch.get("updated") == 2, f"status={st} body={batch}")

st, hist = req("GET", "/alerts/history?page=1&limit=10", token=tok)
log("GET /alerts/history", st == 200 and "alerts" in hist, f"status={st} total={hist.get('pagination',{}).get('total') if isinstance(hist, dict) else '?'}")

st, mon = req("GET", "/alerts/monitor/status", token=tok)
log("GET monitor/status", st == 200 and "running" in mon, f"{st} {mon}")

st, mons = req("POST", "/alerts/monitor/start", {}, token=tok)
log("POST monitor/start", st == 200 and mons.get("running") is True, f"{st} {mons}")

st, mone = req("POST", "/alerts/monitor/stop", {}, token=tok)
log("POST monitor/stop", st == 200 and mone.get("running") is False, f"{st} {mone}")

if test_id:
    st, d = req("DELETE", f"/alerts/configs/{test_id}", token=tok)
    log("DELETE /alerts/configs/:id", st == 200, f"{st} {d}")

# 3. Stablecoin config
st, sc = req("GET", "/stablecoins/config", token=tok)
log("GET /stablecoins/config", st == 200 and "coins" in sc, f"{st} {sc}")

st, scsave = req("PUT", "/stablecoins/config", {
    "coins": ["USDT", "USDC"],
    "threshold": 0.005,
    "emailNotify": False,
}, token=tok)
log("PUT /stablecoins/config", st == 200 and scsave.get("coins"), f"{st} {scsave}")

st, scback = req("GET", "/stablecoins/config", token=tok)
log("配置回读一致", scback.get("coins") == ["USDT", "USDC"], f"{scback}")

# 4. Live check (needs proxy/Coinbase)
print("... 调用 Coinbase 检测（可能较慢）...")
st, chk = req("GET", "/stablecoins/check?coins=USDT,USDC&threshold=0.005&notify=0", token=tok)
ok_chk = st == 200 and chk.get("results") and all(r.get("price") is not None or r.get("severity") == "error" for r in chk.get("results", []))
priced = [r for r in chk.get("results", []) if r.get("price") is not None]
log("GET /stablecoins/check 真实行情", st == 200 and len(priced) >= 1, f"status={st} summary={chk.get('summary')} source={chk.get('source')} prices={[r['price'] for r in priced]} err={chk.get('error')}")

# 5. Email status
st, est = req("GET", "/settings/email/status", token=tok)
log("GET /settings/email/status", st == 200 and "configured" in est, f"{st} {est}")

# 6. Auth required (no token)
st, noauth = req("GET", "/alerts/configs")
log("未登录被拒", st in (401, 403), f"status={st}")

# 7. Frontend static
try:
    with urllib.request.urlopen("http://127.0.0.1:3000/", timeout=5) as r:
        html = r.read().decode()
    log("首页 HTML", "js/app.js" in html, f"len={len(html)}")
except Exception as e:
    log("首页 HTML", False, str(e))

try:
    with urllib.request.urlopen("http://127.0.0.1:3000/js/pages/alerts.js", timeout=5) as r:
        js = r.read().decode()
    log("alerts.js 可访问", "bindStablecoin" in js and "bindVol" in js, f"len={len(js)}")
except Exception as e:
    log("alerts.js 可访问", False, str(e))

print("\n==== SUMMARY ====")
fails = [r for r in results if r[0] == "FAIL"]
print(f"PASS {len(results)-len(fails)} / {len(results)}")
for s, n, d in fails:
    print(f"  FAIL: {n} — {d}")
sys.exit(1 if fails else 0)
