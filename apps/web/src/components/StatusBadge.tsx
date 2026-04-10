type StatusTone = "good" | "warning" | "danger" | "muted";

const toneMap: Record<StatusTone, string> = {
  good: "badge badge-good",
  warning: "badge badge-warning",
  danger: "badge badge-danger",
  muted: "badge badge-muted"
};

export function StatusBadge(props: { label: string; tone: StatusTone }) {
  return <span className={toneMap[props.tone]}>{props.label}</span>;
}
