"""Cleanup test alert configs and restore stablecoin defaults."""
import json
import urllib.request

BASE = "http://127.0.0.1:3000/api"


def req(method, path, data=None, token=None):
    url = BASE + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")
    except Exception as e:
        return 0, {"error": str(e)}


st, auth = req("POST", "/auth/login", {"username": "admin", "password": "admin123"})
tok = auth["accessToken"]

st, cfgs = req("GET", "/alerts/configs", token=tok)
print("configs before:", cfgs if st == 200 else st)

# Remove test-only rows
for c in (cfgs if isinstance(cfgs, list) else []):
    if c.get("symbol") in ("TEST-USDT", "PORTFOLIO") or (
        c.get("alert_type") == "volatility" and c.get("exchange") == "binance" and c.get("symbol") == "ETH-USDT"
    ):
        st, d = req("DELETE", f"/alerts/configs/{c['id']}", token=tok)
        print("deleted", c["id"], c.get("symbol"), st, d)

st, sc = req("PUT", "/stablecoins/config", {
    "coins": ["USDT", "USDC", "DAI"],
    "threshold": 0.005,
    "emailNotify": False,
}, token=tok)
print("stablecoin restored:", st, sc)

st, cfgs = req("GET", "/alerts/configs", token=tok)
print("configs after:", cfgs)
