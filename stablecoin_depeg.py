#!/usr/bin/env python3
"""稳定币脱钩检测 — 使用 Coinbase 公开价格 API。

用法示例：
  python stablecoin_depeg.py
  python stablecoin_depeg.py --watch --interval 30
  python stablecoin_depeg.py --threshold 0.003 --proxy http://127.0.0.1:7897
  python stablecoin_depeg.py --coins USDT,USDC,DAI --csv log.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable

API_BASE = "https://api.coinbase.com/v2/prices"
DEFAULT_COINS = ("USDT", "USDC", "DAI", "PYUSD", "GUSD", "USD1", "BUSD")
PEG = 1.0
DEFAULT_PROXY = "http://127.0.0.1:7897"
USER_AGENT = "stablecoin-depeg-checker/1.0"

# ANSI colors (Windows 10+ console supports these when VT is enabled)
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"


@dataclass
class Quote:
    symbol: str
    price: float
    currency: str = "USD"

    @property
    def deviation(self) -> float:
        return self.price - PEG

    @property
    def deviation_bps(self) -> float:
        return self.deviation * 10_000.0

    @property
    def deviation_pct(self) -> float:
        return self.deviation * 100.0


@dataclass
class CheckResult:
    quote: Quote | None
    threshold: float
    error: str | None = None

    @property
    def ok(self) -> bool:
        return self.quote is not None and self.error is None

    @property
    def depegged(self) -> bool:
        if self.quote is None:
            return False
        return abs(self.quote.deviation) >= self.threshold

    @property
    def severity(self) -> str:
        if not self.ok or self.quote is None:
            return "error"
        if not self.depegged:
            return "ok"
        # Soft / hard bands relative to threshold
        ratio = abs(self.quote.deviation) / self.threshold
        if ratio >= 3.0:
            return "critical"
        if ratio >= 1.5:
            return "warn"
        return "depeg"


def enable_windows_vt() -> None:
    if os.name != "nt":
        return
    try:
        import ctypes

        kernel32 = ctypes.windll.kernel32
        handle = kernel32.GetStdHandle(-11)  # STD_OUTPUT_HANDLE
        mode = ctypes.c_uint32()
        if kernel32.GetConsoleMode(handle, ctypes.byref(mode)):
            kernel32.SetConsoleMode(handle, mode.value | 0x0004)  # ENABLE_VT_PROCESSING
    except Exception:
        pass


def build_opener(proxy: str | None) -> urllib.request.OpenerDirector:
    handlers: list[urllib.request.BaseHandler] = []
    if proxy:
        handlers.append(
            urllib.request.ProxyHandler(
                {
                    "http": proxy,
                    "https": proxy,
                }
            )
        )
    return urllib.request.build_opener(*handlers)


def fetch_spot(
    opener: urllib.request.OpenerDirector,
    symbol: str,
    timeout: float = 10.0,
) -> Quote:
    url = f"{API_BASE}/{symbol}-USD/spot"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with opener.open(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
    payload = json.loads(raw)
    data = payload.get("data") or {}
    amount = data.get("amount")
    if amount is None:
        raise ValueError(f"响应缺少 amount: {raw[:200]}")
    return Quote(symbol=symbol, price=float(amount), currency=data.get("currency", "USD"))


def check_coins(
    coins: Iterable[str],
    threshold: float,
    proxy: str | None,
    timeout: float,
) -> list[CheckResult]:
    opener = build_opener(proxy)
    results: list[CheckResult] = []
    for coin in coins:
        try:
            quote = fetch_spot(opener, coin, timeout=timeout)
            results.append(CheckResult(quote=quote, threshold=threshold))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                msg = "交易对不存在"
            else:
                msg = f"HTTP {e.code}"
            results.append(CheckResult(quote=None, threshold=threshold, error=msg))
        except Exception as e:  # noqa: BLE001 - surface any network/parse failure
            results.append(CheckResult(quote=None, threshold=threshold, error=str(e)))
    return results


def color_for(severity: str) -> str:
    return {
        "ok": GREEN,
        "depeg": YELLOW,
        "warn": RED,
        "critical": RED + BOLD,
        "error": DIM,
    }.get(severity, "")


def fmt_dev(quote: Quote) -> str:
    sign = "+" if quote.deviation >= 0 else ""
    return f"{sign}{quote.deviation_pct:.4f}%  ({sign}{quote.deviation_bps:.1f} bps)"


def print_table(results: list[CheckResult], threshold: float) -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    thr_pct = threshold * 100
    print()
    print(f"{BOLD}{CYAN}稳定币脱钩检测{RESET}  {DIM}{now}{RESET}")
    print(f"钉住目标: {PEG:.2f} USD    阈值: ±{thr_pct:.3f}%    数据源: Coinbase Spot")
    print("-" * 72)
    header = f"{'币种':<8}{'价格(USD)':>14}{'偏离':>28}{'状态':>12}"
    print(header)
    print("-" * 72)

    depeg_count = 0
    error_count = 0
    for r in results:
        if not r.ok or r.quote is None:
            error_count += 1
            print(f"{DIM}{'?':<8}{'—':>14}{r.error or '错误':>28}{'无法获取':>12}{RESET}")
            continue

        q = r.quote
        sev = r.severity
        if r.depegged:
            depeg_count += 1
        color = color_for(sev)
        status = {
            "ok": "正常",
            "depeg": "轻微脱钩",
            "warn": "明显脱钩",
            "critical": "严重脱钩",
        }.get(sev, sev)
        print(
            f"{color}{q.symbol:<8}{q.price:>14.6f}{fmt_dev(q):>28}{status:>12}{RESET}"
        )

    print("-" * 72)
    summary_parts = [f"共 {len(results)} 个", f"正常 {len(results) - depeg_count - error_count}"]
    if depeg_count:
        summary_parts.append(f"{RED}脱钩 {depeg_count}{RESET}")
    if error_count:
        summary_parts.append(f"{DIM}失败 {error_count}{RESET}")
    print("  ".join(summary_parts))
    if depeg_count:
        print(f"{RED}{BOLD}⚠ 检测到脱钩，建议关注储备/赎回情况{RESET}")
    print()


def append_csv(path: str, results: list[CheckResult]) -> None:
    exists = os.path.exists(path)
    with open(path, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not exists:
            writer.writerow(
                [
                    "timestamp_utc",
                    "symbol",
                    "price_usd",
                    "deviation_pct",
                    "deviation_bps",
                    "depegged",
                    "error",
                ]
            )
        ts = datetime.now(timezone.utc).isoformat()
        for r in results:
            if r.quote is not None:
                writer.writerow(
                    [
                        ts,
                        r.quote.symbol,
                        f"{r.quote.price:.8f}",
                        f"{r.quote.deviation_pct:.6f}",
                        f"{r.quote.deviation_bps:.3f}",
                        int(r.depegged),
                        "",
                    ]
                )
            else:
                # keep a placeholder row for failed symbols is not available here
                pass


def parse_coins(raw: str) -> list[str]:
    coins = [c.strip().upper() for c in raw.split(",") if c.strip()]
    if not coins:
        raise argparse.ArgumentTypeError("至少指定一个币种")
    return coins


def resolve_proxy(cli_proxy: str | None, allow_env: bool) -> str | None:
    if cli_proxy:
        return None if cli_proxy.lower() in {"none", "off", ""} else cli_proxy
    if allow_env:
        env = os.environ.get("HTTP_PROXY") or os.environ.get("HTTPS_PROXY")
        if env:
            return env
        return DEFAULT_PROXY
    return None


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="检查稳定币是否相对 USD 脱钩（Coinbase 公开 API）",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument(
        "--coins",
        type=parse_coins,
        default=",".join(DEFAULT_COINS),
        help="要监控的稳定币，逗号分隔",
    )
    p.add_argument(
        "--threshold",
        type=float,
        default=0.005,
        help="脱钩阈值，相对 1.0 的绝对偏离（0.005 = 0.5%%）",
    )
    p.add_argument(
        "--proxy",
        default=None,
        help=f"HTTP(S) 代理，如 {DEFAULT_PROXY}；传 none 关闭",
    )
    p.add_argument(
        "--no-default-proxy",
        action="store_true",
        help="不自动使用本地 7897 代理",
    )
    p.add_argument("--timeout", type=float, default=10.0, help="请求超时秒数")
    p.add_argument("--watch", action="store_true", help="持续监控模式")
    p.add_argument("--interval", type=float, default=30.0, help="watch 模式刷新间隔秒")
    p.add_argument("--csv", default=None, help="将结果追加写入 CSV 文件")
    p.add_argument("--json", action="store_true", help="以 JSON 输出一次结果")
    p.add_argument(
        "--exit-code",
        action="store_true",
        help="发现脱钩时以退出码 2 返回（便于脚本/告警集成）",
    )
    return p


def results_to_json(results: list[CheckResult], threshold: float) -> str:
    payload = {
        "peg": PEG,
        "threshold": threshold,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "source": "coinbase_v2_spot",
        "results": [],
    }
    for r in results:
        if r.quote is not None:
            payload["results"].append(
                {
                    "symbol": r.quote.symbol,
                    "price": r.quote.price,
                    "deviation": r.quote.deviation,
                    "deviation_pct": r.quote.deviation_pct,
                    "deviation_bps": r.quote.deviation_bps,
                    "depegged": r.depegged,
                    "severity": r.severity,
                    "error": None,
                }
            )
        else:
            payload["results"].append(
                {
                    "symbol": None,
                    "error": r.error,
                }
            )
    return json.dumps(payload, ensure_ascii=False, indent=2)


def main(argv: list[str] | None = None) -> int:
    enable_windows_vt()
    args = build_parser().parse_args(argv)
    coins = args.coins if isinstance(args.coins, list) else parse_coins(args.coins)
    proxy = resolve_proxy(args.proxy, allow_env=not args.no_default_proxy)
    threshold = abs(args.threshold)

    if proxy:
        print(f"{DIM}代理: {proxy}{RESET}", file=sys.stderr)
    else:
        print(f"{DIM}代理: 无（直连）{RESET}", file=sys.stderr)

    try:
        while True:
            results = check_coins(coins, threshold, proxy, args.timeout)

            if args.json:
                print(results_to_json(results, threshold))
            else:
                print_table(results, threshold)

            if args.csv:
                append_csv(args.csv, results)

            depegged = any(r.depegged for r in results)

            if not args.watch:
                if args.exit_code and depegged:
                    return 2
                return 0

            time.sleep(max(1.0, args.interval))
            if args.exit_code and depegged:
                # still continue watching; exit-code only matters on one-shot
                pass
    except KeyboardInterrupt:
        print(f"\n{DIM}已停止监控{RESET}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
