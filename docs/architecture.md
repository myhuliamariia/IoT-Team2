# Architecture Notes

## Stack Choice

- USB/UART between node and gateway because there is no Radio Dongle.
- Node-RED on Windows because the USB serial device is attached to the Windows host, not WSL.
- Express + React because the assignment requires those technologies.

## Downsampling Strategy

- Raw node readings are frequent enough to detect short-term changes.
- The gateway computes 1 minute arithmetic means for temperature, humidity, and acceleration.
- Button presses and movement events bypass downsampling and are queued immediately.

This keeps the UI responsive while preventing noisy or redundant uploads.

## Gateway Retention Strategy

- Unsent data: infinite retention until a successful upload.
- Sent data: 24 hour retention in the gateway queue for troubleshooting and replay safety.
- Cloud data: persistent retention in the backend database.

This satisfies the assignment and gives a defensible operational policy.

## Authentication Strategy

- The gateway registers using a shared enrollment key.
- The backend returns a generated API key.
- Each ingest request uses `Authorization: Bearer <api-key>`.
- The backend stores only a SHA-256 hash of the key.

## Disconnected Device Strategy

- A terrarium can exist without a device.
- A device can be discovered before being assigned.
- A terrarium is considered disconnected when no device is assigned or no recent telemetry arrives.

This matches the user story and supports gradual hardware rollout.

## Multi-Terrarium Extension

The current physical setup supports one live USB-connected node per gateway. The software already scales beyond that:

- more terrarium profiles can be created immediately
- more devices can be discovered and assigned without changing the data model
- more gateways can register independently against the same cloud backend
- if radio hardware is added later, one gateway can manage multiple nodes without a backend redesign
