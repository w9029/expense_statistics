import {useEffect, useMemo, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {GestureResponderEvent} from 'react-native';
import {useIsFocused} from '@react-navigation/native';
import Svg, {Circle, G, Line, Path} from 'react-native-svg';
import type {
  AccountBookDetail,
  CategoryShareItem,
  ExpenseCategory,
  SpendingTrendPoint,
} from '@expense-statistics/domain';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import {ActionButton} from '@/components/action-button';
import {DateField} from '@/components/date-field';
import {FormField} from '@/components/form-field';
import {InlineBanner} from '@/components/inline-banner';
import {PlaceholderCard} from '@/components/placeholder-card';
import {ScreenShell} from '@/components/screen-shell';
import {SFSymbol} from '@/components/sf-symbol';
import {useBookSession} from '@/features/account-books/book-session-context';
import {useAuth} from '@/features/auth/auth-context';
import {useI18n} from '@/features/i18n/i18n-context';
import {
  countInclusiveDays,
  countInclusiveMonths,
  createDefaultCategoryShareRange,
  createDefaultDayTrendRange,
  createDefaultMonthTrendRange,
  createLast24MonthTrendRange,
  createPrevious30DayRange,
  DayRangePreset,
  MonthRangePreset,
  TrendBucket,
} from '@/lib/analytics';
import {apiClient} from '@/lib/api';
import {getApiErrorMessage} from '@/lib/api-errors';
import {normalizeSelectedIDsForQuery} from '@/lib/category-filters';
import {formatMoney} from '@/lib/ledger';
import type {AppTabParamList} from '@/navigation/types';
import {colors} from '@/theme/colors';

type Props = BottomTabScreenProps<AppTabParamList, 'AnalyticsTab'>;

type DayRange = {
  dateFrom: string;
  dateTo: string;
};

type MonthRange = {
  dateFrom: string;
  dateTo: string;
};

type CategoryShareRange = {
  dateFrom: string;
  dateTo: string;
};

export function AnalyticsPlaceholderScreen({route}: Props) {
  const accountBookId = route.params?.accountBookId ?? '';
  const auth = useAuth();
  const {setActiveAccountBookId} = useBookSession();
  const {t} = useI18n();
  const isFocused = useIsFocused();

  const [bucket, setBucket] = useState<TrendBucket>('day');
  const [dayRange, setDayRange] = useState<DayRange>(() => createDefaultDayTrendRange());
  const [monthRange, setMonthRange] = useState<MonthRange>(() =>
    createDefaultMonthTrendRange(),
  );
  const [shareRange, setShareRange] = useState<CategoryShareRange>(() =>
    createDefaultCategoryShareRange(),
  );
  const [dayPreset, setDayPreset] = useState<DayRangePreset>('last30');
  const [monthPreset, setMonthPreset] = useState<MonthRangePreset>('last12');
  const [sharePreset, setSharePreset] = useState<DayRangePreset>('last30');
  const [categoryIDs, setCategoryIDs] = useState<string[]>([]);
  const [detail, setDetail] = useState<AccountBookDetail | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [trendItems, setTrendItems] = useState<SpendingTrendPoint[]>([]);
  const [trendTotal, setTrendTotal] = useState('0.00');
  const [shareItems, setShareItems] = useState<CategoryShareItem[]>([]);
  const [shareTotal, setShareTotal] = useState('0.00');
  const [pageError, setPageError] = useState<string | null>(null);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isLoadingTrend, setIsLoadingTrend] = useState(false);
  const [isLoadingShare, setIsLoadingShare] = useState(false);
  const [isFilterPanelVisible, setIsFilterPanelVisible] = useState(false);
  const [isTrendGestureActive, setIsTrendGestureActive] = useState(false);

  const availableCategoryIDs = useMemo(
    () => categories.map(category => category.id),
    [categories],
  );
  const effectiveCategoryIDs = useMemo(
    () => normalizeSelectedIDsForQuery(categoryIDs, availableCategoryIDs),
    [categoryIDs, availableCategoryIDs],
  );
  const positiveShareItems = useMemo(
    () => shareItems.filter(item => Number(item.total_converted_amount) > 0),
    [shareItems],
  );

  const trendRangeError = useMemo(() => {
    if (bucket === 'day') {
      return validateDayRange(dayRange, t('analytics.invalidDayRange'));
    }
    return validateMonthRange(monthRange, t('analytics.invalidMonthRange'));
  }, [bucket, dayRange, monthRange, t]);

  useEffect(() => {
    setActiveAccountBookId(accountBookId);
  }, [accountBookId, setActiveAccountBookId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!auth.accessToken || !accountBookId || !isFocused) {
        return;
      }

      setIsLoadingPage(true);
      setPageError(null);
      try {
        const [nextDetail, nextCategories] = await Promise.all([
          apiClient.getAccountBook(auth.accessToken, accountBookId),
          apiClient.listExpenseCategories(auth.accessToken, accountBookId),
        ]);

        if (cancelled) {
          return;
        }

        setDetail(nextDetail);
        setCategories(nextCategories);
      } catch (error) {
        if (!cancelled) {
          setPageError(getApiErrorMessage(error, t('book.loadBookFailed')));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPage(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountBookId, auth.accessToken, isFocused, t]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!auth.accessToken || !accountBookId || !isFocused) {
        return;
      }

      setIsLoadingShare(true);
      setShareError(null);
      try {
        const response = await apiClient.getCategoryShare(
          auth.accessToken,
          accountBookId,
          {
            date_from: shareRange.dateFrom || undefined,
            date_to: shareRange.dateTo || undefined,
          },
        );

        if (cancelled) {
          return;
        }

        setShareItems(response.items);
        setShareTotal(response.total_converted_amount);
      } catch (error) {
        if (!cancelled) {
          setShareError(getApiErrorMessage(error, t('book.categoryShareFailed')));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingShare(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountBookId, auth.accessToken, isFocused, shareRange, t]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!auth.accessToken || !accountBookId || !isFocused || trendRangeError) {
        return;
      }

      const activeRange = bucket === 'day' ? dayRange : monthRange;
      setIsLoadingTrend(true);
      setTrendError(null);
      try {
        const response = await apiClient.getSpendingTrend(
          auth.accessToken,
          accountBookId,
          {
            bucket,
            date_from: activeRange.dateFrom,
            date_to: activeRange.dateTo,
            category_ids: effectiveCategoryIDs,
          },
        );

        if (cancelled) {
          return;
        }

        setTrendItems(response.items);
        setTrendTotal(response.total_converted_amount);
      } catch (error) {
        if (!cancelled) {
          setTrendError(getApiErrorMessage(error, t('analytics.loadFailed')));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTrend(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    accountBookId,
    auth.accessToken,
    bucket,
    dayRange,
    monthRange,
    effectiveCategoryIDs,
    isFocused,
    t,
    trendRangeError,
  ]);

  function applyDayPreset(nextPreset: Exclude<DayRangePreset, null>) {
    setDayPreset(nextPreset);
    setDayRange(
      nextPreset === 'last30'
        ? createDefaultDayTrendRange()
        : createPrevious30DayRange(),
    );
  }

  function applySharePreset(nextPreset: Exclude<DayRangePreset, null>) {
    setSharePreset(nextPreset);
    setShareRange(
      nextPreset === 'last30'
        ? createDefaultCategoryShareRange()
        : createPrevious30DayRange(),
    );
  }

  function applyMonthPreset(nextPreset: Exclude<MonthRangePreset, null>) {
    setMonthPreset(nextPreset);
    if (nextPreset === 'last12') {
      setMonthRange(createDefaultMonthTrendRange());
      return;
    }
    setMonthRange(createLast24MonthTrendRange());
  }

  function toggleCategory(categoryID: string) {
    setCategoryIDs(current =>
      current.includes(categoryID)
        ? current.filter(id => id !== categoryID)
        : [...current, categoryID],
    );
  }

  function clearCategoryFilters() {
    setCategoryIDs([]);
  }

  if (!accountBookId) {
    return (
      <ScreenShell title={t('nav.analytics')} description={t('accountBooks.description')}>
        <PlaceholderCard title={t('nav.analytics')}>
          <InlineBanner message={t('accountBooks.empty')} tone="info" />
        </PlaceholderCard>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      hideHero
      scrollEnabled={!isTrendGestureActive}
      title={t('analytics.title')}>
      <PlaceholderCard
        title={t('analytics.title')}
        description={t('analytics.description')}>
        <View style={styles.metaStrip}>
          <Text style={styles.metaChip}>
            {t('book.titleFallback')}: {detail?.name ?? '-'}
          </Text>
          <Text style={styles.metaChip}>
            {t('book.baseLabel')}: {detail?.base_currency ?? '-'}
          </Text>
          <Text style={styles.metaChip}>
            {t('book.categoriesLabel')}: {categories.length}
          </Text>
        </View>
      </PlaceholderCard>

      {isLoadingPage ? <InlineBanner message={t('book.loadingBook')} tone="info" /> : null}
      {pageError ? <InlineBanner message={pageError} tone="error" /> : null}

      <PlaceholderCard
        title={t('book.categoryShareTitle')}
        description={t('book.categoryShareDescription')}>
        <Text style={styles.totalBadge}>
          {t('book.categoryShareTotal')} {formatMoney(shareTotal, detail?.base_currency ?? 'JPY')}
        </Text>

        <View style={styles.inlineRow}>
          <View style={styles.flexField}>
            <FormField label={t('book.categoryShareDateFrom')}>
              <DateField
                onDateChange={event => {
                  setSharePreset(null);
                  setShareRange(current => ({
                    ...current,
                    dateFrom: event.nativeEvent.value,
                  }));
                }}
                placeholder={t('book.categoryShareDateFrom')}
                style={styles.dateInput}
                value={shareRange.dateFrom}
              />
            </FormField>
          </View>
          <View style={styles.flexField}>
            <FormField label={t('book.categoryShareDateTo')}>
              <DateField
                onDateChange={event => {
                  setSharePreset(null);
                  setShareRange(current => ({
                    ...current,
                    dateTo: event.nativeEvent.value,
                  }));
                }}
                placeholder={t('book.categoryShareDateTo')}
                style={styles.dateInput}
                value={shareRange.dateTo}
              />
            </FormField>
          </View>
        </View>

        <View style={styles.presetRow}>
          <ActionButton
            label={t('book.last30Days')}
            onPress={() => applySharePreset('last30')}
            style={styles.presetButton}
            tone={sharePreset === 'last30' ? 'primary' : 'secondary'}
          />
          <ActionButton
            label={t('book.previous30Days')}
            onPress={() => applySharePreset('previous30')}
            style={styles.presetButton}
            tone={sharePreset === 'previous30' ? 'primary' : 'secondary'}
          />
        </View>

        {isLoadingShare ? (
          <InlineBanner message={t('book.categoryShareLoading')} tone="info" />
        ) : null}
        {shareError ? <InlineBanner message={shareError} tone="error" /> : null}
        {!isLoadingShare && !positiveShareItems.length ? (
          <InlineBanner message={t('book.categoryShareEmpty')} tone="info" />
        ) : null}

        {positiveShareItems.length ? (
          <>
            <CategorySharePieChart
              baseCurrency={detail?.base_currency ?? 'JPY'}
              items={positiveShareItems}
              title={t('analytics.shareChartTitle')}
              total={shareTotal}
            />
            <View style={styles.shareList}>
              {positiveShareItems.map(item => (
                <View key={item.category_id} style={styles.shareCard}>
                  <View style={styles.shareRow}>
                    <View style={styles.shareLabelWrap}>
                      <View
                        style={[
                          styles.shareSwatch,
                          {backgroundColor: item.category_color},
                        ]}
                      />
                      <Text style={styles.shareName}>{item.category_name}</Text>
                    </View>
                    <Text style={styles.sharePercent}>
                      {item.percentage.toFixed(1)}%
                    </Text>
                  </View>
                  <View style={styles.shareBarTrack}>
                    <View
                      style={[
                        styles.shareBarFill,
                        {
                          backgroundColor: item.category_color,
                          width: `${Math.max(item.percentage, 3)}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.shareAmount}>
                    {formatMoney(item.total_converted_amount, detail?.base_currency ?? 'JPY')}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </PlaceholderCard>

      <PlaceholderCard
        title={t('analytics.trendTitle')}
        description={t('analytics.trendDescription')}>
        <View style={styles.trendHeaderRow}>
          <Text style={styles.totalBadge}>
            {t('analytics.total')} {formatMoney(trendTotal, detail?.base_currency ?? 'JPY')}
          </Text>
          <Pressable
            onPress={() => setIsFilterPanelVisible(current => !current)}
            style={styles.filterToggleButton}>
            <Text style={styles.filterToggleText}>{t('book.filters')}</Text>
            <SFSymbol
              colorHex={colors.accentDeep}
              name={isFilterPanelVisible ? 'chevron.up' : 'chevron.down'}
              pointSize={14}
              style={styles.filterToggleIcon}
              weight="semibold"
            />
          </Pressable>
        </View>

        {isFilterPanelVisible ? (
          <View style={styles.filterPanel}>
            <FormField label={t('analytics.filtersTitle')}>
              <View style={styles.segmentRow}>
                {(['day', 'month'] as TrendBucket[]).map(item => (
                  <Pressable
                    key={item}
                    onPress={() => setBucket(item)}
                    style={[
                      styles.segment,
                      bucket === item ? styles.segmentActive : undefined,
                    ]}>
                    <Text
                      style={[
                        styles.segmentText,
                        bucket === item ? styles.segmentTextActive : undefined,
                      ]}>
                      {item === 'day' ? t('analytics.day') : t('analytics.month')}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </FormField>

            {bucket === 'day' ? (
              <>
                <View style={styles.inlineRow}>
                  <View style={styles.flexField}>
                    <FormField label={t('analytics.from')}>
                      <DateField
                        onDateChange={event => {
                          setDayPreset(null);
                          setDayRange(current => ({
                            ...current,
                            dateFrom: event.nativeEvent.value,
                          }));
                        }}
                        placeholder={t('analytics.from')}
                        style={styles.dateInput}
                        value={dayRange.dateFrom}
                      />
                    </FormField>
                  </View>
                  <View style={styles.flexField}>
                    <FormField label={t('analytics.to')}>
                      <DateField
                        onDateChange={event => {
                          setDayPreset(null);
                          setDayRange(current => ({
                            ...current,
                            dateTo: event.nativeEvent.value,
                          }));
                        }}
                        placeholder={t('analytics.to')}
                        style={styles.dateInput}
                        value={dayRange.dateTo}
                      />
                    </FormField>
                  </View>
                </View>

                <View style={styles.presetRow}>
                  <ActionButton
                    label={t('book.last30Days')}
                    onPress={() => applyDayPreset('last30')}
                    style={styles.presetButton}
                    tone={dayPreset === 'last30' ? 'primary' : 'secondary'}
                  />
                  <ActionButton
                    label={t('book.previous30Days')}
                    onPress={() => applyDayPreset('previous30')}
                    style={styles.presetButton}
                    tone={dayPreset === 'previous30' ? 'primary' : 'secondary'}
                  />
                </View>
              </>
            ) : (
              <>
                <View style={styles.inlineRow}>
                  <View style={styles.flexField}>
                    <FormField label={t('analytics.monthFrom')}>
                      <DateField
                        mode="month"
                        onDateChange={event => {
                          setMonthPreset(null);
                          setMonthRange(current => ({
                            ...current,
                            dateFrom: event.nativeEvent.value,
                          }));
                        }}
                        placeholder={t('analytics.monthFrom')}
                        style={styles.dateInput}
                        value={monthRange.dateFrom}
                      />
                    </FormField>
                  </View>
                  <View style={styles.flexField}>
                    <FormField label={t('analytics.monthTo')}>
                      <DateField
                        mode="month"
                        onDateChange={event => {
                          setMonthPreset(null);
                          setMonthRange(current => ({
                            ...current,
                            dateTo: event.nativeEvent.value,
                          }));
                        }}
                        placeholder={t('analytics.monthTo')}
                        style={styles.dateInput}
                        value={monthRange.dateTo}
                      />
                    </FormField>
                  </View>
                </View>

                <View style={styles.presetRow}>
                  <ActionButton
                    label={t('analytics.last12Months')}
                    onPress={() => applyMonthPreset('last12')}
                    style={styles.presetButton}
                    tone={monthPreset === 'last12' ? 'primary' : 'secondary'}
                  />
                  <ActionButton
                    label={t('analytics.last24Months')}
                    onPress={() => applyMonthPreset('last24')}
                    style={styles.presetButton}
                    tone={monthPreset === 'last24' ? 'primary' : 'secondary'}
                  />
                </View>
              </>
            )}

            <Text style={styles.helperText}>
              {bucket === 'day' ? t('analytics.dayHint') : t('analytics.monthHint')}
            </Text>

            <View style={styles.categoryFilterHeader}>
              <Text style={styles.sectionLabel}>{t('book.categories')}</Text>
              <ActionButton
                disabled={!categoryIDs.length}
                label={t('book.clearCategories')}
                onPress={clearCategoryFilters}
                style={styles.shortAction}
                tone="secondary"
              />
            </View>

            <View style={styles.chipWrap}>
              {categories.map(category => {
                const active = categoryIDs.includes(category.id);
                return (
                  <Pressable
                    key={category.id}
                    onPress={() => toggleCategory(category.id)}
                    style={[
                      styles.categoryChip,
                      active ? styles.categoryChipActive : undefined,
                    ]}>
                    <View style={[styles.colorDot, {backgroundColor: category.color}]} />
                    <Text
                      style={[
                        styles.categoryChipText,
                        active ? styles.categoryChipTextActive : undefined,
                      ]}>
                      {category.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {trendRangeError ? (
          <InlineBanner message={trendRangeError} tone="info" />
        ) : null}
        {isLoadingTrend ? (
          <InlineBanner message={t('analytics.loading')} tone="info" />
        ) : null}
        {trendError ? <InlineBanner message={trendError} tone="error" /> : null}
        {!trendRangeError && !isLoadingTrend && !trendItems.length ? (
          <InlineBanner message={t('analytics.empty')} tone="info" />
        ) : null}

        {trendItems.length ? (
          <TrendLineChart
            baseCurrency={detail?.base_currency ?? 'JPY'}
            bucket={bucket}
            items={trendItems}
            onGestureActiveChange={setIsTrendGestureActive}
            title={t('analytics.trendChartTitle')}
          />
        ) : null}
      </PlaceholderCard>
    </ScreenShell>
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function CategorySharePieChart(props: {
  items: CategoryShareItem[];
  total: string;
  baseCurrency: string;
  title: string;
}) {
  const size = 180;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offsetCursor = 0;

  return (
    <View style={styles.pieShell}>
      <Text style={styles.chartTitle}>{props.title}</Text>
      <View style={styles.pieWrap}>
        <Svg height={size} width={size}>
          <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              fill="transparent"
              r={radius}
              stroke={colors.surfaceMuted}
              strokeWidth={strokeWidth}
            />
            {props.items.map(item => {
              const dash = (item.percentage / 100) * circumference;
              const circle = (
                <Circle
                  key={item.category_id}
                  cx={size / 2}
                  cy={size / 2}
                  fill="transparent"
                  r={radius}
                  stroke={item.category_color}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offsetCursor}
                  strokeLinecap="butt"
                  strokeWidth={strokeWidth}
                />
              );
              offsetCursor += dash;
              return circle;
            })}
          </G>
        </Svg>
        <View style={styles.pieCenter}>
          <Text style={styles.pieCenterLabel}>{props.title}</Text>
          <Text style={styles.pieCenterValue}>
            {formatMoney(props.total, props.baseCurrency)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function TrendLineChart(props: {
  items: SpendingTrendPoint[];
  bucket: TrendBucket;
  baseCurrency: string;
  onGestureActiveChange?: (isActive: boolean) => void;
  title: string;
}) {
  const width = 320;
  const height = 200;
  const bubbleWidth = 156;
  const bubbleHeight = 56;
  const paddingLeft = 18;
  const paddingRight = 18;
  const paddingTop = 16;
  const paddingBottom = 32;
  const longPressDelayMs = 180;
  const verticalTolerance = 64;
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTouchXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const values = props.items.map(item => Number(item.total_converted_amount));
  const maxValue = Math.max(...values, 0);
  const minValue = Math.min(...values, 0);
  const range = Math.max(maxValue - minValue, 1);
  const usableWidth = width - paddingLeft - paddingRight;
  const usableHeight = height - paddingTop - paddingBottom;

  const points = props.items.map((item, index) => {
    const x =
      props.items.length === 1
        ? paddingLeft + usableWidth / 2
        : paddingLeft + (usableWidth * index) / Math.max(props.items.length - 1, 1);
    const value = Number(item.total_converted_amount);
    const normalized = (value - minValue) / range;
    const y = paddingTop + usableHeight - normalized * usableHeight;
    return {x, y, item};
  });

  const pathD = points
    .map((point, index) =>
      `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(' ');

  const tickIndexes =
    props.items.length <= 5
      ? props.items.map((_, index) => index)
      : Array.from(
          new Set([
            0,
            Math.floor((props.items.length - 1) / 3),
            Math.floor(((props.items.length - 1) * 2) / 3),
            props.items.length - 1,
          ]),
        );

  const activePoint = activePointIndex === null ? null : points[activePointIndex] ?? null;
  const bubbleLeft = activePoint
    ? clamp(activePoint.x - bubbleWidth / 2, 4, width - bubbleWidth - 4)
    : 0;
  const bubbleTop = activePoint
    ? clamp(activePoint.y - bubbleHeight - 14, 4, height - bubbleHeight - 4)
    : 0;

  function clearHoldTimer() {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }

  function findNearestPointIndex(locationX: number) {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    points.forEach((point, index) => {
      const distance = Math.abs(point.x - locationX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    return nearestIndex;
  }

  function updateActivePoint(locationX: number) {
    pendingTouchXRef.current = locationX;
    setActivePointIndex(findNearestPointIndex(locationX));
  }

  function beginLongPress(event: GestureResponderEvent) {
    clearHoldTimer();
    props.onGestureActiveChange?.(true);
    pendingTouchXRef.current = event.nativeEvent.locationX;
    touchStartYRef.current = event.nativeEvent.locationY;
    holdTimerRef.current = setTimeout(() => {
      if (pendingTouchXRef.current === null) {
        return;
      }
      updateActivePoint(pendingTouchXRef.current);
    }, longPressDelayMs);
  }

  function handleMove(event: GestureResponderEvent) {
    const nextX = event.nativeEvent.locationX;
    const nextY = event.nativeEvent.locationY;
    pendingTouchXRef.current = nextX;

    if (
      touchStartYRef.current !== null &&
      Math.abs(nextY - touchStartYRef.current) > verticalTolerance
    ) {
      endInteraction();
      return;
    }

    if (activePointIndex !== null) {
      updateActivePoint(nextX);
    }
  }

  function endInteraction() {
    clearHoldTimer();
    pendingTouchXRef.current = null;
    touchStartYRef.current = null;
    setActivePointIndex(null);
    props.onGestureActiveChange?.(false);
  }

  return (
    <View style={styles.lineChartShell}>
      <Text style={styles.chartTitle}>{props.title}</Text>
      <View
        onMoveShouldSetResponder={() => true}
        onResponderGrant={beginLongPress}
        onResponderMove={handleMove}
        onResponderRelease={endInteraction}
        onResponderTerminate={endInteraction}
        onStartShouldSetResponder={() => true}
        style={styles.lineChartCanvas}>
        <Svg height={height} width={width}>
          <Line
            stroke={colors.line}
            strokeWidth={1}
            x1={paddingLeft}
            x2={width - paddingRight}
            y1={paddingTop + usableHeight}
            y2={paddingTop + usableHeight}
          />
          <Line
            stroke={colors.line}
            strokeWidth={1}
            x1={paddingLeft}
            x2={width - paddingRight}
            y1={paddingTop}
            y2={paddingTop}
          />
          <Path
            d={pathD}
            fill="none"
            stroke={colors.accent}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
          />
          {points.map(point => (
            <Circle
              key={point.item.bucket}
              cx={point.x}
              cy={point.y}
              fill={colors.backgroundSoft}
              r={4}
              stroke={colors.accent}
              strokeWidth={2}
            />
          ))}
          {activePoint ? (
            <>
              <Line
                stroke={colors.accentDeep}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                x1={activePoint.x}
                x2={activePoint.x}
                y1={paddingTop}
                y2={paddingTop + usableHeight}
              />
              <Circle
                cx={activePoint.x}
                cy={activePoint.y}
                fill={colors.accent}
                r={6}
                stroke={colors.backgroundSoft}
                strokeWidth={3}
              />
            </>
          ) : null}
        </Svg>

        {activePoint ? (
          <View
            pointerEvents="none"
            style={[
              styles.chartTooltip,
              {
                left: bubbleLeft,
                top: bubbleTop,
                width: bubbleWidth,
              },
            ]}>
            <Text style={styles.chartTooltipDate}>{activePoint.item.bucket}</Text>
            <Text style={styles.chartTooltipAmount}>
              {formatMoney(activePoint.item.total_converted_amount, props.baseCurrency)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.lineAxisLabels}>
        {tickIndexes.map(index => {
          const point = points[index];
          if (!point) {
            return null;
          }
          return (
            <Text key={`${point.item.bucket}-label`} style={styles.lineAxisLabel}>
              {props.bucket === 'month'
                ? point.item.bucket.slice(2)
                : point.item.bucket.slice(5)}
            </Text>
          );
        })}
      </View>

      <View style={styles.lineMetaRow}>
        <Text style={styles.lineMetaText}>
          {formatMoney(String(minValue.toFixed(2)), props.baseCurrency)}
        </Text>
        <Text style={styles.lineMetaText}>
          {formatMoney(String(maxValue.toFixed(2)), props.baseCurrency)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  metaStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    backgroundColor: colors.accentSoftMuted,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.accentDeep,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 12,
  },
  flexField: {
    flex: 1,
  },
  dateInput: {
    minHeight: 52,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 10,
  },
  presetButton: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  totalBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    color: colors.accentDeep,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pieShell: {
    alignItems: 'center',
    gap: 12,
  },
  pieWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieCenter: {
    alignItems: 'center',
    gap: 4,
    position: 'absolute',
  },
  pieCenterLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  pieCenterValue: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  shareList: {
    gap: 10,
  },
  shareCard: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  shareRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shareLabelWrap: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    marginRight: 10,
  },
  shareSwatch: {
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  shareName: {
    color: colors.ink,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  sharePercent: {
    color: colors.accentDeep,
    fontSize: 14,
    fontWeight: '800',
  },
  shareBarTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    height: 10,
    overflow: 'hidden',
  },
  shareBarFill: {
    borderRadius: 999,
    height: '100%',
  },
  shareAmount: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  trendHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filterToggleButton: {
    alignItems: 'center',
    backgroundColor: colors.accentSoftMuted,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterToggleText: {
    color: colors.accentDeep,
    fontSize: 13,
    fontWeight: '700',
  },
  filterToggleIcon: {
    height: 14,
    width: 14,
  },
  filterPanel: {
    gap: 14,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  segmentActive: {
    backgroundColor: colors.accent,
  },
  segmentText: {
    color: colors.accentDeep,
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: colors.backgroundSoft,
  },
  helperText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  categoryFilterHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  shortAction: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  categoryChipActive: {
    backgroundColor: colors.accentSoftMuted,
    borderColor: colors.accentSoft,
  },
  categoryChipText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: colors.accentDeep,
  },
  colorDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  lineChartShell: {
    alignItems: 'center',
    gap: 10,
  },
  lineChartCanvas: {
    height: 200,
    position: 'relative',
    width: 320,
  },
  chartTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  chartTooltip: {
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  chartTooltipDate: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  chartTooltipAmount: {
    color: colors.accentDeep,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  lineAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 320,
  },
  lineAxisLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  lineMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 320,
  },
  lineMetaText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
});
