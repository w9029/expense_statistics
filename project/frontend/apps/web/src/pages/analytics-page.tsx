import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";
import type { ExpenseCategory, SpendingTrendPoint } from "@expense-statistics/domain";
import { useAuth } from "@/features/auth/auth-context";
import { useI18n } from "@/features/i18n/i18n-context";
import {
  countInclusiveDays,
  countInclusiveMonths,
  createDefaultDayTrendRange,
  createDefaultMonthTrendRange,
  createPrevious30DayRange,
  type DayRangePreset,
  type MonthRangePreset,
  type TrendBucket,
} from "@/lib/analytics";
import { apiClient } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api-errors";
import { normalizeSelectedIDsForQuery } from "@/lib/category-filters";
import { formatMoney } from "@/lib/ledger";

type DayRange = {
  dateFrom: string;
  dateTo: string;
};

type MonthRange = {
  dateFrom: string;
  dateTo: string;
};

export function AnalyticsPage() {
  const { accountBookId } = useParams();
  const auth = useAuth();
  const { t } = useI18n();
  const [bucket, setBucket] = useState<TrendBucket>("day");
  const [dayRange, setDayRange] = useState<DayRange>(createDefaultDayTrendRange);
  const [monthRange, setMonthRange] = useState<MonthRange>(createDefaultMonthTrendRange);
  const [dayPreset, setDayPreset] = useState<DayRangePreset>("last30");
  const [monthPreset, setMonthPreset] = useState<MonthRangePreset>("last12");
  const [categoryIDs, setCategoryIDs] = useState<string[]>([]);

  const copy = {
    title: t("analytics.title"),
    description: t("analytics.description"),
    trendTitle: t("analytics.trendTitle"),
    trendDescription: t("analytics.trendDescription"),
    day: t("analytics.day"),
    month: t("analytics.month"),
    from: t("analytics.from"),
    to: t("analytics.to"),
    total: t("analytics.total"),
    loading: t("analytics.loading"),
    loadFailed: t("analytics.loadFailed"),
    empty: t("analytics.empty"),
    dayHint: t("analytics.dayHint"),
    monthHint: t("analytics.monthHint"),
    invalidDayRange: t("analytics.invalidDayRange"),
    invalidMonthRange: t("analytics.invalidMonthRange"),
    categories: t("book.categories"),
    clearCategories: t("book.clearCategories"),
    dateRange: t("book.dateRange"),
    last30Days: t("book.last30Days"),
    previous30Days: t("book.previous30Days"),
    last12Months: t("analytics.last12Months"),
  };

  const bookQuery = useQuery({
    queryKey: ["account-book", accountBookId],
    queryFn: () => apiClient.getAccountBook(auth.accessToken!, accountBookId!),
    enabled: Boolean(auth.accessToken && accountBookId),
  });

  const categoriesQuery = useQuery({
    queryKey: ["account-book-expense-categories", accountBookId],
    queryFn: () => apiClient.listExpenseCategories(auth.accessToken!, accountBookId!),
    enabled: Boolean(auth.accessToken && accountBookId),
  });

  const activeRange = bucket === "day" ? dayRange : monthRange;
  const availableCategoryIDs = (categoriesQuery.data ?? []).map((category) => category.id);
  const effectiveCategoryIDs = normalizeSelectedIDsForQuery(categoryIDs, availableCategoryIDs);
  const rangeError =
    bucket === "day"
      ? validateDayRange(dayRange, copy.invalidDayRange)
      : validateMonthRange(monthRange, copy.invalidMonthRange);

  const trendQuery = useQuery({
    queryKey: [
      "account-book-spending-trend",
      accountBookId,
      bucket,
      activeRange,
      effectiveCategoryIDs ?? [],
    ],
    queryFn: () =>
      apiClient.getSpendingTrend(auth.accessToken!, accountBookId!, {
        bucket,
        date_from: activeRange.dateFrom,
        date_to: activeRange.dateTo,
        category_ids: effectiveCategoryIDs,
      }),
    enabled: Boolean(auth.accessToken && accountBookId && !rangeError),
  });

  function toggleCategory(categoryID: string) {
    setCategoryIDs((current) =>
      current.includes(categoryID)
        ? current.filter((id) => id !== categoryID)
        : [...current, categoryID],
    );
  }

  function clearCategoryFilters() {
    setCategoryIDs([]);
  }

  function applyDayPreset(nextPreset: Exclude<DayRangePreset, null>) {
    setDayPreset(nextPreset);
    setDayRange(nextPreset === "last30" ? createDefaultDayTrendRange() : createPrevious30DayRange());
  }

  function applyMonthPreset(nextPreset: Exclude<MonthRangePreset, null>) {
    setMonthPreset(nextPreset);
    if (nextPreset === "last12") {
      setMonthRange(createDefaultMonthTrendRange());
    }
  }

  return (
    <section className="stack stack-tight">
      <header className="page-header page-header-compact">
        <div className="stack-sm">
          <h1>{copy.title}</h1>
          <p className="page-subtext">{copy.description}</p>
        </div>
      </header>

      <article className="detail-card">
        <div className="compact-header-row analytics-card-header">
          <div>
            <h3>{copy.trendTitle}</h3>
            <p>{bucket === "day" ? copy.dayHint : copy.monthHint}</p>
          </div>
          <span className="badge badge-tight">
            {copy.total}{" "}
            {formatMoney(
              trendQuery.data?.total_converted_amount ?? "0.00",
              bookQuery.data?.base_currency ?? "JPY",
            )}
          </span>
        </div>

        <p className="list-note" style={{ marginBottom: 12 }}>
          {copy.trendDescription}
        </p>

        <div className="analytics-controls">
          <div className="inline-radio-group">
            <label className="radio-chip">
              <input
                checked={bucket === "day"}
                name="analytics-bucket"
                onChange={() => setBucket("day")}
                type="radio"
              />
              <span>{copy.day}</span>
            </label>
            <label className="radio-chip">
              <input
                checked={bucket === "month"}
                name="analytics-bucket"
                onChange={() => setBucket("month")}
                type="radio"
              />
              <span>{copy.month}</span>
            </label>
          </div>

          {bucket === "day" ? (
            <div className="analytics-date-row">
              <div className="field field-compact">
                <label htmlFor="analytics-day-from">{copy.from}</label>
                <input
                  id="analytics-day-from"
                  onChange={(event) => {
                    setDayPreset(null);
                    setDayRange((current) => ({ ...current, dateFrom: event.target.value }));
                  }}
                  type="date"
                  value={dayRange.dateFrom}
                />
              </div>
              <div className="field field-compact">
                <label htmlFor="analytics-day-to">{copy.to}</label>
                <input
                  id="analytics-day-to"
                  onChange={(event) => {
                    setDayPreset(null);
                    setDayRange((current) => ({ ...current, dateTo: event.target.value }));
                  }}
                  type="date"
                  value={dayRange.dateTo}
                />
              </div>
            </div>
          ) : (
            <div className="analytics-date-row">
              <div className="field field-compact">
                <label htmlFor="analytics-month-from">{copy.from}</label>
                <input
                  id="analytics-month-from"
                  onChange={(event) => {
                    setMonthPreset(null);
                    setMonthRange((current) => ({ ...current, dateFrom: event.target.value }));
                  }}
                  type="month"
                  value={monthRange.dateFrom}
                />
              </div>
              <div className="field field-compact">
                <label htmlFor="analytics-month-to">{copy.to}</label>
                <input
                  id="analytics-month-to"
                  onChange={(event) => {
                    setMonthPreset(null);
                    setMonthRange((current) => ({ ...current, dateTo: event.target.value }));
                  }}
                  type="month"
                  value={monthRange.dateTo}
                />
              </div>
            </div>
          )}

          <div className="field field-compact analytics-preset-field">
            <label>{copy.dateRange}</label>
            <div className="inline-radio-group">
              {bucket === "day" ? (
                <>
                  <label className="radio-chip">
                    <input
                      checked={dayPreset === "last30"}
                      name="analytics-date-preset-day"
                      onChange={() => applyDayPreset("last30")}
                      type="radio"
                    />
                    <span>{copy.last30Days}</span>
                  </label>
                  <label className="radio-chip">
                    <input
                      checked={dayPreset === "previous30"}
                      name="analytics-date-preset-day"
                      onChange={() => applyDayPreset("previous30")}
                      type="radio"
                    />
                    <span>{copy.previous30Days}</span>
                  </label>
                </>
              ) : (
                <label className="radio-chip">
                  <input
                    checked={monthPreset === "last12"}
                    name="analytics-date-preset-month"
                    onChange={() => applyMonthPreset("last12")}
                    type="radio"
                  />
                  <span>{copy.last12Months}</span>
                </label>
              )}
            </div>
          </div>

          <div className="stack-sm">
            <div className="helper-row">
              <strong>{copy.categories}</strong>
              <button
                className="button button-xs"
                disabled={categoryIDs.length === 0}
                onClick={clearCategoryFilters}
                type="button"
              >
                {copy.clearCategories}
              </button>
            </div>

            <div className="pill-checklist">
              {(categoriesQuery.data ?? []).map((category: ExpenseCategory) => {
                const active = categoryIDs.includes(category.id);

                return (
                  <button
                    className={`checkbox-pill checkbox-pill-compact${active ? " active" : ""}`}
                    key={category.id}
                    onClick={() => toggleCategory(category.id)}
                    type="button"
                  >
                    <span
                      className="color-swatch color-swatch-lg"
                      style={{ backgroundColor: category.color }}
                    />
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {rangeError ? <div className="info-banner compact-banner">{rangeError}</div> : null}
        {trendQuery.isLoading ? <div className="info-banner compact-banner">{copy.loading}</div> : null}
        {trendQuery.isError ? (
          <div className="error-banner compact-banner">
            {getApiErrorMessage(trendQuery.error, copy.loadFailed)}
          </div>
        ) : null}

        {trendQuery.isSuccess && trendQuery.data.items.length === 0 ? (
          <div className="empty-state analytics-empty-state">{copy.empty}</div>
        ) : null}

        {trendQuery.data?.items.length ? (
          <SpendingTrendChart
            baseCurrency={bookQuery.data?.base_currency ?? "JPY"}
            bucket={bucket}
            items={trendQuery.data.items}
          />
        ) : null}
      </article>
    </section>
  );
}

function validateDayRange(range: DayRange, message: string) {
  if (!range.dateFrom || !range.dateTo) {
    return null;
  }
  if (range.dateFrom > range.dateTo) {
    return message;
  }
  if (countInclusiveDays(range.dateFrom, range.dateTo) > 60) {
    return message;
  }
  return null;
}

function validateMonthRange(range: MonthRange, message: string) {
  if (!range.dateFrom || !range.dateTo) {
    return null;
  }
  if (range.dateFrom > range.dateTo) {
    return message;
  }
  if (countInclusiveMonths(range.dateFrom, range.dateTo) > 24) {
    return message;
  }
  return null;
}

function SpendingTrendChart(props: {
  items: SpendingTrendPoint[];
  bucket: TrendBucket;
  baseCurrency: string;
}) {
  const width = 820;
  const height = 248;
  const left = 108;
  const right = 18;
  const top = 14;
  const bottom = 34;
  const values = props.items.map((item) => Number(item.total_converted_amount));
  const maxValue = Math.max(...values, 0);
  const usableWidth = width - left - right;
  const usableHeight = height - top - bottom;

  const points = props.items.map((item, index) => {
    const x =
      props.items.length === 1
        ? left + usableWidth / 2
        : left + (usableWidth * index) / Math.max(props.items.length - 1, 1);
    const ratio = maxValue > 0 ? Number(item.total_converted_amount) / maxValue : 0;
    const y = top + usableHeight - ratio * usableHeight;
    return { x, y, item };
  });

  const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const yTicks = createYTicks(maxValue, props.baseCurrency);
  const xTickIndexes = createXTickIndexes(props.items.length);

  return (
    <div className="trend-chart-shell">
      <svg className="trend-chart" role="img" viewBox={`0 0 ${width} ${height}`}>
        {yTicks.map((tick) => (
          <g key={tick.value}>
            <line
              className="trend-grid-line"
              x1={left}
              x2={width - right}
              y1={tick.y}
              y2={tick.y}
            />
            <text
              className="trend-axis-label trend-axis-label-y"
              textAnchor="end"
              x={left - 12}
              y={tick.y + 4}
            >
              {tick.label}
            </text>
          </g>
        ))}

        <polyline
          className="trend-line-fill"
          points={`${left},${top + usableHeight} ${polylinePoints} ${width - right},${top + usableHeight}`}
        />
        <polyline className="trend-line" points={polylinePoints} />

        {points.map((point) => (
          <g key={`${point.item.bucket}-${point.x}`}>
            <circle
              className="trend-point-hitbox"
              cx={point.x}
              cy={point.y}
              r={12}
            />
            <circle
              className="trend-point"
              cx={point.x}
              cy={point.y}
              r={4}
            >
              <title>
                {`${formatTrendBucketLabel(point.item.bucket, props.bucket)}: ${formatMoney(point.item.total_converted_amount, props.baseCurrency)}`}
              </title>
            </circle>
          </g>
        ))}

        {xTickIndexes.map((index) => {
          const point = points[index];
          if (!point) {
            return null;
          }

          return (
            <text
              className="trend-axis-label"
              key={`label-${point.item.bucket}`}
              textAnchor="middle"
              x={point.x}
              y={height - 10}
            >
              {formatTrendBucketLabel(point.item.bucket, props.bucket)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function createYTicks(maxValue: number, currency: string) {
  const tickCount = 4;
  const safeMax = maxValue > 0 ? maxValue : 1;
  const chartTop = 14;
  const chartBottom = 34;
  const chartHeight = 248;

  return Array.from({ length: tickCount + 1 }, (_, index) => {
    const value = (safeMax / tickCount) * index;
    const ratio = value / safeMax;
    const y =
      chartTop +
      (chartHeight - chartTop - chartBottom) -
      ratio * (chartHeight - chartTop - chartBottom);
    return {
      value,
      y,
      label: formatAxisAmount(value, currency),
    };
  }).reverse();
}

function createXTickIndexes(length: number) {
  if (length <= 1) {
    return [0];
  }
  if (length <= 4) {
    return Array.from({ length }, (_, index) => index);
  }

  const last = length - 1;
  const middle = Math.floor(last / 2);
  const quarter = Math.floor(last / 4);
  const threeQuarter = Math.floor((last * 3) / 4);

  return Array.from(new Set([0, quarter, middle, threeQuarter, last]));
}

function formatTrendBucketLabel(value: string, bucket: TrendBucket) {
  if (bucket === "month") {
    return value;
  }
  return value.slice(5);
}

function formatAxisAmount(value: number, currency: string) {
  const compact = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);

  return `${currency} ${compact}`;
}
