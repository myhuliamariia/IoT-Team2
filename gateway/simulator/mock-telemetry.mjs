const count = Number(process.env.COUNT ?? 30);
const intervalMs = Number(process.env.INTERVAL_MS ?? 1000);
const deviceExternalId = process.env.DEVICE_ID ?? "core-module-sim-01";
const firmwareVersion = process.env.FIRMWARE_VERSION ?? "1.0.0-sim";
const hardwareRevision = process.env.HARDWARE_REVISION ?? "core-module-r2";

let emitted = 0;

function buildReading(index) {
  const baselineTemperature = 26 + Math.sin(index / 4) * 1.4;
  const baselineHumidity = 66 + Math.cos(index / 5) * 4.2;
  const movementDetected = index % 17 === 0;
  const buttonPressed = index % 29 === 0;

  return {
    deviceExternalId,
    capturedAt: new Date().toISOString(),
    temperatureC: Number(baselineTemperature.toFixed(2)),
    humidityPct: Number(baselineHumidity.toFixed(2)),
    accelerationG: Number((movementDetected ? 1.44 : 0.98).toFixed(2)),
    movementDetected,
    buttonPressed,
    source: "instant",
    firmwareVersion,
    hardwareRevision
  };
}

const timer = setInterval(() => {
  emitted += 1;
  process.stdout.write(`${JSON.stringify(buildReading(emitted))}\n`);

  if (emitted >= count) {
    clearInterval(timer);
  }
}, intervalMs);
