from __future__ import annotations

import argparse
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Iterable

import psycopg2
import requests
import yaml
from psycopg2.extras import execute_values

# command: python fetch_exchange_rates.py --api-key YOUR_API_KEY --start-date 2026-04-01 --end-date 2026-04-28 

API_URL_TEMPLATE = "https://v6.exchangerate-api.com/v6/{api_key}/history/{base_currency}/{year}/{month}/{day}"
RATE_SCALE = Decimal("0.000001")
DEFAULT_TARGETS = ("CNY", "USD")
DEFAULT_BASE = "JPY"
DEFAULT_LOOKBACK_DAYS = 30
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
DEFAULT_CONFIG_PATH = REPO_ROOT / "project" / "backend" / "internal" / "platform" / "config" / "config.dev.yaml"


@dataclass(frozen=True)
class ExchangeRateRow:
    base_currency: str
    target_currency: str
    rate: Decimal
    rate_date: date


def parse_args() -> argparse.Namespace:
    today = date.today()
    default_start = today - timedelta(days=DEFAULT_LOOKBACK_DAYS)

    parser = argparse.ArgumentParser(
        description="Fetch historical exchange rates from ExchangeRate-API and upsert them into exchange_rates.",
    )
    parser.add_argument(
        "--api-key",
        required=True,
        help="ExchangeRate-API key.",
    )
    parser.add_argument(
        "--config",
        default=str(DEFAULT_CONFIG_PATH),
        help="Path to backend YAML config. Default: project/backend/internal/platform/config/config.dev.yaml",
    )
    parser.add_argument(
        "--start-date",
        default=default_start.isoformat(),
        help="Inclusive start date in YYYY-MM-DD. Default: today - 30 days.",
    )
    parser.add_argument(
        "--end-date",
        default=today.isoformat(),
        help="Inclusive end date in YYYY-MM-DD. Default: today.",
    )
    parser.add_argument(
        "--base-currency",
        default=DEFAULT_BASE,
        help="Base currency to request from the API. Default: JPY.",
    )
    parser.add_argument(
        "--target-currencies",
        default=",".join(DEFAULT_TARGETS),
        help="Comma separated target currencies to persist. Default: CNY,USD.",
    )
    parser.add_argument(
        "--sleep-seconds",
        type=float,
        default=0.0,
        help="Sleep before each worker request to reduce quota pressure. Default: 0.0.",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=4,
        help="Number of concurrent HTTP workers. Default: 4.",
    )
    parser.add_argument(
        "--request-timeout",
        type=float,
        default=10.0,
        help="HTTP request timeout in seconds. Default: 20.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and print, but do not write to PostgreSQL.",
    )
    return parser.parse_args()


