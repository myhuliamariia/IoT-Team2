import type { TerrariumDetail } from "@biot/shared";
import { formatDateTime } from "../lib/format";
import { StatusBadge } from "./StatusBadge";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  occurredAt: string | null;
  source: "status" | "alert" | "event";
};

function startCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function mapStatusTone(item: NotificationItem["severity"]) {
  if (item === "critical") {
    return "danger" as const;
  }

  if (item === "warning") {
    return "warning" as const;
  }

  return "muted" as const;
}

function buildNotificationItems(detail: TerrariumDetail): NotificationItem[] {
  const items: NotificationItem[] = [];

  if (detail.connectionStatus === "disconnected") {
    items.push({
      id: "status-disconnected",
      title: "Device disconnected",
      message: detail.device
        ? "The linked device is no longer sending fresh telemetry to this terrarium."
        : "This terrarium has no assigned device yet, so no live telemetry is available.",
      severity: "critical",
      occurredAt: detail.device?.lastSeenAt ?? detail.latestReading?.capturedAt ?? null,
      source: "status"
    });
  } else if (detail.connectionStatus === "stale") {
    items.push({
      id: "status-stale",
      title: "Telemetry stale",
      message: "The terrarium is linked, but the latest reading is older than the freshness window.",
      severity: "warning",
      occurredAt: detail.device?.lastSeenAt ?? detail.latestReading?.capturedAt ?? null,
      source: "status"
    });
  }

  for (const alert of detail.activeAlerts) {
    items.push({
      id: `alert-${alert.id}`,
      title: startCase(alert.kind),
      message: alert.message,
      severity: alert.severity,
      occurredAt: alert.triggeredAt,
      source: "alert"
    });
  }

  for (const event of detail.recentEvents) {
    items.push({
      id: `event-${event.id}`,
      title: startCase(event.type),
      message: event.message,
      severity: event.severity,
      occurredAt: event.occurredAt,
      source: "event"
    });
  }

  return items.sort((left, right) => {
    const leftTime = left.occurredAt ? new Date(left.occurredAt).getTime() : 0;
    const rightTime = right.occurredAt ? new Date(right.occurredAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

export function NotificationFeed(props: { detail: TerrariumDetail }) {
  const items = buildNotificationItems(props.detail);

  return (
    <article className="info-card">
      <div className="section-header">
        <h3>Notifications</h3>
        <p>{items.length} current signals</p>
      </div>
      {items.length === 0 ? (
        <p className="muted-copy">No current notifications. The terrarium is within range and no recent device events need attention.</p>
      ) : (
        <div className="notification-list">
          {items.slice(0, 8).map((item) => (
            <article key={item.id} className={`notification-card notification-${item.severity}`}>
              <div className="terrarium-card-row">
                <strong className="entity-name">{item.title}</strong>
                <StatusBadge label={item.severity} tone={mapStatusTone(item.severity)} />
              </div>
              <p className="notification-copy">{item.message}</p>
              <small className="notification-meta">
                {item.occurredAt ? formatDateTime(item.occurredAt) : "No timestamp available"} | {item.source}
              </small>
            </article>
          ))}
        </div>
      )}
    </article>
  );
}
