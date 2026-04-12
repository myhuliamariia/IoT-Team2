# Core Module Firmware

This firmware targets the HARDWARIO Core Module and emits newline-delimited JSON over USB CDC.

Sensors used:

- onboard TMP112 temperature sensor
- onboard LIS2DH12 accelerometer
- external HARDWARIO Humidity Tag (optional)

Runtime behavior:

- temperature and humidity sampled every 2 seconds
- accelerometer sampled every 500 ms
- a telemetry JSON line is emitted every 10 seconds
- button presses and movement spikes trigger an immediate extra telemetry line

The emitted payload is intentionally simple so the Node-RED gateway can timestamp, persist, downsample, and upload it:

```json
{
  "deviceExternalId": "cm-00112233445566778899aabb",
  "temperatureC": 26.10,
  "humidityPct": 64.30,
  "accelerationG": 1.01,
  "movementDetected": false,
  "buttonPressed": false,
  "firmwareVersion": "1.0.0",
  "hardwareRevision": "core-module-r2"
}
```

If your Humidity Tag revision is not `R3`, update `TERRARIUM_HUMIDITY_TAG_REVISION` in [application.h](/home/mwtn/biot/firmware/core-module/src/application.h).

The current default firmware build targets a standalone Core Module, so onboard temperature and accelerometer are enabled, while Humidity Tag support is disabled until the external tag is physically attached. Re-enable it by setting `TERRARIUM_HUMIDITY_TAG_ENABLED` back to `1`.
