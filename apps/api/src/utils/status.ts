import {
  GATEWAY_DEGRADED_AFTER_MINUTES,
  GATEWAY_OFFLINE_AFTER_MINUTES,
  TERRARIUM_STALE_AFTER_MINUTES,
  type GatewaySummary,
  type TerrariumSummary
} from "@biot/shared";

type AlertLike = {
  severity: string;
};

export function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function getGatewayConnectionStatus(lastSeenAt: Date | null): GatewaySummary["connectionStatus"] {
  if (!lastSeenAt) {
    return "offline";
  }

  const ageMinutes = (Date.now() - lastSeenAt.getTime()) / 60_000;

  if (ageMinutes > GATEWAY_OFFLINE_AFTER_MINUTES) {
    return "offline";
  }

  if (ageMinutes > GATEWAY_DEGRADED_AFTER_MINUTES) {
    return "degraded";
  }

  return "online";
}

export function getTerrariumConnectionStatus(lastSeenAt: Date | null): TerrariumSummary["connectionStatus"] {
  if (!lastSeenAt) {
    return "disconnected";
  }

  const ageMinutes = (Date.now() - lastSeenAt.getTime()) / 60_000;

  if (ageMinutes > TERRARIUM_STALE_AFTER_MINUTES) {
    return "stale";
  }

  return "connected";
}

export function getTerrariumHealth(
  connectionStatus: TerrariumSummary["connectionStatus"],
  alerts: AlertLike[]
): TerrariumSummary["health"] {
  if (connectionStatus === "disconnected") {
    return "disconnected";
  }

  if (alerts.some((alert) => alert.severity === "critical")) {
    return "critical";
  }

  if (alerts.length > 0 || connectionStatus === "stale") {
    return "warning";
  }

  return "healthy";
}
