import type { CompletionFunnel as Funnel } from "@reanit/core/analytics";
import { useFormatter, useTranslations } from "next-intl";

/** The funnel's stages, widest first. */
const STAGES = ["enrolled", "started", "halfway", "completed"] as const;

/**
 * How far the range's new students got through their courses, as horizontal bars sized against
 * everyone who enrolled. Every bar carries its count and share, so the figures never depend on reading lengths.
 *
 * @param props - Component props.
 * @param props.funnel - The counts per stage.
 * @returns The titled list of stages.
 */
export function CompletionFunnel({ funnel }: { funnel: Funnel }) {
  const t = useTranslations("Analytics");
  const format = useFormatter();

  return (
    <section aria-labelledby="completion-funnel" className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div>
        <h2 id="completion-funnel" className="text-sm font-medium">
          {t("funnelTitle")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("funnelHint")}</p>
      </div>
      <ol className="flex flex-col gap-3">
        {STAGES.map((stage) => {
          const share = funnel.enrolled === 0 ? 0 : funnel[stage] / funnel.enrolled;
          return (
            <li key={stage} className="flex flex-col gap-1">
              <p className="flex items-baseline justify-between gap-3 text-sm">
                <span>{t(`stages.${stage}`)}</span>
                <span className="tabular-nums">
                  <strong className="font-semibold">{format.number(funnel[stage])}</strong>{" "}
                  <span className="text-xs text-muted-foreground">{t("ofEnrolled", { percent: format.number(share, { style: "percent", maximumFractionDigits: 0 }) })}</span>
                </span>
              </p>
              <div className="h-2 rounded-full bg-muted" aria-hidden>
                <div className="h-2 rounded-full bg-chart" style={{ width: `${share * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
