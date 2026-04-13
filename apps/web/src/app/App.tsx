import { Suspense, lazy, useEffect, useState, startTransition } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DeviceSummary, OverviewResponse, TerrariumCreateInput, TerrariumDetail, TerrariumSummary } from "@biot/shared";
import { Route, Routes, useNavigate, useParams } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import { MetricCard } from "../components/MetricCard";
import { StatusBadge } from "../components/StatusBadge";
import { TerrariumFormDialog } from "../components/TerrariumFormDialog";
import { formatAcceleration, formatDateTime, formatHumidity, formatRelative, formatTemperature } from "../lib/format";

const HistoryChart = lazy(async () => {
  const module = await import("../components/HistoryChart");
  return { default: module.HistoryChart };
});

function statusTone(status: TerrariumSummary["connectionStatus"] | TerrariumSummary["health"]) {
  if (status === "connected" || status === "healthy") {
    return "good" as const;
  }

  if (status === "warning" || status === "stale") {
    return "warning" as const;
  }

  return "danger" as const;
}

function useOverview() {
  return useQuery({
    queryKey: ["overview"],
    queryFn: () => apiFetch<OverviewResponse>("/api/v1/overview"),
    refetchInterval: 30_000
  });
}

function useDevices() {
  return useQuery({
    queryKey: ["devices"],
    queryFn: () => apiFetch<DeviceSummary[]>("/api/v1/devices"),
    refetchInterval: 30_000
  });
}

function useTerrariumDetail(terrariumId: string | undefined) {
  return useQuery({
    queryKey: ["terrarium", terrariumId],
    queryFn: () => apiFetch<TerrariumDetail>(`/api/v1/terrariums/${terrariumId}?hours=24`),
    enabled: Boolean(terrariumId),
    refetchInterval: 30_000
  });
}

