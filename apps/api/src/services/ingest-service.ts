import { Types } from "mongoose";
import { toIdString, toOptionalObjectId } from "../db/ids.js";
import {
  AlertModel,
  DeviceEventModel,
  DeviceModel,
  GatewayModel,
  IngestBatchModel,
  SensorReadingModel,
  TerrariumModel,
  type TerrariumRecord
} from "../db/models.js";
import { verifySecret } from "../utils/auth.js";
import { HttpError } from "../utils/http-error.js";
import { stripUndefined } from "../utils/object.js";
import type { TelemetryBatch, TelemetryReading } from "@biot/shared";

type ThresholdRule = {
  kind: string;
  severity: "warning" | "critical";
  message: string;
  measuredValue: number;
  thresholdValue: number;
};

function collectThresholdRules(
  terrarium: {
    name: string;
    minTemperatureC: number;
    maxTemperatureC: number;
    minHumidityPct: number;
    maxHumidityPct: number;
  },
  reading: TelemetryReading
): ThresholdRule[] {
  const rules: ThresholdRule[] = [];

  if (reading.temperatureC !== undefined && reading.temperatureC !== null) {
    if (reading.temperatureC < terrarium.minTemperatureC) {
      rules.push({
        kind: "temperature_low",
        severity: "critical",
        message: `${terrarium.name} dropped below the configured minimum temperature.`,
        measuredValue: reading.temperatureC,
        thresholdValue: terrarium.minTemperatureC
      });
    }

    if (reading.temperatureC > terrarium.maxTemperatureC) {
      rules.push({
        kind: "temperature_high",
        severity: "critical",
        message: `${terrarium.name} exceeded the configured maximum temperature.`,
        measuredValue: reading.temperatureC,
        thresholdValue: terrarium.maxTemperatureC
      });
    }
  }

  if (reading.humidityPct !== undefined && reading.humidityPct !== null) {
    if (reading.humidityPct < terrarium.minHumidityPct) {
      rules.push({
        kind: "humidity_low",
        severity: "warning",
        message: `${terrarium.name} dropped below the configured minimum humidity.`,
        measuredValue: reading.humidityPct,
        thresholdValue: terrarium.minHumidityPct
      });
    }

    if (reading.humidityPct > terrarium.maxHumidityPct) {
      rules.push({
        kind: "humidity_high",
        severity: "warning",
        message: `${terrarium.name} exceeded the configured maximum humidity.`,
        measuredValue: reading.humidityPct,
        thresholdValue: terrarium.maxHumidityPct
      });
    }
  }

  return rules;
}

async function syncThresholdAlerts(
  terrarium: TerrariumRecord,
  reading: TelemetryReading,
  readingId: string,
  capturedAt: Date
): Promise<void> {
  const breachedRules = collectThresholdRules(terrarium, reading);
  const breachKinds = new Set(breachedRules.map((rule) => rule.kind));
  const activeAlerts = await AlertModel.find({
    terrariumId: terrarium._id,
    status: "active"
  });
  const activeAlertByKind = new Map(activeAlerts.map((alert) => [alert.kind, alert]));

  for (const rule of breachedRules) {
    const existing = activeAlertByKind.get(rule.kind);

    if (existing) {
      existing.message = rule.message;
      existing.measuredValue = rule.measuredValue;
      existing.thresholdValue = rule.thresholdValue;
      existing.severity = rule.severity;
      existing.readingId = new Types.ObjectId(readingId);
      existing.triggeredAt = capturedAt;
      await existing.save();
    } else {
      await AlertModel.create({
        terrariumId: terrarium._id,
        readingId: new Types.ObjectId(readingId),
        kind: rule.kind,
        severity: rule.severity,
        status: "active",
        message: rule.message,
        measuredValue: rule.measuredValue,
        thresholdValue: rule.thresholdValue,
        triggeredAt: capturedAt
      });
    }
  }

  for (const alert of activeAlerts) {
    if (!breachKinds.has(alert.kind)) {
      alert.status = "resolved";
      alert.resolvedAt = capturedAt;
      await alert.save();
    }
  }
}

