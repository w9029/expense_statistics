from __future__ import annotations

import argparse
import sys
import time

from importdata_common import (
    ApiError,
    ExpenseApiClient,
    MergedExpenseEntry,
    NormalExpenseEntry,
    ValidationFailed,
    add_common_args,
    print_check_summary,
    print_validation_failed,
    run_check,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Import importdata.xlsx into the backend by calling expense APIs. "
            "This command always runs the same validation as check_importdata.py before writing anything."
        ),
    )
    add_common_args(parser)
    parser.add_argument(
        "--sleep-seconds",
        type=float,
        default=0.0,
        help="Sleep between successful API writes. Default: 0.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Only import the first N top-level expense entries after validation. 0 means no limit.",
    )
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
        )
    except ValidationFailed as exc:
        print_validation_failed(exc)
        return 1
    except (ApiError, FileNotFoundError, ValueError) as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    print_check_summary(result)

    entries = result.entries
    if args.limit > 0:
        entries = entries[: args.limit]
        print(f"Import limit enabled. Only importing first {len(entries)} top-level entries.")

    client = ExpenseApiClient(
        api_base_url=args.api_base_url,
        token=args.token,
        email=args.email,
        password=args.password,
        timeout_seconds=args.timeout,
    )

    total = len(entries)
    for index, entry in enumerate(entries, start=1):
        try:
            if isinstance(entry, NormalExpenseEntry):
                payload = {
                    "category_id": result.categories_by_name[entry.category_name].id,
                    "name": entry.name,
                    "description": entry.note,
                    "original_amount": entry.amount,
                    "original_currency": entry.currency,
                    "spent_at": entry.spent_at,
                }
                created = client.create_normal_expense(args.account_book_id, payload)
                created_id = created.get("id", "<unknown>")
                print(
                    f"[{index}/{total}] row {entry.excel_row} normal imported "
                    f'-> expense_id={created_id}'
                )
            else:
                payload = {
                    "parent": {
                        "category_id": result.merge_category.id,
                        "name": entry.name,
                        "description": entry.note,
                        "total_original_amount": entry.total_amount,
                        "original_currency": entry.currency,
                        "spent_at": entry.spent_at,
                    },
                    "children_amount_input_mode": "pretax",
                    "children": [
                        {
                            "category_id": result.categories_by_name[child.category_name].id,
                            "name": child.name,
                            "description": child.note,
                            "amount_input": child.amount,
                        }
                        for child in entry.children
                    ],
                }
                created = client.create_merged_expense(args.account_book_id, payload)
                parent_id = created.get("parent", {}).get("id", "<unknown>")
                print(
                    f"[{index}/{total}] row {entry.excel_row} merged imported "
                    f"with {len(entry.children)} children -> parent_id={parent_id}"
                )
        except ApiError as exc:
            print(
                f"[ERROR] import stopped at row {entry.excel_row}: {exc}",
                file=sys.stderr,
            )
            return 1

        if args.sleep_seconds > 0:
            time.sleep(args.sleep_seconds)

    print(f"Import completed. Top-level entries imported: {total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