function DashboardRoute() {
  const params = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const overviewQuery = useOverview();
  const devicesQuery = useDevices();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedId = params.terrariumId ?? overviewQuery.data?.terrariums[0]?.id;
  const detailQuery = useTerrariumDetail(selectedId);

  useEffect(() => {
    if (!params.terrariumId && overviewQuery.data?.terrariums[0]?.id) {
      startTransition(() => {
        navigate(`/terrariums/${overviewQuery.data?.terrariums[0]?.id}`, { replace: true });
      });
    }
  }, [navigate, overviewQuery.data?.terrariums, params.terrariumId]);

  const createMutation = useMutation({
    mutationFn: (payload: TerrariumCreateInput) =>
      apiFetch<TerrariumSummary>("/api/v1/terrariums", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async (terrarium) => {
      setCreateOpen(false);
      setFormError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
        queryClient.invalidateQueries({ queryKey: ["devices"] })
      ]);
      startTransition(() => {
        navigate(`/terrariums/${terrarium.id}`);
      });
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Failed to create the terrarium.");
    }
  });

  const updateMutation = useMutation({
    mutationFn: (payload: TerrariumCreateInput) =>
      apiFetch<TerrariumSummary>(`/api/v1/terrariums/${selectedId}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      setEditOpen(false);
      setFormError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
        queryClient.invalidateQueries({ queryKey: ["terrarium", selectedId] }),
        queryClient.invalidateQueries({ queryKey: ["devices"] })
      ]);
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Failed to update the terrarium.");
    }
  });

  if (overviewQuery.isLoading) {
    return <div className="loading-state">Loading terrarium cloud...</div>;
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <div className="loading-state">
        Failed to load the dashboard. Confirm that the API is running and the database has been initialized.
      </div>
    );
  }

  const overview = overviewQuery.data;
  const detail = detailQuery.data;
  const devices = devicesQuery.data ?? [];

  return (
    <div className="page-shell">
      <header className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Terrarium Operations Cloud</p>
          <h1>Monitor each habitat as its own operating envelope.</h1>
          <p className="hero-text">
            Separate temperature and humidity targets, isolated histories, live device assignment, and a disconnected
            state that makes multi-terrarium growth manageable from the first node onward.
          </p>
        </div>
        <div className="hero-actions">
          <button className="primary-button" type="button" onClick={() => setCreateOpen(true)}>
            Add terrarium
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ["overview"] });
              if (selectedId) {
                void queryClient.invalidateQueries({ queryKey: ["terrarium", selectedId] });
              }
            }}
          >
            Refresh data
          </button>
        </div>
      </header>

      <section className="metric-grid">
        <MetricCard
          eyebrow="Terrariums"
          value={String(overview.metrics.terrariumCount)}
          hint={`${overview.metrics.connectedTerrariumCount} connected right now`}
          accent="teal"
        />
        <MetricCard
          eyebrow="Attention Needed"
          value={String(overview.metrics.activeAlertCount)}
          hint={`${overview.metrics.disconnectedTerrariumCount} disconnected or stale`}
          accent="amber"
        />
        <MetricCard
          eyebrow="Gateways"
          value={String(overview.metrics.gatewayCount)}
          hint="Authenticated ingestion endpoints"
          accent="rose"
        />
      </section>

      <main className="dashboard-layout">
        <aside className="sidebar-panel">
          <div className="section-header">
            <h2>Terrariums</h2>
            <p>{overview.terrariums.length} profiles</p>
          </div>

          <div className="terrarium-list">
            {overview.terrariums.map((terrarium) => (
              <button
                key={terrarium.id}
                className={`terrarium-card ${selectedId === terrarium.id ? "terrarium-card-active" : ""}`}
                type="button"
                onClick={() => {
                  startTransition(() => {
                    navigate(`/terrariums/${terrarium.id}`);
                  });
                }}
              >
                <div className="terrarium-card-row">
                  <strong className="entity-name" title={terrarium.name}>
                    {terrarium.name}
                  </strong>
                  <StatusBadge label={terrarium.health} tone={statusTone(terrarium.health)} />
                </div>
                <p className="secondary-copy" title={terrarium.speciesName ?? "Species not specified"}>
                  {terrarium.speciesName ?? "Species not specified"}
                </p>
                <div className="terrarium-card-row">
                  <span>{formatTemperature(terrarium.latestReading?.temperatureC)}</span>
                  <span>{formatHumidity(terrarium.latestReading?.humidityPct)}</span>
                </div>
                <small className="supporting-id" title={terrarium.device ? terrarium.device.externalId : "Device not assigned"}>
                  {terrarium.device ? terrarium.device.externalId : "Device not assigned"}
                </small>
              </button>
            ))}
          </div>

          <div className="sidebar-section">
            <div className="section-header">
              <h2>Discovered Devices</h2>
              <p>{devices.length} known nodes</p>
            </div>
            <div className="simple-list">
              {devices.length === 0 ? <p className="muted-copy">No devices have uploaded telemetry yet.</p> : null}
              {devices.map((device) => (
                <article key={device.id} className="list-card">
                  <strong className="entity-name" title={device.externalId}>
                    {device.externalId}
                  </strong>
                  <p className="secondary-copy" title={device.gatewayName ?? "No gateway linked"}>
                    {device.gatewayName ?? "No gateway linked"}
                  </p>
                  <small className="supporting-id">{device.assignedTerrariumId ? "Assigned" : "Unassigned"}</small>
                </article>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <div className="section-header">
              <h2>Gateways</h2>
              <p>{overview.gateways.length} registered</p>
            </div>
            <div className="simple-list">
              {overview.gateways.map((gateway) => (
                <article key={gateway.id} className="list-card">
                  <div className="terrarium-card-row">
                    <strong className="entity-name" title={gateway.name}>
                      {gateway.name}
                    </strong>
                    <StatusBadge
                      label={gateway.connectionStatus}
                      tone={gateway.connectionStatus === "online" ? "good" : gateway.connectionStatus === "degraded" ? "warning" : "danger"}
                    />
                  </div>
                  <p className="secondary-copy" title={gateway.machineLabel ?? gateway.slug}>
                    {gateway.machineLabel ?? gateway.slug}
                  </p>
                  <small className="supporting-id">Last seen {formatRelative(gateway.lastSeenAt)}</small>
                </article>
              ))}
            </div>
          </div>
        </aside>

        <section className="detail-panel">
          {!detail ? (
            <div className="empty-panel">
              <p>Select a terrarium to inspect its current readings and history.</p>
            </div>
          ) : (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Selected Terrarium</p>
                  <h2 title={detail.name}>{detail.name}</h2>
                  <p className="hero-text secondary-copy" title={detail.speciesName ?? "Species not specified"}>
                    {detail.speciesName ?? "Species not specified"}
                  </p>
                </div>
                <div className="detail-actions">
                  <StatusBadge label={detail.connectionStatus} tone={statusTone(detail.connectionStatus)} />
                  <button className="ghost-button" type="button" onClick={() => setEditOpen(true)}>
                    Edit settings
                  </button>
                </div>
              </div>

              <section className="metric-grid detail-metric-grid">
                <MetricCard
                  eyebrow="Current Temperature"
                  value={formatTemperature(detail.latestReading?.temperatureC)}
                  hint={`Range ${detail.minTemperatureC.toFixed(1)} to ${detail.maxTemperatureC.toFixed(1)} °C`}
                  accent="amber"
                />
                <MetricCard
                  eyebrow="Current Humidity"
                  value={formatHumidity(detail.latestReading?.humidityPct)}
                  hint={`Range ${detail.minHumidityPct.toFixed(1)} to ${detail.maxHumidityPct.toFixed(1)} %`}
                  accent="teal"
                />
                <MetricCard
                  eyebrow="Motion Envelope"
                  value={formatAcceleration(detail.latestReading?.accelerationG)}
                  hint={detail.latestReading?.movementDetected ? "Movement detected in latest sample" : "Stable in latest sample"}
                  accent="rose"
                />
                <MetricCard
                  eyebrow="Device State"
                  value={detail.device?.externalId ?? "Not linked"}
                  hint={
                    detail.device
                      ? `Last seen ${formatRelative(detail.device.lastSeenAt)}`
                      : "Create the terrarium first and link a device later."
                  }
                  accent="slate"
                />
              </section>

              <section className="detail-grid">
                <article className="info-card">
                  <div className="section-header">
                    <h3>Health Alerts</h3>
                    <p>{detail.activeAlerts.length} active</p>
                  </div>
                  {detail.activeAlerts.length === 0 ? (
                    <p className="muted-copy">No active threshold breaches. The terrarium is inside its target envelope.</p>
                  ) : (
                    <div className="simple-list">
                      {detail.activeAlerts.map((alert) => (
                        <article key={alert.id} className="alert-card">
                          <div className="terrarium-card-row">
                            <strong>{alert.kind.replaceAll("_", " ")}</strong>
                            <StatusBadge label={alert.severity} tone={statusTone(alert.severity as TerrariumSummary["health"])} />
                          </div>
                          <p>{alert.message}</p>
                          <small>
                            Triggered {formatDateTime(alert.triggeredAt)}
                            {alert.measuredValue !== null && alert.thresholdValue !== null
                              ? ` | ${alert.measuredValue.toFixed(1)} vs ${alert.thresholdValue.toFixed(1)}`
                              : ""}
                          </small>
                        </article>
                      ))}
                    </div>
                  )}
                </article>

                <article className="info-card">
                  <div className="section-header">
                    <h3>Assignment</h3>
                    <p>{detail.device ? "Bound" : "Pending"}</p>
                  </div>
                  <div className="key-value-stack">
                    <div>
                      <span>Assigned device</span>
                      <strong className="value-text" title={detail.device?.externalId ?? "No device assigned"}>
                        {detail.device?.externalId ?? "No device assigned"}
                      </strong>
                    </div>
                    <div>
                      <span>Gateway</span>
                      <strong className="value-text" title={detail.device?.gatewayName ?? "Not available"}>
                        {detail.device?.gatewayName ?? "Not available"}
                      </strong>
                    </div>
                    <div>
                      <span>Latest payload</span>
                      <strong className="value-text">
                        {detail.latestReading ? formatDateTime(detail.latestReading.capturedAt) : "No telemetry yet"}
                      </strong>
                    </div>
                    <div>
                      <span>Button state</span>
                      <strong className="value-text">
                        {detail.latestReading?.buttonPressed ? "Pressed in latest sample" : "No recent press"}
                      </strong>
                    </div>
                  </div>
                </article>
              </section>

              <article className="info-card chart-section">
                <div className="section-header">
                  <h3>24 Hour History</h3>
                  <p>Downsampled gateway telemetry</p>
                </div>
                <Suspense fallback={<div className="empty-panel">Loading chart...</div>}>
                  <HistoryChart history={detail.history} />
                </Suspense>
              </article>
            </>
          )}
        </section>
      </main>

      {createOpen ? (
        <TerrariumFormDialog
          title="Add Terrarium"
          submitLabel="Create terrarium"
          devices={devices.filter((device) => !device.assignedTerrariumId)}
          initialValues={{
            name: "",
            speciesName: "",
            notes: "",
            minTemperatureC: 24,
            maxTemperatureC: 29,
            minHumidityPct: 55,
            maxHumidityPct: 75,
            deviceId: null
          }}
          isSaving={createMutation.isPending}
          errorMessage={formError}
          onClose={() => {
            setCreateOpen(false);
            setFormError(null);
          }}
          onSubmit={(values) => createMutation.mutate(values)}
        />
      ) : null}

      {editOpen && detail ? (
        <TerrariumFormDialog
          title={`Edit ${detail.name}`}
          submitLabel="Save changes"
          devices={devices.filter((device) => !device.assignedTerrariumId || device.id === detail.device?.id)}
          initialValues={{
            name: detail.name,
            speciesName: detail.speciesName ?? "",
            notes: detail.notes ?? "",
            minTemperatureC: detail.minTemperatureC,
            maxTemperatureC: detail.maxTemperatureC,
            minHumidityPct: detail.minHumidityPct,
            maxHumidityPct: detail.maxHumidityPct,
            deviceId: detail.device?.id ?? null
          }}
          isSaving={updateMutation.isPending}
          errorMessage={formError}
          onClose={() => {
            setEditOpen(false);
            setFormError(null);
          }}
          onSubmit={(values) => updateMutation.mutate(values)}
        />
      ) : null}
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardRoute />} />
      <Route path="/terrariums/:terrariumId" element={<DashboardRoute />} />
    </Routes>
  );
}
