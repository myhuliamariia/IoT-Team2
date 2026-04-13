import type { ReactNode } from "react";

export function MetricCard(props: {
  eyebrow: string;
  value: string;
  hint: string;
  accent?: "teal" | "amber" | "rose" | "slate";
  extra?: ReactNode;
}) {
  const longValue = props.value.length > 18;

  return (
    <article className={`metric-card metric-${props.accent ?? "slate"}`}>
      <div className="metric-eyebrow">{props.eyebrow}</div>
      <div className={`metric-value ${longValue ? "metric-value-compact" : ""}`} title={props.value}>
        {props.value}
      </div>
      <div className="metric-hint" title={props.hint}>
        {props.hint}
      </div>
      {props.extra ? <div className="metric-extra">{props.extra}</div> : null}
    </article>
  );
}
