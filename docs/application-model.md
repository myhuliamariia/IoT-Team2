# Application Model

## Components

### IoT Node

- HARDWARIO Core Module firmware in C
- Reads onboard TMP112 temperature, onboard LIS2DH12 accelerometer, and external Humidity Tag
- Emits newline-delimited JSON over USB CDC

### Gateway

- Node-RED flow running on Windows because the USB device is attached there
- Reads serial payloads from the node
- Performs 1 minute arithmetic mean downsampling for climate telemetry
- Persists the local offline upload queue in SQLite
- Uploads batches to the cloud API
- Exposes a local dashboard with queue and cloud status

### Cloud Backend

- Express.js + TypeScript
- MongoDB Atlas + Mongoose
- Provides terrarium management, gateway registration, authenticated ingest, device discovery, history, and overview endpoints

### Cloud Frontend

- React + TypeScript + Vite
- Displays terrarium cards, current conditions, limit settings, history charts, alerts, gateway state, and discovered devices

## Main Flows

### Provisioning

1. Operator starts the cloud backend.
2. Operator registers the gateway using the enrollment key.
3. Gateway receives an API key.
4. Operator imports the Node-RED flow and configures environment variables.

### Telemetry

1. Firmware sends raw JSON over USB CDC.
2. Node-RED parses the JSON, updates the dashboard context, and queues the record in SQLite.
3. Node-RED flushes 1 minute aggregates and immediate events to the queue.
4. Gateway posts queued batches to the cloud API over HTTP in local development and HTTPS in deployment.
5. Backend authenticates the gateway, persists the data, resolves terrarium assignment, and maintains alerts.
6. React UI fetches overview and detail endpoints and renders the latest state.

### Terrarium Management

1. Breeder creates a terrarium profile.
2. Breeder sets min and max climate limits.
3. Breeder optionally assigns a discovered device.
4. The UI shows current state, chart history, and alerts.

## Deployment Shape

- WSL/Linux: backend, frontend build, repository tooling
- Windows: HARDWARIO flashing, USB serial ownership, Node-RED gateway runtime
- Cloud deployment target: the Express server can serve the built React app as one deployable web application
