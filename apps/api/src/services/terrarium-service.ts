import { Types } from "mongoose";
import type {
  DeviceSummary,
  OverviewResponse,
  TerrariumCreateInput,
  TerrariumDetail,
  TerrariumEvent,
  TerrariumHistoryPoint,
  TerrariumSummary,
  TerrariumUpdateInput
} from "@biot/shared";
import { toIdString, toObjectId } from "../db/ids.js";
import {
  AlertModel,
  DeviceModel,
  DeviceEventModel,
  GatewayModel,
  SensorReadingModel,
  TerrariumModel,
  type AlertRecord,
  type DeviceRecord,
  type DeviceEventRecord,
  type GatewayRecord,
  type SensorReadingRecord,
  type TerrariumRecord
} from "../db/models.js";
import { HttpError } from "../utils/http-error.js";
import { isDuplicateKeyError } from "../utils/object.js";
import {
  getGatewayConnectionStatus,
  getTerrariumConnectionStatus,
  getTerrariumHealth,
  toIso
} from "../utils/status.js";

function mapDeviceSummary(args: {
  device: DeviceRecord;
  gateway: GatewayRecord | null;
  assignedTerrariumId?: string | null;
}): DeviceSummary {
  return {
    id: toIdString(args.device._id)!,
    externalId: args.device.externalId,
    gatewayId: toIdString(args.device.gatewayId),
    gatewayName: args.gateway?.name ?? null,
    firmwareVersion: args.device.firmwareVersion ?? null,
    hardwareRevision: args.device.hardwareRevision ?? null,
    lastSeenAt: toIso(args.device.lastSeenAt),
    assignedTerrariumId: args.assignedTerrariumId ?? null
  };
}

function mapAlertSummary(alert: AlertRecord) {
  return {
    id: toIdString(alert._id)!,
    kind: alert.kind,
    severity: alert.severity as "info" | "warning" | "critical",
    message: alert.message,
    measuredValue: alert.measuredValue ?? null,
    thresholdValue: alert.thresholdValue ?? null,
    triggeredAt: alert.triggeredAt.toISOString(),
    resolvedAt: toIso(alert.resolvedAt)
  };
}

function mapDeviceEventSummary(event: DeviceEventRecord): TerrariumEvent {
  let message = "A device event was recorded.";

  if (event.type === "button_pressed") {
    message = "Manual button press was recorded on the assigned device.";
  }

  if (event.type === "movement_detected") {
    let suffix = ".";

    if (event.payloadJson) {
      try {
        const payload = JSON.parse(event.payloadJson) as {
          accelerationG?: unknown;
        };

        if (typeof payload.accelerationG === "number") {
          suffix = ` (${payload.accelerationG.toFixed(2)} g).`;
        }
      } catch {
        // Ignore malformed historical payloads and fall back to a generic message.
      }
    }

    message = `Movement was detected by the assigned device${suffix}`;
  }

  return {
    id: toIdString(event._id)!,
    type: event.type as TerrariumEvent["type"],
    severity: event.severity as TerrariumEvent["severity"],
    message,
    occurredAt: event.occurredAt.toISOString()
  };
}

function mapReadingSummary(reading: SensorReadingRecord | null) {
  if (!reading) {
    return null;
  }

  return {
    capturedAt: reading.capturedAt.toISOString(),
    temperatureC: reading.temperatureC ?? null,
    humidityPct: reading.humidityPct ?? null,
    accelerationG: reading.accelerationG ?? null,
    buttonPressed: reading.buttonPressed,
    movementDetected: reading.movementDetected,
    sampleCount: reading.sampleCount
  };
}

