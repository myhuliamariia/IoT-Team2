import { ResponsiveContainer, LineChart, Line, CartesianGrid, Tooltip, XAxis, YAxis, Legend } from "recharts";
import type { TerrariumHistoryPoint } from "@biot/shared";

export function HistoryChart(props: { history: TerrariumHistoryPoint[] }) {
  const data = props.history.map((point) => ({
    timestamp: new Date(point.capturedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    }),
    temperatureC: point.temperatureC,
    humidityPct: point.humidityPct
  }));

  if (data.length === 0) {
    return (
      <div className="empty-panel">
        <p>No historical data is available yet for this terrarium.</p>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="timestamp" stroke="#9ab0a2" />
          <YAxis yAxisId="temp" stroke="#f5b26b" />
          <YAxis yAxisId="humidity" orientation="right" stroke="#67c6c0" />
          <Tooltip
            contentStyle={{
              background: "#13231f",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16
            }}
          />
          <Legend />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="temperatureC"
            name="Temperature °C"
            stroke="#f5b26b"
            strokeWidth={3}
            dot={false}
          />
          <Line
            yAxisId="humidity"
            type="monotone"
            dataKey="humidityPct"
            name="Humidity %"
            stroke="#67c6c0"
            strokeWidth={3}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
