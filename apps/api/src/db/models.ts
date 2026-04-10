import mongoose, { InferSchemaType, Schema, Types } from "mongoose";

const gatewaySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true, index: true },
    machineLabel: { type: String, default: null },
    softwareVersion: { type: String, default: null },
    apiKeyHash: { type: String, required: true },
    lastSeenAt: { type: Date, default: null }
  },
  { timestamps: true }
);

const deviceSchema = new Schema(
  {
    externalId: { type: String, required: true, trim: true, unique: true, index: true },
    firmwareVersion: { type: String, default: null },
    hardwareRevision: { type: String, default: null },
    gatewayId: { type: Types.ObjectId, ref: "Gateway", default: null, index: true },
    lastSeenAt: { type: Date, default: null },
    lastTemperatureC: { type: Number, default: null },
    lastHumidityPct: { type: Number, default: null },
    lastAccelerationG: { type: Number, default: null }
  },
  { timestamps: true }
);

const terrariumSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, index: true },
    speciesName: { type: String, default: null },
    notes: { type: String, default: null },
    minTemperatureC: { type: Number, required: true },
    maxTemperatureC: { type: Number, required: true },
    minHumidityPct: { type: Number, required: true },
    maxHumidityPct: { type: Number, required: true },
    deviceId: { type: Types.ObjectId, ref: "Device", sparse: true, unique: true }
  },
  { timestamps: true }
);

const sensorReadingSchema = new Schema(
  {
    terrariumId: { type: Types.ObjectId, ref: "Terrarium", default: null, index: true },
    gatewayId: { type: Types.ObjectId, ref: "Gateway", required: true, index: true },
    deviceId: { type: Types.ObjectId, ref: "Device", required: true, index: true },
    capturedAt: { type: Date, required: true, index: true },
    source: { type: String, required: true },
    sampleCount: { type: Number, required: true, default: 1 },
    temperatureC: { type: Number, default: null },
    humidityPct: { type: Number, default: null },
    accelerationG: { type: Number, default: null },
    batteryPct: { type: Number, default: null },
    buttonPressed: { type: Boolean, required: true, default: false },
    movementDetected: { type: Boolean, required: true, default: false }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

sensorReadingSchema.index({ terrariumId: 1, capturedAt: -1 });
sensorReadingSchema.index({ deviceId: 1, capturedAt: -1 });
sensorReadingSchema.index({ gatewayId: 1, capturedAt: -1 });

const alertSchema = new Schema(
  {
    terrariumId: { type: Types.ObjectId, ref: "Terrarium", required: true, index: true },
    readingId: { type: Types.ObjectId, ref: "SensorReading", default: null },
    kind: { type: String, required: true, index: true },
    severity: { type: String, required: true },
    status: { type: String, required: true, index: true },
    message: { type: String, required: true },
    measuredValue: { type: Number, default: null },
    thresholdValue: { type: Number, default: null },
    triggeredAt: { type: Date, required: true, index: true },
    resolvedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

alertSchema.index({ terrariumId: 1, status: 1, triggeredAt: -1 });

const deviceEventSchema = new Schema(
  {
    terrariumId: { type: Types.ObjectId, ref: "Terrarium", default: null, index: true },
    gatewayId: { type: Types.ObjectId, ref: "Gateway", required: true, index: true },
    deviceId: { type: Types.ObjectId, ref: "Device", required: true, index: true },
    type: { type: String, required: true },
    severity: { type: String, required: true },
    occurredAt: { type: Date, required: true, index: true },
    payloadJson: { type: String, default: null }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const ingestBatchSchema = new Schema(
  {
    gatewayId: { type: Types.ObjectId, ref: "Gateway", required: true, index: true },
    recordsCount: { type: Number, required: true },
    sourceIp: { type: String, default: null },
    requestId: { type: String, default: null },
    receivedAt: { type: Date, required: true, default: Date.now }
  },
  { timestamps: false }
);

export type GatewayRecord = InferSchemaType<typeof gatewaySchema> & { _id: Types.ObjectId };
export type DeviceRecord = InferSchemaType<typeof deviceSchema> & { _id: Types.ObjectId };
export type TerrariumRecord = InferSchemaType<typeof terrariumSchema> & { _id: Types.ObjectId };
export type SensorReadingRecord = InferSchemaType<typeof sensorReadingSchema> & { _id: Types.ObjectId };
export type AlertRecord = InferSchemaType<typeof alertSchema> & { _id: Types.ObjectId };

export const GatewayModel = mongoose.models.Gateway ?? mongoose.model("Gateway", gatewaySchema);
export const DeviceModel = mongoose.models.Device ?? mongoose.model("Device", deviceSchema);
export const TerrariumModel = mongoose.models.Terrarium ?? mongoose.model("Terrarium", terrariumSchema);
export const SensorReadingModel =
  mongoose.models.SensorReading ?? mongoose.model("SensorReading", sensorReadingSchema);
export const AlertModel = mongoose.models.Alert ?? mongoose.model("Alert", alertSchema);
export const DeviceEventModel = mongoose.models.DeviceEvent ?? mongoose.model("DeviceEvent", deviceEventSchema);
export const IngestBatchModel = mongoose.models.IngestBatch ?? mongoose.model("IngestBatch", ingestBatchSchema);

export const allModels = [
  GatewayModel,
  DeviceModel,
  TerrariumModel,
  SensorReadingModel,
  AlertModel,
  DeviceEventModel,
  IngestBatchModel
] as const;
