import type { AppEnv } from "../config/env.js";
import { toIdString } from "../db/ids.js";
import { DeviceModel, GatewayModel, TerrariumModel } from "../db/models.js";
import { generateApiKey, hashSecret } from "../utils/auth.js";
import { HttpError } from "../utils/http-error.js";
import { getGatewayConnectionStatus, toIso } from "../utils/status.js";
import type {
  GatewayRegistrationRequest,
  GatewayRegistrationResponse,
  GatewaySummary
} from "@biot/shared";

export async function registerGateway(
  input: GatewayRegistrationRequest,
  env: AppEnv
): Promise<GatewayRegistrationResponse> {
  if (input.enrollmentKey !== env.GATEWAY_ENROLLMENT_KEY) {
    throw new HttpError(401, "gateway.enrollment.invalid", "The gateway enrollment key is invalid.");
  }

  const apiKey = generateApiKey();
  const gatewayDocument = await GatewayModel.findOneAndUpdate(
    {
      slug: input.gatewaySlug
    },
    {
      name: input.gatewayName,
      machineLabel: input.machineLabel ?? null,
      softwareVersion: input.softwareVersion ?? null,
      apiKeyHash: hashSecret(apiKey),
      lastSeenAt: new Date()
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true
    }
  );

  if (!gatewayDocument) {
    throw new HttpError(500, "gateway.registration_failed", "The gateway registration could not be completed.");
  }

  return {
    gatewayId: toIdString(gatewayDocument._id)!,
    gatewayName: gatewayDocument.name,
    gatewaySlug: gatewayDocument.slug,
    apiKey,
    ingestUrl: `${env.APP_BASE_URL}/api/v1/ingest/telemetry`,
    issuedAt: new Date().toISOString()
  };
}

export async function listGateways(): Promise<GatewaySummary[]> {
  const gateways = (await GatewayModel.find().sort({ name: 1 })).map((document) => document.toObject());
  const devices =
    gateways.length > 0
      ? (await DeviceModel.find({ gatewayId: { $in: gateways.map((gateway) => gateway._id) } })).map((document) =>
          document.toObject()
        )
      : [];
  const terrariums =
    devices.length > 0
      ? (await TerrariumModel.find({ deviceId: { $in: devices.map((device) => device._id) } })).map((document) =>
          document.toObject()
        )
      : [];

  const deviceCountByGatewayId = new Map<string, number>();
  const gatewayIdByDeviceId = new Map<string, string>();
  const terrariumCountByGatewayId = new Map<string, number>();

  for (const device of devices) {
    const gatewayId = toIdString(device.gatewayId)!;
    deviceCountByGatewayId.set(gatewayId, (deviceCountByGatewayId.get(gatewayId) ?? 0) + 1);
    gatewayIdByDeviceId.set(toIdString(device._id)!, gatewayId);
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

export async function getGatewayBySlug(slug: string) {
  const gateway = await GatewayModel.findOne({ slug });

  if (!gateway) {
    throw new HttpError(404, "gateway.not_found", "The gateway is not registered.");
  }

  return gateway;
}
