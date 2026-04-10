import fs from "node:fs/promises";
import path from "node:path";

const flowId = "flow_terrarium_gateway";
const uiTabId = "ui_tab_gateway";
const uiGroupId = "ui_group_status";
const sqliteConfigId = "sqlite_gateway_db";
const serialConfigId = "serial_gateway_port";

function node(id, type, extra) {
  return { id, type, ...extra };
}

const buildDashboardPayload = `
const latestReading = flow.get("latestReading") || null;
const queueCount = flow.get("queueCount") || 0;
const cloudStatus = flow.get("cloudStatus") || {
  state: "idle",
  message: "Waiting for the first upload cycle.",
  updatedAt: null
};

msg.payload = {
  queueCount,
  latestDevice: latestReading ? latestReading.deviceExternalId : "No data",
  latestTemperature:
    latestReading && latestReading.temperatureC !== null && latestReading.temperatureC !== undefined
      ? latestReading.temperatureC.toFixed(1) + " °C"
      : "No data",
  latestHumidity:
    latestReading && latestReading.humidityPct !== null && latestReading.humidityPct !== undefined
      ? latestReading.humidityPct.toFixed(1) + " %"
      : "No data",
  latestSeenAt: latestReading ? latestReading.capturedAt : "No data",
  cloudState: cloudStatus.state,
  cloudMessage: cloudStatus.message,
  cloudUpdatedAt: cloudStatus.updatedAt || "No uploads yet"
};

return msg;
`.trim();

