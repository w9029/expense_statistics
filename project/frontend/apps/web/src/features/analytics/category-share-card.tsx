import { useQuery } from "@tanstack/react-query";
import type { CategoryShareItem } from "@expense-statistics/domain";
import { useState } from "react";
import { useI18n } from "@/features/i18n/i18n-context";
import { createDefaultCategoryShareRange } from "@/lib/analytics";
import { getApiErrorMessage } from "@/lib/api-errors";
import { apiClient } from "@/lib/api";
import { formatMoney } from "@/lib/ledger";

type CategoryShareCardProps = {
  accessToken: string;
  accountBookId: string;
  baseCurrency: string;
};

export function CategoryShareCard(props: CategoryShareCardProps) {
  const { t } = useI18n();
  const [range, setRange] = useState(createDefaultCategoryShareRange);

  const query = useQuery({
    queryKey: ["account-book-category-share", props.accountBookId, range],
    queryFn: () =>
      apiClient.getCategoryShare(props.accessToken, props.accountBookId, {
        date_from: range.dateFrom || undefined,
        date_to: range.dateTo || undefined,
      }),
    enabled: Boolean(props.accessToken && props.accountBookId),
  });

  const copy = {
    title: t("book.categoryShareTitle"),
    description: t("book.categoryShareDescription"),
    dateFrom: t("book.categoryShareDateFrom"),
    dateTo: t("book.categoryShareDateTo"),
    total: t("book.categoryShareTotal"),
    loading: t("book.categoryShareLoading"),
    empty: t("book.categoryShareEmpty"),
    failed: t("book.categoryShareFailed"),
  };

  const chartItems = (query.data?.items ?? []).filter(
    (item) => Number(item.total_converted_amount) > 0,
  );

  return (
    <article className="detail-card compact-card">
      <div className="compact-header-row analytics-card-header">
        <div>
          <h3>{copy.title}</h3>
          <p>{copy.description}</p>
        </div>
        <span className="badge badge-tight">
          {copy.total}{" "}
          {formatMoney(
            query.data?.total_converted_amount ?? "0.00",
            props.baseCurrency,
          )}
        </span>
      </div>

      <div className="analytics-date-row">
        <div className="field field-compact">
          <label htmlFor="category-share-date-from">{copy.dateFrom}</label>
          <input
            id="category-share-date-from"
            onChange={(event) =>
              setRange((current) => ({ ...current, dateFrom: event.target.value }))
            }
            type="date"
            value={range.dateFrom}
          />
        </div>
        <div className="field field-compact">
          <label htmlFor="category-share-date-to">{copy.dateTo}</label>
          <input
            id="category-share-date-to"
            onChange={(event) =>
              setRange((current) => ({ ...current, dateTo: event.target.value }))
            }
            type="date"
            value={range.dateTo}
          />
        </div>
      </div>

      {query.isLoading ? <div className="info-banner compact-banner">{copy.loading}</div> : null}
      {query.isError ? (
        <div className="error-banner compact-banner">
          {getApiErrorMessage(query.error, copy.failed)}
        </div>
      ) : null}

      {query.isSuccess && chartItems.length === 0 ? (
        <div className="empty-state analytics-empty-state">{copy.empty}</div>
      ) : null}

      {chartItems.length > 0 ? (
        <div className="category-share-layout">
          <CategoryShareDonut
            baseCurrency={props.baseCurrency}
            items={chartItems}
            totalAmount={query.data?.total_converted_amount ?? "0.00"}
            totalLabel={copy.total}
          />
          <div className="analytics-legend">
            {chartItems.map((item) => (
              <div className="analytics-legend-item" key={item.category_id}>
                <div className="analytics-legend-main">
                  <span
                    className="color-swatch color-swatch-lg analytics-legend-swatch"
                    style={{ backgroundColor: item.category_color }}
                  />
                  <span className="analytics-legend-name">{item.category_name}</span>
                </div>
                <div className="analytics-legend-values">
                  <strong>{item.percentage.toFixed(1)}%</strong>
                  <span>{formatMoney(item.total_converted_amount, props.baseCurrency)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function CategoryShareDonut(props: {
  items: CategoryShareItem[];
  totalAmount: string;
  totalLabel: string;
  baseCurrency: string;
}) {
  const gradient = buildConicGradient(props.items);

  return (
    <div className="category-share-donut-shell">
      <div
        className="category-share-donut"
        style={{ backgroundImage: gradient }}
      >
        <div className="category-share-donut-center">
          <span>{props.totalLabel}</span>
          <strong>{formatMoney(props.totalAmount, props.baseCurrency)}</strong>
        </div>
      </div>
    </div>
  );
}

function buildConicGradient(items: CategoryShareItem[]) {
  let cursor = 0;
  const stops = items.map((item) => {
    const start = cursor;
    const end = Math.min(100, cursor + item.percentage);
    cursor = end;
    return `${item.category_color} ${start}% ${end}%`;
  });

  if (cursor < 100) {
    stops.push(`rgba(31, 27, 23, 0.08) ${cursor}% 100%`);
  }

  return `conic-gradient(${stops.join(", ")})`;
}
