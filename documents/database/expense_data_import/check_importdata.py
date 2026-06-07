from __future__ import annotations

import argparse
import sys

from importdata_common import (
    ApiError,
    ValidationFailed,
    add_common_args,
    print_check_summary,
    print_validation_failed,
    run_check,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Validate importdata.xlsx before import. "
            "This checks source structure, merged-expense structure, currency rules, "
            "and exact category-name matches against the target account book."
        ),
    )
    add_common_args(parser)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        result = run_check(
            api_base_url=args.api_base_url,
            account_book_id=args.account_book_id,
            token=args.token,
            email=args.email,
            password=args.password,
            source_path=args.source,
            sheet_name=args.sheet,
            merge_category_name=args.merge_category_name,
            timeout_seconds=args.timeout,
            lookback_days=args.lookback_days,
        )
    except ValidationFailed as exc:
        print_validation_failed(exc)
        return 1
    except (ApiError, FileNotFoundError, ValueError) as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    print_check_summary(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
