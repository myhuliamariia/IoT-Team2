import type { ReactNode } from "react";

export function MetricCard(props: {
  eyebrow: string;
  value: string;
  hint: string;
  accent?: "teal" | "amber" | "rose" | "slate";
  extra?: ReactNode;
}) {
  return (
    <article className={`metric-card metric-${props.accent ?? "slate"}`}>
      <div className="metric-eyebrow">{props.eyebrow}</div>
      <div className="metric-value">{props.value}</div>
      <div className="metric-hint">{props.hint}</div>
      {props.extra ? <div className="metric-extra">{props.extra}</div> : null}
    </article>
  );
}