function mapTerrariumSummary(args: {
  terrarium: TerrariumRecord;
  device: DeviceRecord | null;
  gateway: GatewayRecord | null;
  latestReading: SensorReadingRecord | null;
  alerts: AlertRecord[];
}): TerrariumSummary {
  const lastSeenAt = args.device?.lastSeenAt ?? args.latestReading?.capturedAt ?? null;
  const connectionStatus = getTerrariumConnectionStatus(lastSeenAt);
  const activeAlerts = args.alerts.map(mapAlertSummary);

  return {
    id: toIdString(args.terrarium._id)!,
    name: args.terrarium.name,
    speciesName: args.terrarium.speciesName ?? null,
    notes: args.terrarium.notes ?? null,
    minTemperatureC: args.terrarium.minTemperatureC,
    maxTemperatureC: args.terrarium.maxTemperatureC,
    minHumidityPct: args.terrarium.minHumidityPct,
    maxHumidityPct: args.terrarium.maxHumidityPct,
    connectionStatus,
    health: getTerrariumHealth(connectionStatus, activeAlerts),
    device: args.device
      ? mapDeviceSummary({
          device: args.device,
          gateway: args.gateway,
          assignedTerrariumId: toIdString(args.terrarium._id)
        })
      : null,
    latestReading: mapReadingSummary(args.latestReading),
    activeAlerts
  };
}

async function buildGatewayMap(gatewayIds: Types.ObjectId[]): Promise<Map<string, GatewayRecord>> {
  if (gatewayIds.length === 0) {
    return new Map();
  }

  const gateways = (await GatewayModel.find({ _id: { $in: gatewayIds } })).map((document) =>
    document.toObject() as GatewayRecord
  );

  return new Map(gateways.map((gateway) => [toIdString(gateway._id)!, gateway]));
}

async function buildLatestReadingMap(terrariumIds: Types.ObjectId[]): Promise<Map<string, SensorReadingRecord>> {
  if (terrariumIds.length === 0) {
    return new Map();
  }

  const results = await SensorReadingModel.aggregate<{
    _id: Types.ObjectId;
    latest: SensorReadingRecord;
  }>([
    { $match: { terrariumId: { $in: terrariumIds } } },
    { $sort: { capturedAt: -1, _id: -1 } },
    { $group: { _id: "$terrariumId", latest: { $first: "$$ROOT" } } }
  ]);

  return new Map(results.map((result) => [toIdString(result._id)!, result.latest]));
}

async function buildAlertMap(terrariumIds: Types.ObjectId[]): Promise<Map<string, AlertRecord[]>> {
  if (terrariumIds.length === 0) {
    return new Map();
  }

  const alerts = (await AlertModel.find({
    terrariumId: { $in: terrariumIds },
    status: "active"
  }).sort({ triggeredAt: -1 })).map((document) => document.toObject() as AlertRecord);

  const map = new Map<string, AlertRecord[]>();
  for (const alert of alerts) {
    const key = toIdString(alert.terrariumId)!;
    const existing = map.get(key) ?? [];
    if (existing.length < 6) {
      existing.push(alert);
      map.set(key, existing);
    }
  }

  return map;
}

async function buildTerrariumSummaries(terrariums: TerrariumRecord[]): Promise<TerrariumSummary[]> {
  const terrariumIds = terrariums.map((terrarium) => terrarium._id);
  const deviceIds = terrariums
    .map((terrarium) => terrarium.deviceId)
    .filter((value): value is Types.ObjectId => value instanceof Types.ObjectId);

  const devices =
    deviceIds.length > 0
      ? (await DeviceModel.find({ _id: { $in: deviceIds } })).map((document) => document.toObject() as DeviceRecord)
      : [];
  const deviceMap = new Map(devices.map((device) => [toIdString(device._id)!, device]));

  const gatewayIds = devices
    .map((device) => device.gatewayId)
    .filter((value): value is Types.ObjectId => value instanceof Types.ObjectId);
  const gatewayMap = await buildGatewayMap(gatewayIds);
  const latestReadingMap = await buildLatestReadingMap(terrariumIds);
  const alertMap = await buildAlertMap(terrariumIds);

  return terrariums.map((terrarium) => {
    const device = terrarium.deviceId ? deviceMap.get(toIdString(terrarium.deviceId)!) ?? null : null;
    const gateway = device?.gatewayId ? gatewayMap.get(toIdString(device.gatewayId)!) ?? null : null;
    const latestReading = latestReadingMap.get(toIdString(terrarium._id)!) ?? null;
    const alerts = alertMap.get(toIdString(terrarium._id)!) ?? [];

    return mapTerrariumSummary({
      terrarium,
      device,
      gateway,
      latestReading,
      alerts
    });
  });
}

