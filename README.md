# Terrarium Cloud MVP

This repository implements a complete semester-project IoT solution for **multi-terrarium management** based on the HARDWARIO Core Module. It covers the full chain:

- Core Module firmware over USB CDC
- Node-RED gateway with SQLite queueing and dashboard
- Express cloud backend
- React cloud frontend
- assignment documentation for business request, business model, and application model

The chosen product scope matches the approved user story: a breeder can create and manage multiple terrariums, set per-terrarium temperature and humidity limits, view current values and history, and see a disconnected-device state.

## Stack

- **Firmware:** HARDWARIO SDK in C
- **Gateway:** Node-RED + `node-red-node-serialport` + `node-red-node-sqlite` + `node-red-dashboard`
- **Cloud backend:** Express 5 + TypeScript + MongoDB Atlas + Mongoose
- **Cloud frontend:** React 19 + Vite + TanStack Query + Recharts

## Repository Layout

- `apps/api`: cloud backend
- `apps/web`: React frontend
- `packages/shared`: shared contracts and validation
- `gateway`: Node-RED gateway assets, registration helper, simulator, setup docs
- `firmware/core-module`: HARDWARIO firmware sources
- `docs`: assignment documentation

## Local Cloud Launch In WSL

1. Install dependencies:

```bash
npm install
```

2. Configure the backend environment:

```bash
cp apps/api/.env.example apps/api/.env
```

Set `MONGODB_URI` and `MONGODB_DB_NAME` in `apps/api/.env`.

3. Initialize MongoDB indexes:

```bash
npm run db:push
```

4. Optional demo seed:

```bash
npm run db:seed
```

5. Run backend and frontend in one command:

```bash
npm start
```

6. Open the frontend:

```text
http://localhost:5173
```

The frontend runs on `http://localhost:5173`.

The API runs on `http://localhost:4000`.

The cloud application data is stored in MongoDB. The only remaining SQLite usage is the local offline queue inside the Node-RED gateway.

If the Atlas free cluster has been idle, the API may need a short warm-up period on first start. The backend now retries MongoDB connection automatically during that wake-up window.

## Production-Style Local Run

Build everything and serve the bundled frontend from Express:

```bash
npm run start:prod
```

Open:

```text
http://localhost:4000
```

## Backend Verification

Run the backend integration tests:

```bash
npm test
```

The tests cover:

- terrarium creation
- duplicate-name rejection
- disconnected-device scenario
- gateway registration
- device discovery
- telemetry ingest and terrarium history

## Environment Files

- Backend example: [apps/api/.env.example](/home/mwtn/biot/apps/api/.env.example)
- Frontend example: [apps/web/.env.example](/home/mwtn/biot/apps/web/.env.example)
- Gateway example: [gateway/.env.example](/home/mwtn/biot/gateway/.env.example)

## Firmware

Firmware source is in [firmware/core-module/src/application.c](/home/mwtn/biot/firmware/core-module/src/application.c) and [firmware/core-module/src/application.h](/home/mwtn/biot/firmware/core-module/src/application.h).

Behavior:

- onboard temperature sensor
- external Humidity Tag support
- onboard accelerometer support
- button press emits immediate telemetry
- movement spike emits immediate telemetry
- periodic telemetry every 10 seconds

The firmware writes newline-delimited JSON over USB CDC. The gateway adds timestamps, queues the data, downsamples it, and sends it to the cloud.

Because the hardware is attached to Windows, the practical flashing path is to use **HARDWARIO Code** or **Playground** on Windows. The WSL environment here is used for the cloud application and repository tooling.

## Gateway On Windows

The gateway should run on the Windows machine that physically owns the USB serial port for the Core Module.

### Setup

1. Open the [gateway](/home/mwtn/biot/gateway) folder on Windows.
2. Install dependencies:

```bash
npm install
```

3. Generate the Node-RED flow JSON:

```bash
npm run flow:generate
```

4. Register the gateway against the cloud API:

```bash
node register-gateway.mjs
```

5. Copy the printed `GATEWAY_API_KEY` into your Node-RED environment.
6. Import [gateway/flows/terrarium-gateway.json](/home/mwtn/biot/gateway/flows/terrarium-gateway.json) into Node-RED.

Reference setup notes are in [gateway/docs/node-red-setup.md](/home/mwtn/biot/gateway/docs/node-red-setup.md).

### Required Environment Variables For Node-RED

- `SERIAL_PORT`
- `SERIAL_BAUD`
- `API_BASE_URL`
- `GATEWAY_SLUG`
- `GATEWAY_API_KEY`
- `SQLITE_PATH`

### Gateway Runtime Behavior

- Reads USB serial telemetry from the Core Module
- Stores telemetry in SQLite before upload
- Keeps **unsent data forever**
- Keeps **sent data for 24 hours**
- Uploads queued data every 15 seconds
- Computes 1 minute arithmetic means for regular climate samples
- Uploads button and movement events immediately

### Auto-Start Requirement

To satisfy the assignment requirement that the gateway starts automatically, configure **Windows Task Scheduler** to run Node-RED at machine startup or user logon.

Recommended action:

```text
Program/script: cmd.exe
Arguments: /c npm start --prefix C:\path\to\biot\gateway
```

## Multiple Terrariums And Future Hardware

The current hardware assumption is:

- no Radio Dongle
- one live USB node connected to one gateway machine

The software is already designed for more than that:

- the cloud data model separates `Terrarium`, `Device`, and `Gateway`
- terrariums can exist before a device is assigned
- devices are discovered independently from terrarium creation
- one backend can receive data from multiple gateways
- more hardware can be added later without changing the API or frontend interaction model

This means you can demonstrate:

- one live terrarium with the current hardware
- additional disconnected terrariums in the UI immediately
- additional live terrariums later by adding more Core Modules and gateways

If a Radio Dongle is added later, the same backend and frontend remain valid while the gateway can scale toward multiple nodes behind one gateway instance.

## Deployment Notes

For local development the cloud app uses HTTP while storing data in MongoDB. For the final internet-accessible deployment, place the Express application behind HTTPS or deploy it to a platform that terminates TLS.

Because the API already serves the built frontend, the cloud application can be deployed as a single web service.

## Assignment Documents

- [docs/business-request.md](/home/mwtn/biot/docs/business-request.md)
- [docs/business-model.md](/home/mwtn/biot/docs/business-model.md)
- [docs/application-model.md](/home/mwtn/biot/docs/application-model.md)
- [docs/architecture.md](/home/mwtn/biot/docs/architecture.md)

## External Help You May Still Need

I can complete the repository implementation from WSL, but final hardware validation still depends on the Windows side because that is where the board and COM port live. If you want, the next useful hands-on step is:

1. flash the firmware from Windows
2. start Node-RED on Windows
3. verify the COM port and imported flow
4. send one live telemetry batch to the cloud app

If you hit any Windows-side issue with HARDWARIO Code, Playground, COM port selection, or Node-RED import/runtime, send me the exact error and I’ll walk through it.
