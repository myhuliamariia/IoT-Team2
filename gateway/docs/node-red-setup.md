# Node-RED Gateway Setup

Run the gateway on the Windows machine that owns the USB serial port for the HARDWARIO Core Module. The provided flow expects:

- `SERIAL_PORT`
- `SERIAL_BAUD`
- `API_BASE_URL`
- `GATEWAY_SLUG`
- `GATEWAY_API_KEY`
- `SQLITE_PATH`

Generate or refresh the flow file with:

```bash
npm run flow:generate
```

Register the gateway against the cloud API with:

```bash
node register-gateway.mjs
```

The flow implements:

- USB/UART telemetry ingestion from the Core Module
- 1 minute arithmetic mean downsampling for periodic climate telemetry
- immediate persistence of button and motion events
- SQLite-backed offline queueing for unsent records
- HTTPS upload to the cloud API every 15 seconds
- 24 hour retention for sent records and infinite retention for unsent records
- a local Node-RED dashboard with queue and cloud status

The provided `npm start` command runs Node-RED with its user directory in `gateway/.node-red` so it does not conflict with the repo's ESM package configuration.
