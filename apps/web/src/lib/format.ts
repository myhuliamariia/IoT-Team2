export function formatDateTime(value: string | null): string {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatRelative(value: string | null): string {
  if (!value) {
    return "No data yet";
  }

  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.round(diffMs / 60_000);

  if (diffMinutes < 1) {
    return "just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  return `${diffHours} h ago`;
}

export function formatTemperature(value: number | null | undefined): string {
  return value === null || value === undefined ? "No data" : `${value.toFixed(1)} °C`;
}

export function formatHumidity(value: number | null | undefined): string {
  return value === null || value === undefined ? "No data" : `${value.toFixed(1)} %`;
}

export function formatAcceleration(value: number | null | undefined): string {
  return value === null || value === undefined ? "No data" : `${value.toFixed(2)} g`;
}
