from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import requests
from openpyxl import load_workbook

DEFAULT_API_BASE_URL = "http://127.0.0.1:8080/api/v1"
DEFAULT_SOURCE_PATH = Path(__file__).resolve().parent / "importdata.xlsx"
DEFAULT_SHEET_NAME = "日常开销"
DEFAULT_MERGE_CATEGORY_NAME = "合并消费"
EXPECTED_HEADERS = ("日期", "消费数额", "消费名称", "消费种类", "币种", "备注")
_CURRENCY_ALIASES = {
    "": "JPY",
    "JPY": "JPY",
    "CNY": "CNY",
    "USD": "USD",
    "日元": "JPY",
    "人民币": "CNY",
    "美元": "USD",
}


class ApiError(RuntimeError):
    def __init__(self, message: str, *, status_code: int | None = None, code: str | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code


@dataclass(frozen=True)
class CategoryRecord:
    id: str
    name: str
    is_merge_category: bool


@dataclass(frozen=True)
class SourceRow:
    excel_row: int
    spent_at: str | None
    amount: str
    name: str
    category_name: str | None
    currency: str
    currency_explicit: bool
    note: str | None


@dataclass(frozen=True)
class ChildExpense:
    excel_row: int
    amount: str
    name: str
    category_name: str
    note: str | None


@dataclass(frozen=True)
class NormalExpenseEntry:
    excel_row: int
    spent_at: str
    amount: str
    name: str
    category_name: str
    currency: str
    note: str | None


@dataclass(frozen=True)
class MergedExpenseEntry:
    excel_row: int
    spent_at: str
    total_amount: str
    name: str
    currency: str
    note: str | None
    children: list[ChildExpense]


@dataclass(frozen=True)
class ValidationIssue:
    excel_row: int
    message: str


@dataclass(frozen=True)
class CheckResult:
    categories_by_name: dict[str, CategoryRecord]
    merge_category: CategoryRecord
    entries: list[NormalExpenseEntry | MergedExpenseEntry]
    normal_count: int
    merged_count: int
    merged_child_count: int


class ExpenseApiClient:
    def __init__(
        self,
        *,
        api_base_url: str,
        token: str | None,
        email: str | None,
        password: str | None,
        timeout_seconds: float,
    ) -> None:
        self.api_base_url = api_base_url.rstrip("/")
        self.token = token.strip() if token else None
        self.email = email.strip() if email else None
        self.password = password if password else None
        self.timeout_seconds = timeout_seconds
        self.session = requests.Session()

    def list_categories(self, account_book_id: str) -> list[CategoryRecord]:
        payload = self._request_json(
            "GET",
            f"/account-books/{account_book_id}/expense-categories",
        )
        if not isinstance(payload, list):
            raise ApiError("category list response is not an array")
        categories: list[CategoryRecord] = []
        for item in payload:
            categories.append(
                CategoryRecord(
                    id=str(item["id"]),
                    name=str(item["name"]),
                    is_merge_category=bool(item["is_merge_category"]),
                )
            )
        return categories

    def create_normal_expense(self, account_book_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        return self._request_json(
            "POST",
            f"/account-books/{account_book_id}/expenses/normal",
            body=payload,
        )

    def create_merged_expense(self, account_book_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        return self._request_json(
            "POST",
            f"/account-books/{account_book_id}/expenses/merged",
            body=payload,
        )

    def _request_json(self, method: str, path: str, body: dict[str, Any] | None = None) -> Any:
        self._ensure_token()
        response = self.session.request(
            method=method,
            url=f"{self.api_base_url}{path}",
            headers=self._headers(),
            json=body,
            timeout=self.timeout_seconds,
        )
        if response.status_code == 401 and self.email and self.password:
            self._login(force=True)
            response = self.session.request(
                method=method,
                url=f"{self.api_base_url}{path}",
                headers=self._headers(),
                json=body,
                timeout=self.timeout_seconds,
            )
        return self._unwrap_response(response)

    def _ensure_token(self) -> None:
        if self.token:
            return
        if not self.email or not self.password:
            raise ApiError("token is required, or provide --email and --password for auto login")
        self._login(force=False)

    def _login(self, *, force: bool) -> None:
        if self.token and not force:
            return
        if not self.email or not self.password:
            raise ApiError("cannot login without --email and --password")
        response = self.session.post(
            f"{self.api_base_url}/identity/login",
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            json={"email": self.email, "password": self.password},
            timeout=self.timeout_seconds,
        )
        payload = self._unwrap_response(response)
        token = payload.get("access_token")
        if not token:
            raise ApiError("login response does not include access_token")
        self.token = str(token)

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    @staticmethod
    def _unwrap_response(response: requests.Response) -> Any:
        try:
            payload = response.json()
        except json.JSONDecodeError as exc:
            raise ApiError(
                f"request failed with non-JSON response: {response.status_code}",
                status_code=response.status_code,
            ) from exc

        if response.ok and payload.get("ok") is True:
            return payload.get("data")

        message = payload.get("message") or f"request failed: {response.status_code}"
        code = payload.get("error")
        raise ApiError(message, status_code=response.status_code, code=code)


def add_common_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--api-base-url",
        default=DEFAULT_API_BASE_URL,
        help="Backend API base URL. Default: http://127.0.0.1:8080/api/v1",
    )
    parser.add_argument(
        "--account-book-id",
        required=True,
        help="Target account book ID.",
    )
    parser.add_argument(
        "--token",
        help="Access token for backend API.",
    )
    parser.add_argument(
        "--email",
        help="Optional login email used when --token is omitted or expires mid-run.",
    )
    parser.add_argument(
        "--password",
        help="Optional login password used when --token is omitted or expires mid-run.",
    )
    parser.add_argument(
        "--source",
        default=str(DEFAULT_SOURCE_PATH),
        help="Path to importdata.xlsx. Default: documents/database/expense_data_import/importdata.xlsx",
    )
    parser.add_argument(
        "--sheet",
        default=DEFAULT_SHEET_NAME,
        help="Worksheet name. Default: 日常开销",
    )
    parser.add_argument(
        "--merge-category-name",
        default=DEFAULT_MERGE_CATEGORY_NAME,
        help="Exact category name used for merged expense parents. Default: 合并消费",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=20.0,
        help="HTTP timeout in seconds. Default: 20.",
    )


def run_check(
    *,
    api_base_url: str,
    account_book_id: str,
    token: str | None,
    email: str | None,
    password: str | None,
    source_path: str | Path,
    sheet_name: str,
    merge_category_name: str,
    timeout_seconds: float,
) -> CheckResult:
    client = ExpenseApiClient(
        api_base_url=api_base_url,
        token=token,
        email=email,
        password=password,
        timeout_seconds=timeout_seconds,
    )
    categories = client.list_categories(account_book_id)
    categories_by_name, merge_category = validate_category_catalog(categories, merge_category_name)
    rows, issues = load_source_rows(Path(source_path), sheet_name)
    entries, entry_issues = build_entries(rows, categories_by_name)
    issues.extend(entry_issues)
    if issues:
        raise ValidationFailed(issues)
    normal_count = sum(isinstance(entry, NormalExpenseEntry) for entry in entries)
    merged_count = sum(isinstance(entry, MergedExpenseEntry) for entry in entries)
    merged_child_count = sum(
        len(entry.children) for entry in entries if isinstance(entry, MergedExpenseEntry)
    )
    return CheckResult(
        categories_by_name=categories_by_name,
        merge_category=merge_category,
        entries=entries,
        normal_count=normal_count,
        merged_count=merged_count,
        merged_child_count=merged_child_count,
    )


class ValidationFailed(RuntimeError):
    def __init__(self, issues: list[ValidationIssue]) -> None:
        super().__init__(f"validation failed with {len(issues)} issue(s)")
        self.issues = issues


def validate_category_catalog(
    categories: list[CategoryRecord],
    merge_category_name: str,
) -> tuple[dict[str, CategoryRecord], CategoryRecord]:
    categories_by_name: dict[str, CategoryRecord] = {}
    for category in categories:
        if category.name in categories_by_name:
            raise ApiError(f"duplicate category name returned by backend: {category.name}")
        categories_by_name[category.name] = category

    merge_category = categories_by_name.get(merge_category_name)
    if merge_category is None:
        raise ApiError(f'merge category "{merge_category_name}" does not exist in the target account book')
    if not merge_category.is_merge_category:
        raise ApiError(f'category "{merge_category_name}" exists but is not a merge category')
    return categories_by_name, merge_category


def load_source_rows(source_path: Path, sheet_name: str) -> tuple[list[SourceRow], list[ValidationIssue]]:
    if not source_path.exists():
        raise FileNotFoundError(f"source workbook not found: {source_path}")

    workbook = load_workbook(source_path, read_only=True, data_only=True)
    if sheet_name not in workbook.sheetnames:
        available = ", ".join(workbook.sheetnames)
        raise ValueError(f'worksheet "{sheet_name}" not found. Available sheets: {available}')

    sheet = workbook[sheet_name]
    header_cells = next(sheet.iter_rows(min_row=1, max_row=1, min_col=1, max_col=6, values_only=True))
    headers = tuple("" if cell is None else str(cell).strip() for cell in header_cells)
    if headers != EXPECTED_HEADERS:
        raise ValueError(f"worksheet headers must be exactly {EXPECTED_HEADERS}, got {headers}")

    rows: list[SourceRow] = []
    issues: list[ValidationIssue] = []
    for excel_row, values in enumerate(
        sheet.iter_rows(min_row=2, min_col=1, max_col=6, values_only=True),
        start=2,
    ):
        if all(value is None or str(value).strip() == "" for value in values):
            continue
        try:
            spent_at = parse_excel_date(values[0], excel_row)
            amount = parse_excel_amount(values[1], excel_row)
            name = parse_required_text(values[2], excel_row, "消费名称")
            category_name = parse_optional_text(values[3])
            currency, currency_explicit = parse_currency(values[4], excel_row)
            note = parse_optional_text(values[5])
        except ValueError as exc:
            issues.append(ValidationIssue(excel_row=excel_row, message=str(exc)))
            continue
        rows.append(
            SourceRow(
                excel_row=excel_row,
                spent_at=spent_at,
                amount=amount,
                name=name,
                category_name=category_name,
                currency=currency,
                currency_explicit=currency_explicit,
                note=note,
            )
        )
    return rows, issues


def build_entries(
    rows: list[SourceRow],
    categories_by_name: dict[str, CategoryRecord],
) -> tuple[list[NormalExpenseEntry | MergedExpenseEntry], list[ValidationIssue]]:
    entries: list[NormalExpenseEntry | MergedExpenseEntry] = []
    issues: list[ValidationIssue] = []

    index = 0
    while index < len(rows):
        row = rows[index]
        if row.spent_at is None:
            issues.append(
                ValidationIssue(
                    excel_row=row.excel_row,
                    message="child row cannot appear before a parent row with date",
                )
            )
            index += 1
            continue

        if row.category_name:
            category = categories_by_name.get(row.category_name)
            if category is None:
                issues.append(
                    ValidationIssue(
                        excel_row=row.excel_row,
                        message=f'category "{row.category_name}" does not exist in target account book',
                    )
                )
            elif category.is_merge_category:
                issues.append(
                    ValidationIssue(
                        excel_row=row.excel_row,
                        message=f'normal expense row cannot use merge category "{row.category_name}"',
                    )
                )
            else:
                entries.append(
                    NormalExpenseEntry(
                        excel_row=row.excel_row,
                        spent_at=row.spent_at,
                        amount=row.amount,
                        name=row.name,
                        category_name=row.category_name,
                        currency=row.currency,
                        note=row.note,
                    )
                )
            index += 1
            continue

        child_rows: list[SourceRow] = []
        lookahead = index + 1
        while lookahead < len(rows) and rows[lookahead].spent_at is None:
            child_rows.append(rows[lookahead])
            lookahead += 1
        if not child_rows:
            issues.append(
                ValidationIssue(
                    excel_row=row.excel_row,
                    message="top-level row with blank category must be followed by at least one child row",
                )
            )
            index += 1
            continue

        children: list[ChildExpense] = []
        for child in child_rows:
            if not child.category_name:
                issues.append(
                    ValidationIssue(
                        excel_row=child.excel_row,
                        message="merged child row must have a category name",
                    )
                )
                continue
            category = categories_by_name.get(child.category_name)
            if category is None:
                issues.append(
                    ValidationIssue(
                        excel_row=child.excel_row,
                        message=f'category "{child.category_name}" does not exist in target account book',
                    )
                )
                continue
            if category.is_merge_category:
                issues.append(
                    ValidationIssue(
                        excel_row=child.excel_row,
                        message=f'merged child row cannot use merge category "{child.category_name}"',
                    )
                )
                continue
            if child.currency_explicit and child.currency != row.currency:
                issues.append(
                    ValidationIssue(
                        excel_row=child.excel_row,
                        message=(
                            "merged child row currency must be blank/default or equal to parent currency "
                            f"({row.currency}), got {child.currency}"
                        ),
                    )
                )
                continue
            children.append(
                ChildExpense(
                    excel_row=child.excel_row,
                    amount=child.amount,
                    name=child.name,
                    category_name=child.category_name,
                    note=child.note,
                )
            )

        if len(children) == len(child_rows):
            entries.append(
                MergedExpenseEntry(
                    excel_row=row.excel_row,
                    spent_at=row.spent_at,
                    total_amount=row.amount,
                    name=row.name,
                    currency=row.currency,
                    note=row.note,
                    children=children,
                )
            )
        index = lookahead

    return entries, issues


def parse_excel_date(value: Any, excel_row: int) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    if text == "":
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
        raise ValueError("日期 must be Excel date or YYYY-MM-DD/YYYY/MM/DD string")


def parse_excel_amount(value: Any, excel_row: int) -> str:
    if value is None or str(value).strip() == "":
        raise ValueError("消费数额 is required")
    try:
        amount = Decimal(str(value).strip())
    except InvalidOperation as exc:
        raise ValueError("消费数额 must be numeric") from exc
    if amount <= 0:
        raise ValueError("消费数额 must be greater than 0")
    if amount.as_tuple().exponent < -2:
        raise ValueError("消费数额 must have at most 2 decimal places")
    normalized = amount.quantize(Decimal("0.01"))
    return f"{normalized:.2f}"


def parse_required_text(value: Any, excel_row: int, column_name: str) -> str:
    text = parse_optional_text(value)
    if not text:
        raise ValueError(f"{column_name} is required")
    return text


def parse_optional_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def parse_currency(value: Any, excel_row: int) -> tuple[str, bool]:
    raw = parse_optional_text(value) or ""
    normalized = _CURRENCY_ALIASES.get(raw)
    if normalized is None:
        raise ValueError(
            f'币种 "{raw}" is unsupported. Allowed values are blank, 日元, 人民币, 美元, JPY, CNY, USD'
        )
    return normalized, raw != ""


def print_check_summary(result: CheckResult) -> None:
    print("Check passed.")
    print(f"Normal expenses : {result.normal_count}")
    print(f"Merged expenses : {result.merged_count}")
    print(f"Merged children : {result.merged_child_count}")
    print(f"Total API writes: {result.normal_count + result.merged_count}")


def print_validation_failed(exc: ValidationFailed) -> None:
    print(f"Check failed with {len(exc.issues)} issue(s):")
    for issue in sorted(exc.issues, key=lambda item: item.excel_row):
        print(f"  row {issue.excel_row}: {issue.message}")