def parse_iso_date(value: str, flag_name: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise SystemExit(f"{flag_name} must be YYYY-MM-DD: {value}") from exc


def load_db_config(config_path: Path) -> dict:
    if not config_path.exists():
        raise SystemExit(f"Config file not found: {config_path}")

    with config_path.open("r", encoding="utf-8") as handle:
        payload = yaml.safe_load(handle) or {}

    db_config = payload.get("db") or {}
    required_keys = ("host", "port", "user", "password", "name")
    missing = [key for key in required_keys if not db_config.get(key)]
    if missing:
        raise SystemExit(f"DB config is incomplete in {config_path}: missing {', '.join(missing)}")
    return db_config


def daterange(start: date, end: date) -> Iterable[date]:
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def normalize_currency(code: str) -> str:
    normalized = code.strip().upper()
    if len(normalized) != 3 or not normalized.isalpha():
        raise SystemExit(f"Invalid currency code: {code}")
    return normalized


def normalize_targets(raw: str) -> tuple[str, ...]:
    targets: list[str] = []
    seen: set[str] = set()
    for part in raw.split(","):
        code = normalize_currency(part)
        if code in seen:
            continue
        seen.add(code)
        targets.append(code)
    if not targets:
        raise SystemExit("At least one target currency is required.")
    return tuple(targets)


def fetch_rates_for_day(
    api_key: str,
    base_currency: str,
    target_currencies: tuple[str, ...],
    target_date: date,
    timeout_seconds: float,
    sleep_seconds: float,
) -> list[ExchangeRateRow]:
    if sleep_seconds > 0:
        time.sleep(sleep_seconds)

    url = API_URL_TEMPLATE.format(
        api_key=api_key,
        base_currency=base_currency,
        year=target_date.year,
        month=target_date.month,
        day=target_date.day,
    )
    response = requests.get(url, timeout=timeout_seconds)
    response.raise_for_status()

    payload = response.json()
    if payload.get("result") != "success":
        error_type = payload.get("error-type", "unknown-error")
        raise RuntimeError(f"API returned error for {target_date}: {error_type}")

    conversion_rates = payload.get("conversion_rates") or {}
    rows: list[ExchangeRateRow] = []
    for target_currency in target_currencies:
        raw_rate = conversion_rates.get(target_currency)
        if raw_rate is None:
            print(f"[WARN] {target_date} missing rate for {base_currency}->{target_currency}")
            continue
        rate = Decimal(str(raw_rate)).quantize(RATE_SCALE, rounding=ROUND_HALF_UP)
        rows.append(
            ExchangeRateRow(
                base_currency=base_currency,
                target_currency=target_currency,
                rate=rate,
                rate_date=target_date,
            )
        )
    return rows


def upsert_rates(connection, rows: list[ExchangeRateRow]) -> int:
    if not rows:
        return 0

    sql = """
        INSERT INTO exchange_rates (base_currency, target_currency, rate, rate_date)
        VALUES %s
        ON CONFLICT (base_currency, target_currency, rate_date)
        DO UPDATE SET rate = EXCLUDED.rate
    """
    values = [
        (row.base_currency, row.target_currency, str(row.rate), row.rate_date.isoformat())
        for row in rows
    ]
    with connection.cursor() as cursor:
        execute_values(cursor, sql, values)
    connection.commit()
    return len(rows)


def main() -> int:
    args = parse_args()

    start_date = parse_iso_date(args.start_date, "--start-date")
    end_date = parse_iso_date(args.end_date, "--end-date")
    if start_date > end_date:
        raise SystemExit("--start-date cannot be after --end-date")
    if args.workers <= 0:
        raise SystemExit("--workers must be greater than 0")

    api_key = args.api_key.strip()

    base_currency = normalize_currency(args.base_currency)
    target_currencies = normalize_targets(args.target_currencies)
    config_path = Path(args.config).resolve()

    db_config = load_db_config(config_path)

    print(f"Config file: {config_path}")
    print(f"Date range : {start_date} -> {end_date}")
    print(f"Base       : {base_currency}")
    print(f"Targets    : {', '.join(target_currencies)}")
    print(f"Workers    : {args.workers}")
    print(f"Dry run    : {args.dry_run}")

    connection = None
    total_inserted = 0
    total_days = 0

    try:
        if not args.dry_run:
            connection = psycopg2.connect(
                host=db_config["host"],
                port=db_config["port"],
                user=db_config["user"],
                password=db_config["password"],
                dbname=db_config["name"],
            )
            connection.autocommit = False

        pending_dates = list(daterange(start_date, end_date))
        rows_by_date: dict[date, list[ExchangeRateRow]] = {}

        with ThreadPoolExecutor(max_workers=args.workers) as executor:
            future_map = {
                executor.submit(
                    fetch_rates_for_day,
                    api_key=api_key,
                    base_currency=base_currency,
                    target_currencies=target_currencies,
                    target_date=current_date,
                    timeout_seconds=args.request_timeout,
                    sleep_seconds=args.sleep_seconds,
                ): current_date
                for current_date in pending_dates
            }

            for future in as_completed(future_map):
                current_date = future_map[future]
                rows = future.result()
                rows_by_date[current_date] = rows
                total_days += 1
                print(f"[FETCHED] {current_date} {len(rows)} row(s)")

        for current_date in pending_dates:
            rows = rows_by_date.get(current_date, [])
            if args.dry_run:
                for row in rows:
                    print(
                        f"[DRY-RUN] {row.rate_date} {row.base_currency}->{row.target_currency} rate={row.rate}"
                    )
                continue

            inserted = upsert_rates(connection, rows)
            total_inserted += inserted
            print(f"[OK] {current_date} upserted {inserted} row(s)")
    except KeyboardInterrupt:
        print("Interrupted by user.")
        if connection is not None:
            connection.rollback()
        return 1
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        if connection is not None:
            connection.rollback()
        return 1
    finally:
        if connection is not None:
            connection.close()

    if args.dry_run:
        print(f"Completed dry run for {total_days} day(s).")
    else:
        print(f"Completed. Upserted {total_inserted} row(s) across {total_days} day(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