async function recordDiscreteEvents(args: {
  terrariumId: string | null | undefined;
  gatewayId: string;
  deviceId: string;
  capturedAt: Date;
  reading: TelemetryReading;
}): Promise<void> {
  if (args.reading.buttonPressed) {
    await DeviceEventModel.create({
      terrariumId: toOptionalObjectId(args.terrariumId),
      gatewayId: new Types.ObjectId(args.gatewayId),
      deviceId: new Types.ObjectId(args.deviceId),
      type: "button_pressed",
      severity: "info",
      occurredAt: args.capturedAt,
      payloadJson: JSON.stringify({
        source: args.reading.source
      })
    });
  }

  if (args.reading.movementDetected) {
    await DeviceEventModel.create({
      terrariumId: toOptionalObjectId(args.terrariumId),
      gatewayId: new Types.ObjectId(args.gatewayId),
      deviceId: new Types.ObjectId(args.deviceId),
      type: "movement_detected",
      severity: "warning",
      occurredAt: args.capturedAt,
      payloadJson: JSON.stringify({
        accelerationG: args.reading.accelerationG ?? null
      })
    });
  }
}

export async function ingestTelemetryBatch(
  payload: TelemetryBatch,
  apiKey: string,
  requestMeta: {
    sourceIp: string | undefined;
    requestId: string | undefined;
  }
) {
  const gateway = await GatewayModel.findOne({ slug: payload.gatewaySlug });

  if (!gateway) {
    throw new HttpError(404, "gateway.not_found", "The gateway is not registered.");
  }

  if (!verifySecret(apiKey, gateway.apiKeyHash)) {
    throw new HttpError(401, "gateway.auth.invalid", "The gateway API key is invalid.");
  }

  gateway.lastSeenAt = new Date(payload.sentAt);
  await gateway.save();

  const ingestBatch = await IngestBatchModel.create({
    gatewayId: gateway._id,
    recordsCount: payload.readings.length,
    sourceIp: requestMeta.sourceIp ?? null,
    requestId: requestMeta.requestId ?? null,
    receivedAt: new Date()
  });

  for (const reading of payload.readings) {
    const capturedAt = new Date(reading.capturedAt);

    const device = await DeviceModel.findOneAndUpdate(
      {
        externalId: reading.deviceExternalId
      },
      {
        $set: stripUndefined({
          gatewayId: gateway._id,
          firmwareVersion: reading.firmwareVersion ?? null,
          hardwareRevision: reading.hardwareRevision ?? null,
          lastSeenAt: capturedAt,
          lastTemperatureC: reading.temperatureC ?? null,
          lastHumidityPct: reading.humidityPct ?? null,
          lastAccelerationG: reading.accelerationG ?? null
        }),
        $setOnInsert: {
          externalId: reading.deviceExternalId
        }
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true
      }
    );

    if (!device) {
      throw new HttpError(500, "device.upsert_failed", "The device could not be persisted.");
    }

    const terrariumDocument = await TerrariumModel.findOne({ deviceId: device._id });
    const terrarium = terrariumDocument?.toObject() as TerrariumRecord | undefined;

    const persistedReading = await SensorReadingModel.create({
      terrariumId: terrarium?._id ?? null,
      gatewayId: gateway._id,
      deviceId: device._id,
      ingestBatchId: ingestBatch._id,
      capturedAt,
      source: reading.source,
      sampleCount: reading.sampleCount,
      temperatureC: reading.temperatureC ?? null,
      humidityPct: reading.humidityPct ?? null,
      accelerationG: reading.accelerationG ?? null,
      batteryPct: reading.batteryPct ?? null,
      buttonPressed: reading.buttonPressed,
      movementDetected: reading.movementDetected
    });

    if (terrarium) {
      await syncThresholdAlerts(terrarium, reading, toIdString(persistedReading._id)!, capturedAt);
    }

    await recordDiscreteEvents({
      terrariumId: terrarium ? toIdString(terrarium._id) : null,
      gatewayId: toIdString(gateway._id)!,
      deviceId: toIdString(device._id)!,
      capturedAt,
      reading
    });
  }

  return {
    accepted: payload.readings.length,
    ingestBatchId: toIdString(ingestBatch._id)!
  };
}
