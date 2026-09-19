"""Smoke test altcoin APIs + UI."""
import json
import time
import urllib.request
import urllib.error
import sys

BASE = "http://127.0.0.1:3000/api"
results = []


def log(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    results.append((status, name, detail))
    print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))


def req(method, path, data=None, token=None):
    url = BASE + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception:
            return e.code, {"error": "bad json"}
    except Exception as e:
        return 0, {"error": str(e)}


st, auth = req("POST", "/auth/login", {"username": "admin", "password": "admin123"})
tok = auth.get("accessToken")
log("登录", bool(tok))

st, stt = req("GET", "/altcoin/status")
log("GET /altcoin/status", st == 200 and "running" in stt, str(stt))

st, res = req("GET", "/altcoin/results")
log("GET /altcoin/results", st == 200 and "coins" in res, f"coins={len(res.get('coins',[]))}")

# start a small scan first (fast validation)
st, scan = req("POST", "/altcoin/scan", {"threshold": 5, "daysToCheck": 10, "previousDays": 7, "maxSymbols": 40, "concurrency": 6}, token=tok)
log("POST scan maxSymbols=40", st in (202, 409), f"{st} {scan}")

# poll up to 90s
final = None
for i in range(45):
    time.sleep(2)
    st, stt = req("GET", "/altcoin/status")
    if st != 200:
        continue
    if not stt.get("running"):
        final = stt
        break
    if i % 5 == 0:
        print(f"  progress {stt.get('done')}/{stt.get('total')} ...")

log("扫描完成", final is not None and not final.get("error"), str(final))
st, res = req("GET", "/altcoin/results")
coins = res.get("coins") or []
log("结果写入缓存", res.get("totalSymbols", 0) > 0, f"total={res.get('totalSymbols')} hits={len(coins)} dur={res.get('durationMs')}ms")
if coins:
    c = coins[0]
    log("结果字段完整", all(k in c for k in ("symbol", "date", "ratio", "volume")), f"top={c.get('symbol')} {c.get('ratio'):.2f}x")

# klines for top coin or BTC
sym = coins[0]["symbol"] if coins else "BTCUSDT"
st, kl = req("GET", f"/altcoin/klines?symbol={sym}&limit=60")
candles = kl.get("candles") or []
log("GET klines", st == 200 and len(candles) >= 30, f"sym={sym} n={len(candles)} err={kl.get('error')}")
if candles:
    c0 = candles[0]
    log("klines 字段", all(k in c0 for k in ("open", "high", "low", "close", "volume", "openTime")), str(list(c0.keys())))

# unauthenticated scan rejected
st, _ = req("POST", "/altcoin/scan", {"maxSymbols": 5})
log("未登录 scan 被拒", st in (401, 403), f"status={st}")

print("\n==== SUMMARY ====")
fails = [r for r in results if r[0] == "FAIL"]
print(f"PASS {len(results)-len(fails)} / {len(results)}")
for s, n, d in fails:
    print(f"  FAIL: {n} — {d}")
sys.exit(1 if fails else 0)