const nodes = [
  node(flowId, "tab", {
    label: "Terrarium Gateway",
    disabled: false,
    info: "Gateway flow for USB/UART telemetry ingestion, SQLite queueing and HTTPS upload."
  }),
  node(uiTabId, "ui_tab", {
    name: "Gateway",
    icon: "dashboard",
    disabled: false,
    hidden: false
  }),
  node(uiGroupId, "ui_group", {
    name: "Status",
    tab: uiTabId,
    order: 1,
    disp: true,
    width: "12",
    collapse: false
  }),
  node(sqliteConfigId, "sqlitedb", {
    db: "${SQLITE_PATH}",
    mode: "RWC"
  }),
  node(serialConfigId, "serial-port", {
    serialport: "${SERIAL_PORT}",
    serialbaud: "${SERIAL_BAUD}",
    databits: "8",
    parity: "none",
    stopbits: "1",
    waitfor: "\\n",
    dtr: "none",
    rts: "none",
    cts: "false",
    dsr: "false",
    newline: "\\n",
    bin: "false",
    out: "char",
    addchar: "",
    resethardware: false
  }),
  node("inject_schema", "inject", {
    z: flowId,
    name: "Init schema",
    props: [{ p: "payload" }],
    repeat: "",
    crontab: "",
    once: true,
    onceDelay: "0.5",
    topic: "",
    payload: "",
    payloadType: "date",
    x: 150,
    y: 80,
    wires: [["function_schema"]]
  }),
  node("function_schema", "function", {
    z: flowId,
    name: "Prepare SQLite schema",
    func: `
const statements = [
  "CREATE TABLE IF NOT EXISTS telemetry_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, payload_json TEXT NOT NULL, created_at TEXT NOT NULL, sent_at TEXT NULL)",
  "CREATE TABLE IF NOT EXISTS gateway_meta (meta_key TEXT PRIMARY KEY, meta_value TEXT NOT NULL, updated_at TEXT NOT NULL)"
];

return [statements.map((topic) => ({ topic }))];
    `.trim(),
    outputs: 1,
    noerr: 0,
    initialize: "",
    finalize: "",
    libs: [],
    x: 390,
    y: 80,
    wires: [["sqlite_schema"]]
  }),
  node("sqlite_schema", "sqlite", {
    z: flowId,
    mydb: sqliteConfigId,
    sqlquery: "msg.topic",
    sql: "",
    name: "Execute schema SQL",
    x: 660,
    y: 80,
    wires: [[]]
  }),
  node("serial_in", "serial in", {
    z: flowId,
    name: "Read Core Module",
    serial: serialConfigId,
    x: 150,
    y: 180,
    wires: [["function_parse"]]
  }),
  node("function_parse", "function", {
    z: flowId,
    name: "Parse telemetry line",
    func: `
const raw = (typeof msg.payload === "string" ? msg.payload : "").trim();
if (!raw) {
  return null;
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (error) {
  node.warn("Skipping invalid JSON line: " + raw);
  return null;
}

const reading = {
  deviceExternalId: String(parsed.deviceExternalId || parsed.deviceId || "core-module-unknown"),
  capturedAt: parsed.capturedAt || new Date().toISOString(),
  temperatureC: typeof parsed.temperatureC === "number" ? parsed.temperatureC : null,
  humidityPct: typeof parsed.humidityPct === "number" ? parsed.humidityPct : null,
  accelerationG: typeof parsed.accelerationG === "number" ? parsed.accelerationG : null,
  batteryPct: typeof parsed.batteryPct === "number" ? parsed.batteryPct : null,
  movementDetected: Boolean(parsed.movementDetected),
  buttonPressed: Boolean(parsed.buttonPressed),
  sampleCount: 1,
  source: parsed.source || "instant",
  firmwareVersion: parsed.firmwareVersion || null,
  hardwareRevision: parsed.hardwareRevision || null
};

flow.set("latestReading", reading);

return [
  { payload: reading },
  { payload: reading }
];
    `.trim(),
    outputs: 2,
    noerr: 0,
    initialize: "",
    finalize: "",
    libs: [],
    x: 400,
    y: 180,
    wires: [["function_aggregate"], ["function_dashboard"]]
  }),
  node("function_aggregate", "function", {
    z: flowId,
    name: "Aggregate 1 minute buckets",
    func: `
const reading = msg.payload;
const bucketStart = new Date(reading.capturedAt);
bucketStart.setUTCSeconds(0, 0);
const bucketKey = reading.deviceExternalId + ":" + bucketStart.toISOString();

const buffer = flow.get("aggregateBuffer") || {};
const entry = buffer[bucketKey] || {
  deviceExternalId: reading.deviceExternalId,
  capturedAt: bucketStart.toISOString(),
  temperatureTotal: 0,
  temperatureSamples: 0,
  humidityTotal: 0,
  humiditySamples: 0,
  accelerationTotal: 0,
  accelerationSamples: 0,
  movementDetected: false,
  buttonPressed: false,
  sampleCount: 0,
  firmwareVersion: reading.firmwareVersion || null,
  hardwareRevision: reading.hardwareRevision || null
};

if (typeof reading.temperatureC === "number") {
  entry.temperatureTotal += reading.temperatureC;
  entry.temperatureSamples += 1;
}

if (typeof reading.humidityPct === "number") {
  entry.humidityTotal += reading.humidityPct;
  entry.humiditySamples += 1;
}

if (typeof reading.accelerationG === "number") {
  entry.accelerationTotal += reading.accelerationG;
  entry.accelerationSamples += 1;
}

entry.movementDetected = entry.movementDetected || reading.movementDetected;
entry.buttonPressed = entry.buttonPressed || reading.buttonPressed;
entry.sampleCount += reading.sampleCount || 1;

buffer[bucketKey] = entry;
flow.set("aggregateBuffer", buffer);

if (reading.movementDetected || reading.buttonPressed) {
  return [null, { payload: { ...reading, source: "instant" } }];
}

return null;
    `.trim(),
    outputs: 2,
    noerr: 0,
    initialize: "",
    finalize: "",
    libs: [],
    x: 690,
    y: 180,
    wires: [[], ["function_queue"]]
  }),
  node("inject_flush", "inject", {
    z: flowId,
    name: "Flush minute buckets",
    props: [{ p: "payload" }],
    repeat: "60",
    crontab: "",
    once: true,
    onceDelay: "5",
    topic: "",
    payload: "",
    payloadType: "date",
    x: 170,
    y: 260,
    wires: [["function_flush"]]
  }),
  node("function_flush", "function", {
    z: flowId,
    name: "Emit aggregate readings",
    func: `
const buffer = flow.get("aggregateBuffer") || {};
const now = Date.now();
const outgoing = [];
const remaining = {};

for (const [key, entry] of Object.entries(buffer)) {
  if (now - new Date(entry.capturedAt).getTime() < 60_000) {
    remaining[key] = entry;
    continue;
  }

  outgoing.push({
    payload: {
      deviceExternalId: entry.deviceExternalId,
      capturedAt: entry.capturedAt,
      temperatureC: entry.temperatureSamples ? Number((entry.temperatureTotal / entry.temperatureSamples).toFixed(2)) : null,
      humidityPct: entry.humiditySamples ? Number((entry.humidityTotal / entry.humiditySamples).toFixed(2)) : null,
      accelerationG: entry.accelerationSamples ? Number((entry.accelerationTotal / entry.accelerationSamples).toFixed(2)) : null,
      batteryPct: null,
      movementDetected: entry.movementDetected,
      buttonPressed: entry.buttonPressed,
      sampleCount: entry.sampleCount,
      source: "aggregate",
      firmwareVersion: entry.firmwareVersion,
      hardwareRevision: entry.hardwareRevision
    }
  });
}

flow.set("aggregateBuffer", remaining);
return [outgoing];
    `.trim(),
    outputs: 1,
    noerr: 0,
    initialize: "",
    finalize: "",
    libs: [],
    x: 430,
    y: 260,
    wires: [["function_queue"]]
  }),
  node("function_queue", "function", {
    z: flowId,
    name: "Queue reading in SQLite",
    func: `
msg.topic = "INSERT INTO telemetry_queue (payload_json, created_at, sent_at) VALUES (?, ?, NULL)";
msg.payload = [JSON.stringify(msg.payload), new Date().toISOString()];
return msg;
    `.trim(),
    outputs: 1,
    noerr: 0,
    initialize: "",
    finalize: "",
    libs: [],
    x: 960,
    y: 220,
    wires: [["sqlite_queue"]]
  }),
  node("sqlite_queue", "sqlite", {
    z: flowId,
    mydb: sqliteConfigId,
    sqlquery: "msg.topic",
    sql: "",
    name: "Insert queued payload",
    x: 1220,
    y: 220,
    wires: [[]]
  }),
  node("inject_upload", "inject", {
    z: flowId,
    name: "Upload unsent queue",
    props: [{ p: "payload" }],
    repeat: "15",
    crontab: "",
    once: true,
    onceDelay: "10",
    topic: "",
    payload: "",
    payloadType: "date",
    x: 160,
    y: 360,
    wires: [["function_select_unsent"]]
  }),
  node("function_select_unsent", "function", {
    z: flowId,
    name: "Select unsent rows",
    func: `
msg.topic = "SELECT id, payload_json FROM telemetry_queue WHERE sent_at IS NULL ORDER BY id ASC LIMIT 100";
return msg;
    `.trim(),
    outputs: 1,
    noerr: 0,
    initialize: "",
    finalize: "",
    libs: [],
    x: 390,
    y: 360,
    wires: [["sqlite_select_unsent"]]
  }),
  node("sqlite_select_unsent", "sqlite", {
    z: flowId,
    mydb: sqliteConfigId,
    sqlquery: "msg.topic",
    sql: "",
    name: "Read upload batch",
    x: 630,
    y: 360,
    wires: [["function_build_request"]]
  }),
  node("function_build_request", "function", {
    z: flowId,
    name: "Build HTTPS batch request",
    func: `
const rows = Array.isArray(msg.payload) ? msg.payload : [];
const apiBaseUrl = env.get("API_BASE_URL") || "http://localhost:4000";
const gatewaySlug = env.get("GATEWAY_SLUG") || "terrarium-gateway-01";
const apiKey = env.get("GATEWAY_API_KEY") || "";

if (rows.length === 0) {
  flow.set("cloudStatus", {
    state: "idle",
    message: "Queue is empty.",
    updatedAt: new Date().toISOString()
  });
  ${buildDashboardPayload}
}

if (!apiKey) {
  flow.set("cloudStatus", {
    state: "offline",
    message: "Missing GATEWAY_API_KEY.",
    updatedAt: new Date().toISOString()
  });
  ${buildDashboardPayload}
}

const readings = rows.map((row) => JSON.parse(row.payload_json));
msg.url = apiBaseUrl + "/api/v1/ingest/telemetry";
msg.method = "POST";
msg.headers = {
  Authorization: "Bearer " + apiKey
};
msg.payload = {
  gatewaySlug,
  sentAt: new Date().toISOString(),
  readings
};
msg.queueIds = rows.map((row) => row.id);

return [msg, null];
    `.trim(),
    outputs: 2,
    noerr: 0,
    initialize: "",
    finalize: "",
    libs: [],
    x: 900,
    y: 360,
    wires: [["http_upload"], ["function_dashboard"]]
  }),
  node("http_upload", "http request", {
    z: flowId,
    name: "POST to cloud",
    method: "use",
    ret: "obj",
    paytoqs: "ignore",
    url: "",
    tls: "",
    persist: false,
    proxy: "",
    insecureHTTPParser: false,
    authType: "",
    senderr: false,
    headers: [],
    x: 1140,
    y: 360,
    wires: [["function_handle_response"]]
  }),
  node("function_handle_response", "function", {
    z: flowId,
    name: "Handle upload response",
    func: `
const queueIds = Array.isArray(msg.queueIds) ? msg.queueIds : [];

if (msg.statusCode >= 200 && msg.statusCode < 300) {
  flow.set("cloudStatus", {
    state: "online",
    message: "Uploaded " + queueIds.length + " queued readings.",
    updatedAt: new Date().toISOString()
  });

  if (queueIds.length === 0) {
    ${buildDashboardPayload}
  }

  const placeholders = queueIds.map(() => "?").join(", ");
  msg.topic = "UPDATE telemetry_queue SET sent_at = ? WHERE id IN (" + placeholders + ")";
  msg.payload = [new Date().toISOString(), ...queueIds];
  return [msg, { payload: flow.get("latestReading") || {} }];
}

flow.set("cloudStatus", {
  state: "offline",
  message: "Upload failed with status " + (msg.statusCode || "unknown") + ".",
  updatedAt: new Date().toISOString()
});

${buildDashboardPayload}
    `.trim(),
    outputs: 2,
    noerr: 0,
    initialize: "",
    finalize: "",
    libs: [],
    x: 1380,
    y: 360,
    wires: [["sqlite_mark_sent"], ["function_dashboard"]]
  }),
  node("sqlite_mark_sent", "sqlite", {
    z: flowId,
    mydb: sqliteConfigId,
    sqlquery: "msg.topic",
    sql: "",
    name: "Mark rows sent",
    x: 1610,
    y: 340,
    wires: [[]]
  }),
  node("inject_cleanup", "inject", {
    z: flowId,
    name: "Cleanup sent rows",
    props: [{ p: "payload" }],
    repeat: "3600",
    crontab: "",
    once: true,
    onceDelay: "15",
    topic: "",
    payload: "",
    payloadType: "date",
    x: 150,
    y: 450,
    wires: [["function_cleanup"]]
  }),
  node("function_cleanup", "function", {
    z: flowId,
    name: "Delete old sent rows",
    func: `
const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
msg.topic = "DELETE FROM telemetry_queue WHERE sent_at IS NOT NULL AND sent_at < ?";
msg.payload = [cutoff];
return msg;
    `.trim(),
    outputs: 1,
    noerr: 0,
    initialize: "",
    finalize: "",
    libs: [],
    x: 390,
    y: 450,
    wires: [["sqlite_cleanup"]]
  }),
  node("sqlite_cleanup", "sqlite", {
    z: flowId,
    mydb: sqliteConfigId,
    sqlquery: "msg.topic",
    sql: "",
    name: "Cleanup SQLite queue",
    x: 640,
    y: 450,
    wires: [[]]
  }),
  node("inject_count", "inject", {
    z: flowId,
    name: "Refresh dashboard count",
    props: [{ p: "payload" }],
    repeat: "10",
    crontab: "",
    once: true,
    onceDelay: "4",
    topic: "",
    payload: "",
    payloadType: "date",
    x: 160,
    y: 540,
    wires: [["function_count"]]
  }),
  node("function_count", "function", {
    z: flowId,
    name: "Count unsent rows",
    func: `
msg.topic = "SELECT COUNT(*) AS queued FROM telemetry_queue WHERE sent_at IS NULL";
return msg;
    `.trim(),
    outputs: 1,
    noerr: 0,
    initialize: "",
    finalize: "",
    libs: [],
    x: 380,
    y: 540,
    wires: [["sqlite_count"]]
  }),
  node("sqlite_count", "sqlite", {
    z: flowId,
    mydb: sqliteConfigId,
    sqlquery: "msg.topic",
    sql: "",
    name: "Read queue count",
    x: 610,
    y: 540,
    wires: [["function_dashboard"]]
  }),
  node("function_dashboard", "function", {
    z: flowId,
    name: "Build dashboard model",
    func: `
if (Array.isArray(msg.payload) && msg.payload[0] && typeof msg.payload[0].queued === "number") {
  flow.set("queueCount", msg.payload[0].queued);
}

${buildDashboardPayload}
    `.trim(),
    outputs: 1,
    noerr: 0,
    initialize: "",
    finalize: "",
    libs: [],
    x: 870,
    y: 540,
    wires: [["ui_template_status"]]
  }),
  node("ui_template_status", "ui_template", {
    z: flowId,
    group: uiGroupId,
    name: "Gateway dashboard",
    order: 1,
    width: "12",
    height: "8",
    format: `
<div style="display:grid;gap:12px;">
  <div style="padding:12px;border-radius:16px;background:#152723;">
    <strong>Cloud</strong>
    <div>{{msg.payload.cloudState}}</div>
    <small>{{msg.payload.cloudMessage}}</small>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
    <div style="padding:12px;border-radius:16px;background:#152723;">
      <strong>Queued Records</strong>
      <div>{{msg.payload.queueCount}}</div>
    </div>
    <div style="padding:12px;border-radius:16px;background:#152723;">
      <strong>Latest Device</strong>
      <div>{{msg.payload.latestDevice}}</div>
    </div>
  </div>
  <div style="padding:12px;border-radius:16px;background:#152723;">
    <strong>Latest Reading</strong>
    <div>{{msg.payload.latestTemperature}} / {{msg.payload.latestHumidity}}</div>
    <small>{{msg.payload.latestSeenAt}}</small>
  </div>
</div>
    `.trim(),
    storeOutMessages: false,
    fwdInMessages: true,
    resendOnRefresh: true,
    templateScope: "local",
    className: "",
    x: 1120,
    y: 540,
    wires: [[]]
  })
];

const targetPath = path.resolve(process.cwd(), "gateway/flows/terrarium-gateway.json");
await fs.writeFile(targetPath, `${JSON.stringify(nodes, null, 2)}\n`, "utf8");

console.log(`Generated ${targetPath}`);