async function assertDeviceAvailable(deviceId: string, terrariumId?: string): Promise<void> {
  const deviceObjectId = toObjectId(deviceId, "device.not_found", "The selected device does not exist.");
  const device = await DeviceModel.findById(deviceObjectId);

  if (!device) {
    throw new HttpError(404, "device.not_found", "The selected device does not exist.");
  }

  const assignedTerrarium = await TerrariumModel.findOne({ deviceId: deviceObjectId });
  if (assignedTerrarium && toIdString(assignedTerrarium._id) !== terrariumId) {
    throw new HttpError(409, "device.assigned", "This device is already assigned to another terrarium.");
  }
}

async function backfillUnassignedReadings(deviceId: string, terrariumId: string): Promise<void> {
  await SensorReadingModel.updateMany(
    {
      deviceId: toObjectId(deviceId, "device.not_found", "The selected device does not exist."),
      terrariumId: null
    },
    {
      terrariumId: toObjectId(terrariumId, "terrarium.not_found", "The requested terrarium does not exist.")
    }
  );
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function assertTerrariumLimits(limits: {
  minTemperatureC: number;
  maxTemperatureC: number;
  minHumidityPct: number;
  maxHumidityPct: number;
}): void {
  if (limits.minTemperatureC >= limits.maxTemperatureC) {
    throw new HttpError(400, "validation.failed", "Maximum temperature must be greater than the minimum.");
  }

  if (limits.minHumidityPct >= limits.maxHumidityPct) {
    throw new HttpError(400, "validation.failed", "Maximum humidity must be greater than the minimum.");
  }
}

function mapPersistenceError(error: unknown): never {
  if (isDuplicateKeyError(error)) {
    throw new HttpError(409, "terrarium.duplicate_name", "A terrarium with this name already exists.");
  }

  throw error;
}

export async function listTerrariums(): Promise<TerrariumSummary[]> {
  const terrariums = (await TerrariumModel.find().sort({ name: 1 })).map((document) =>
    document.toObject() as TerrariumRecord
  );

  return buildTerrariumSummaries(terrariums);
}

export async function getTerrariumDetail(id: string, hours: number): Promise<TerrariumDetail> {
  const terrariumId = toObjectId(id, "terrarium.not_found", "The requested terrarium does not exist.");
  const terrariumDocument = await TerrariumModel.findById(terrariumId);

  if (!terrariumDocument) {
    throw new HttpError(404, "terrarium.not_found", "The requested terrarium does not exist.");
  }

  const terrarium = terrariumDocument.toObject() as TerrariumRecord;
  const summary = (await buildTerrariumSummaries([terrarium]))[0];
  if (!summary) {
    throw new HttpError(500, "terrarium.summary_failed", "The terrarium summary could not be loaded.");
  }
  const history = (await SensorReadingModel.find({
    terrariumId,
    capturedAt: {
      $gte: new Date(Date.now() - hours * 60 * 60 * 1000)
    }
  }).sort({ capturedAt: 1 })).map((document) => document.toObject() as SensorReadingRecord);

  const mappedHistory: TerrariumHistoryPoint[] = history.map((reading) => ({
    capturedAt: reading.capturedAt.toISOString(),
    temperatureC: reading.temperatureC ?? null,
    humidityPct: reading.humidityPct ?? null,
    accelerationG: reading.accelerationG ?? null,
    sampleCount: reading.sampleCount,
    movementDetected: reading.movementDetected,
    buttonPressed: reading.buttonPressed
  }));

  const recentEvents = (await DeviceEventModel.find({
    terrariumId
  }).sort({ occurredAt: -1, _id: -1 }).limit(10)).map((document) =>
    mapDeviceEventSummary(document.toObject() as DeviceEventRecord)
  );

  return {
    ...summary,
    history: mappedHistory,
    recentEvents
  };
}

export async function createTerrarium(input: TerrariumCreateInput): Promise<TerrariumSummary> {
  try {
    assertTerrariumLimits(input);

    if (input.deviceId) {
      await assertDeviceAvailable(input.deviceId);
    }

    const terrariumDocument = await TerrariumModel.create({
      name: input.name.trim(),
      speciesName: normalizeOptionalString(input.speciesName),
      notes: normalizeOptionalString(input.notes),
      minTemperatureC: input.minTemperatureC,
      maxTemperatureC: input.maxTemperatureC,
      minHumidityPct: input.minHumidityPct,
      maxHumidityPct: input.maxHumidityPct,
      deviceId: input.deviceId
        ? toObjectId(input.deviceId, "device.not_found", "The selected device does not exist.")
        : undefined
    });

    if (terrariumDocument.deviceId) {
      await backfillUnassignedReadings(toIdString(terrariumDocument.deviceId)!, toIdString(terrariumDocument._id)!);
    }

    const summary = (await buildTerrariumSummaries([terrariumDocument.toObject() as TerrariumRecord]))[0];
    if (!summary) {
      throw new HttpError(500, "terrarium.summary_failed", "The terrarium summary could not be loaded.");
    }

    return summary;
  } catch (error) {
    mapPersistenceError(error);
  }
}

export async function updateTerrarium(id: string, input: TerrariumUpdateInput): Promise<TerrariumSummary> {
  const terrariumId = toObjectId(id, "terrarium.not_found", "The requested terrarium does not exist.");
  const current = await TerrariumModel.findById(terrariumId);

  if (!current) {
    throw new HttpError(404, "terrarium.not_found", "The requested terrarium does not exist.");
  }

  const nextDeviceId = input.deviceId === undefined ? toIdString(current.deviceId) : input.deviceId;
  if (nextDeviceId !== null && nextDeviceId !== undefined) {
    await assertDeviceAvailable(nextDeviceId, id);
  }

  try {
    current.name = input.name?.trim() ?? current.name;
    current.speciesName =
      input.speciesName !== undefined
        ? normalizeOptionalString(input.speciesName)
        : current.speciesName;
    current.notes = input.notes !== undefined ? normalizeOptionalString(input.notes) : current.notes;
    current.minTemperatureC = input.minTemperatureC ?? current.minTemperatureC;
    current.maxTemperatureC = input.maxTemperatureC ?? current.maxTemperatureC;
    current.minHumidityPct = input.minHumidityPct ?? current.minHumidityPct;
    current.maxHumidityPct = input.maxHumidityPct ?? current.maxHumidityPct;

    assertTerrariumLimits({
      minTemperatureC: current.minTemperatureC,
      maxTemperatureC: current.maxTemperatureC,
      minHumidityPct: current.minHumidityPct,
      maxHumidityPct: current.maxHumidityPct
    });

    if (input.deviceId !== undefined) {
      current.deviceId = input.deviceId
        ? toObjectId(input.deviceId, "device.not_found", "The selected device does not exist.")
        : undefined;
    }

    await current.save();

    if (nextDeviceId) {
      await backfillUnassignedReadings(nextDeviceId, id);
    }

    const summary = (await buildTerrariumSummaries([current.toObject() as TerrariumRecord]))[0];
    if (!summary) {
      throw new HttpError(500, "terrarium.summary_failed", "The terrarium summary could not be loaded.");
    }

    return summary;
  } catch (error) {
    mapPersistenceError(error);
  }
}

export async function listDevices(): Promise<DeviceSummary[]> {
  const devices = (await DeviceModel.find().sort({ externalId: 1 })).map((document) =>
    document.toObject() as DeviceRecord
  );
  const gatewayIds = devices
    .map((device) => device.gatewayId)
    .filter((value): value is Types.ObjectId => value instanceof Types.ObjectId);
  const gateways = await buildGatewayMap(gatewayIds);
  const terrariums =
    devices.length > 0
      ? (await TerrariumModel.find({ deviceId: { $in: devices.map((device) => device._id) } })).map((document) =>
          document.toObject() as TerrariumRecord
        )
      : [];

  const terrariumByDeviceId = new Map(
    terrariums
      .filter((terrarium) => terrarium.deviceId)
      .map((terrarium) => [toIdString(terrarium.deviceId)!, toIdString(terrarium._id)!])
  );

  return devices.map((device) =>
    mapDeviceSummary({
      device,
      gateway: device.gatewayId ? gateways.get(toIdString(device.gatewayId)!) ?? null : null,
      assignedTerrariumId: terrariumByDeviceId.get(toIdString(device._id)!) ?? null
    })
  );
}

export async function getOverview(): Promise<OverviewResponse> {
  const [terrariums, gateways] = await Promise.all([listTerrariums(), listGatewaysInternal()]);

  return {
    metrics: {
      terrariumCount: terrariums.length,
      connectedTerrariumCount: terrariums.filter((terrarium) => terrarium.connectionStatus === "connected")
        .length,
      disconnectedTerrariumCount: terrariums.filter((terrarium) => terrarium.connectionStatus !== "connected")
        .length,
      activeAlertCount: terrariums.reduce((count, terrarium) => count + terrarium.activeAlerts.length, 0),
      gatewayCount: gateways.length
    },
    gateways,
    terrariums
  };
}

async function listGatewaysInternal() {
  const gateways = (await GatewayModel.find().sort({ name: 1 })).map((document) =>
    document.toObject() as GatewayRecord
  );
  const devices =
    gateways.length > 0
      ? (await DeviceModel.find({ gatewayId: { $in: gateways.map((gateway) => gateway._id) } })).map((document) =>
          document.toObject() as DeviceRecord
        )
      : [];
  const terrariums =
    devices.length > 0
      ? (await TerrariumModel.find({ deviceId: { $in: devices.map((device) => device._id) } })).map((document) =>
          document.toObject() as TerrariumRecord
        )
      : [];

  const deviceCountByGatewayId = new Map<string, number>();
  const gatewayIdByDeviceId = new Map<string, string>();
  const terrariumCountByGatewayId = new Map<string, number>();

  for (const device of devices) {
    const gatewayId = toIdString(device.gatewayId)!;
    gatewayIdByDeviceId.set(toIdString(device._id)!, gatewayId);
    deviceCountByGatewayId.set(gatewayId, (deviceCountByGatewayId.get(gatewayId) ?? 0) + 1);
  }

  for (const terrarium of terrariums) {
    const deviceId = toIdString(terrarium.deviceId);
    if (!deviceId) {
      continue;
    }

    const gatewayId = gatewayIdByDeviceId.get(deviceId);
    if (!gatewayId) {
      continue;
    }

    terrariumCountByGatewayId.set(gatewayId, (terrariumCountByGatewayId.get(gatewayId) ?? 0) + 1);
  }

  return gateways.map((gateway) => ({
    id: toIdString(gateway._id)!,
    name: gateway.name,
    slug: gateway.slug,
    machineLabel: gateway.machineLabel ?? null,
    softwareVersion: gateway.softwareVersion ?? null,
    connectionStatus: getGatewayConnectionStatus(gateway.lastSeenAt ?? null),
    lastSeenAt: toIso(gateway.lastSeenAt),
    deviceCount: deviceCountByGatewayId.get(toIdString(gateway._id)!) ?? 0,
    terrariumCount: terrariumCountByGatewayId.get(toIdString(gateway._id)!) ?? 0
  }));
}
