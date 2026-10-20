"use client";

import { moneyFormat, type Currency } from "@reanit/core/commerce";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";
import type * as React from "react";

import { useMoney } from "@/i18n/format";

import { niceTicks } from "./chart-scale";
import { Cell, DataTable, RowHeader } from "./data-table";

/** One day of a currency's sales. */
export type DayRevenue = { day: Date; amount: number; sales: number };

/** The plot's size in viewBox units; it scales to the card's width. */
const WIDTH = 640;
const HEIGHT = 200;
const MARGIN = { top: 8, right: 8, bottom: 24, left: 56 } as const;
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;
/** Widest a column is drawn; the rest of its band is air. */
const MAX_BAR = 24;
/** Surface gap between neighboring columns. */
const BAR_GAP = 2;
/** Rounding of a column's data end; its baseline stays square. */
const BAR_RADIUS = 4;
/** Days are shown in UTC, as the report counts them. */
const UTC = "UTC";

/**
 * Draws a column that grows from the baseline, with its top corners rounded when it is wide enough.
 *
 * @param x - Left edge.
 * @param width - Column width.
 * @param height - Column height.
 * @returns The SVG path.
 */
function columnPath(x: number, width: number, height: number): string {
  const baseline = MARGIN.top + PLOT_HEIGHT;
  const radius = Math.min(BAR_RADIUS, width / 2, height);
  const top = baseline - height;
  return `M${x},${baseline}V${top + radius}Q${x},${top} ${x + radius},${top}H${x + width - radius}Q${x + width},${top} ${x + width},${top + radius}V${baseline}Z`;
}

/**
 * Revenue per day in one currency as columns, with a tooltip on hover and keyboard focus (arrow keys move
 * between days) and a table of the same figures. One series, so no legend: the title names it.
 *
 * @param props - Component props.
 * @param props.currency - The currency the figures are in.
 * @param props.days - Every day of the range, oldest first, zeros included.
 * @returns The titled chart with its table view.
 */
export function DailyRevenueChart({ currency, days }: { currency: Currency; days: DayRevenue[] }) {
  const t = useTranslations("Analytics");
  const format = useFormatter();
  const money = useMoney();
  const tooltipId = useId();
  const [active, setActive] = useState<number | null>(null);

  const values = days.map((day) => moneyFormat(day.amount, currency).value);
  const ticks = niceTicks(Math.max(0, ...values));
  const top = ticks.at(-1) ?? 1;
  const band = PLOT_WIDTH / Math.max(days.length, 1);
  const barWidth = band > BAR_GAP * 2 ? Math.min(MAX_BAR, band - BAR_GAP) : band;
  /**
   * Places a value on the y axis.
   *
   * @param value - Major units.
   * @returns Its y coordinate.
   */
  const yOf = (value: number) => MARGIN.top + PLOT_HEIGHT - (value / top) * PLOT_HEIGHT;
  /**
   * Names a day the way the axis and tooltip show it.
   *
   * @param day - The day.
   * @returns Its short date.
   */
  const dayLabel = (day: Date) => format.dateTime(day, { month: "short", day: "numeric", timeZone: UTC });
  /**
   * Formats an axis value compactly in the currency (1K, 2M).
   *
   * @param value - Major units.
   * @returns The tick label.
   */
  const tickLabel = (value: number) => format.number(value, { ...moneyFormat(0, currency).options, notation: "compact", minimumFractionDigits: 0, maximumFractionDigits: 1 });
  const activeDay = active === null ? undefined : days[active];
  const [first] = days;
  const last = days.at(-1);
  const title = t("dailyTitle", { currency });

  /**
   * Moves the tooltip between days with the arrow keys.
   *
   * @param event - The key press on the chart.
   */
  function onKeyDown(event: React.KeyboardEvent<SVGSVGElement>) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    setActive((current) => Math.min(days.length - 1, Math.max(0, (current ?? (step > 0 ? -1 : days.length)) + step)));
  }

  return (
    <figure className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <figcaption className="text-sm font-medium">{title}</figcaption>
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full rounded-md focus-visible:outline-2 focus-visible:outline-ring"
          role="img"
          aria-label={title}
          aria-describedby={activeDay ? tooltipId : undefined}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={yOf(tick)} y2={yOf(tick)} className="stroke-border" strokeWidth={1} />
              <text x={MARGIN.left - 8} y={yOf(tick)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                {tickLabel(tick)}
              </text>
            </g>
          ))}
          {days.map((day, index) => {
            const x = MARGIN.left + index * band + (band - barWidth) / 2;
            const height = ((values[index] ?? 0) / top) * PLOT_HEIGHT;
            return (
              <g key={day.day.toISOString()} onPointerEnter={() => setActive(index)}>
                {/* The whole band is the hit target, not just the painted column. */}
                <rect x={MARGIN.left + index * band} y={MARGIN.top} width={band} height={PLOT_HEIGHT} fill="transparent" />
                {height > 0 ? <path d={columnPath(x, barWidth, height)} className={active === index ? "fill-chart/80" : "fill-chart"} /> : null}
              </g>
            );
          })}
          {first && last ? (
            <>
              <text x={MARGIN.left} y={HEIGHT - 6} className="fill-muted-foreground text-[11px]">
                {dayLabel(first.day)}
              </text>
              <text x={WIDTH - MARGIN.right} y={HEIGHT - 6} textAnchor="end" className="fill-muted-foreground text-[11px]">
                {dayLabel(last.day)}
              </text>
            </>
          ) : null}
        </svg>
        {activeDay && active !== null ? (
          <p
            id={tooltipId}
            role="status"
            className="pointer-events-none absolute top-0 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm"
            style={{ left: `${((MARGIN.left + (active + 0.5) * band) / WIDTH) * 100}%`, transform: "translateX(-50%)" }}
          >
            <strong className="font-semibold">{money(activeDay.amount, currency)}</strong>{" "}
            <span className="text-muted-foreground">
              {t("tooltip", { day: dayLabel(activeDay.day), count: activeDay.sales })}
            </span>
          </p>
        ) : null}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{t("showTable")}</summary>
        <div className="mt-3">
          <DataTable caption={title} columns={[{ label: t("day") }, { label: t("amount"), isNumeric: true }, { label: t("orders"), isNumeric: true }]}>
            {days.map((day) => (
              <tr key={day.day.toISOString()}>
                <RowHeader>{dayLabel(day.day)}</RowHeader>
                <Cell isNumeric>{money(day.amount, currency)}</Cell>
                <Cell isNumeric>{format.number(day.sales)}</Cell>
              </tr>
            ))}
          </DataTable>
        </div>
      </details>
    </figure>
  );
}
