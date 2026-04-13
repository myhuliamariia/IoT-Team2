import { z } from "zod";

export const gatewayConnectionStatusSchema = z.enum([
  "online",
  "degraded",
  "offline"
]);

export const terrariumConnectionStatusSchema = z.enum([
  "connected",
  "stale",
  "disconnected"
]);

export const terrariumHealthSchema = z.enum([
  "healthy",
  "warning",
  "critical",
  "disconnected"
]);

export const telemetrySourceSchema = z.enum([
  "aggregate",
  "instant"
]);

export const gatewayRegistrationRequestSchema = z.object({
  enrollmentKey: z.string().min(1),
  gatewayName: z.string().trim().min(3).max(80),
  gatewaySlug: z.string().trim().min(3).max(80).regex(/^[a-z0-9-]+$/),
  softwareVersion: z.string().trim().min(1).max(40).optional(),
  machineLabel: z.string().trim().max(120).optional()
});

export const gatewayRegistrationResponseSchema = z.object({
  gatewayId: z.string(),
  gatewayName: z.string(),
  gatewaySlug: z.string(),
  apiKey: z.string(),
  ingestUrl: z.string().url(),
  issuedAt: z.string().datetime()
});

export const telemetryReadingSchema = z.object({
  deviceExternalId: z.string().trim().min(3).max(120),
  capturedAt: z.string().datetime(),
  temperatureC: z.number().min(-50).max(100).nullable().optional(),
  humidityPct: z.number().min(0).max(100).nullable().optional(),
  accelerationG: z.number().min(0).max(32).nullable().optional(),
  batteryPct: z.number().min(0).max(100).nullable().optional(),
  movementDetected: z.boolean().default(false),
  buttonPressed: z.boolean().default(false),
  sampleCount: z.number().int().min(1).max(3600).default(1),
  source: telemetrySourceSchema.default("aggregate"),
  firmwareVersion: z.string().trim().max(40).optional(),
  hardwareRevision: z.string().trim().max(40).optional()
});

export const telemetryBatchSchema = z.object({
  gatewaySlug: z.string().trim().min(3).max(80).regex(/^[a-z0-9-]+$/),
  sentAt: z.string().datetime(),
  readings: z.array(telemetryReadingSchema).min(1).max(500)
});

export const terrariumLimitsSchema = z.object({
  minTemperatureC: z.number().min(0).max(60),
  maxTemperatureC: z.number().min(0).max(60),
  minHumidityPct: z.number().min(0).max(100),
  maxHumidityPct: z.number().min(0).max(100)
});

function refineTerrariumLimits(
  limits: {
    minTemperatureC?: number;
    maxTemperatureC?: number;
    minHumidityPct?: number;
    maxHumidityPct?: number;
  },
  ctx: z.RefinementCtx
) {
  if (
    limits.minTemperatureC !== undefined &&
    limits.maxTemperatureC !== undefined &&
    limits.minTemperatureC >= limits.maxTemperatureC
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maxTemperatureC"],
      message: "Maximum temperature must be greater than the minimum."
    });
  }

  if (
    limits.minHumidityPct !== undefined &&
    limits.maxHumidityPct !== undefined &&
    limits.minHumidityPct >= limits.maxHumidityPct
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maxHumidityPct"],
      message: "Maximum humidity must be greater than the minimum."
    });
  }
}

const terrariumSharedFields = {
  name: z.string().trim().min(1).max(120),
  speciesName: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  deviceId: z.string().trim().min(1).optional().nullable()
};

export const terrariumCreateSchema = terrariumLimitsSchema.extend(terrariumSharedFields).superRefine(refineTerrariumLimits);

export const terrariumUpdateSchema = z.object({
  name: terrariumSharedFields.name.optional(),
  speciesName: terrariumSharedFields.speciesName.optional(),
  notes: terrariumSharedFields.notes.optional(),
  deviceId: terrariumSharedFields.deviceId.optional(),
  minTemperatureC: terrariumLimitsSchema.shape.minTemperatureC.optional(),
  maxTemperatureC: terrariumLimitsSchema.shape.maxTemperatureC.optional(),
  minHumidityPct: terrariumLimitsSchema.shape.minHumidityPct.optional(),
  maxHumidityPct: terrariumLimitsSchema.shape.maxHumidityPct.optional()
}).superRefine((value, ctx) => {
  if (
    value.minTemperatureC !== undefined &&
    value.maxTemperatureC !== undefined &&
    value.minTemperatureC >= value.maxTemperatureC
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maxTemperatureC"],
      message: "Maximum temperature must be greater than the minimum."
    });
  }

  if (
    value.minHumidityPct !== undefined &&
    value.maxHumidityPct !== undefined &&
    value.minHumidityPct >= value.maxHumidityPct
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maxHumidityPct"],
      message: "Maximum humidity must be greater than the minimum."
    });
  }
});

export const historyRangeSchema = z.object({
  hours: z.coerce.number().int().min(1).max(24 * 30).default(24)
});

export const healthAlertSchema = z.object({
  id: z.string(),
  kind: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  message: z.string(),
  measuredValue: z.number().nullable(),
  thresholdValue: z.number().nullable(),
  triggeredAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable()
});

export const terrariumEventSchema = z.object({
  id: z.string(),
  type: z.enum(["button_pressed", "movement_detected"]),
  severity: z.enum(["info", "warning", "critical"]),
  message: z.string(),
  occurredAt: z.string().datetime()
});

export const deviceSummarySchema = z.object({
  id: z.string(),
  externalId: z.string(),
  gatewayId: z.string().nullable(),
  gatewayName: z.string().nullable(),
  firmwareVersion: z.string().nullable(),
  hardwareRevision: z.string().nullable(),
  lastSeenAt: z.string().datetime().nullable(),
  assignedTerrariumId: z.string().nullable()
});

export const terrariumSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  speciesName: z.string().nullable(),
  notes: z.string().nullable(),
  minTemperatureC: z.number(),
  maxTemperatureC: z.number(),
  minHumidityPct: z.number(),
  maxHumidityPct: z.number(),
  connectionStatus: terrariumConnectionStatusSchema,
  health: terrariumHealthSchema,
  device: deviceSummarySchema.nullable(),
  latestReading: z.object({
    capturedAt: z.string().datetime(),
    temperatureC: z.number().nullable(),
    humidityPct: z.number().nullable(),
    accelerationG: z.number().nullable(),
    buttonPressed: z.boolean(),
    movementDetected: z.boolean(),
    sampleCount: z.number().int()
  }).nullable(),
  activeAlerts: z.array(healthAlertSchema)
});

export const terrariumHistoryPointSchema = z.object({
  capturedAt: z.string().datetime(),
  temperatureC: z.number().nullable(),
  humidityPct: z.number().nullable(),
  accelerationG: z.number().nullable(),
  sampleCount: z.number().int(),
  movementDetected: z.boolean(),
  buttonPressed: z.boolean()
});

export const terrariumDetailSchema = terrariumSummarySchema.extend({
  history: z.array(terrariumHistoryPointSchema),
  recentEvents: z.array(terrariumEventSchema)
});

export const gatewaySummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  machineLabel: z.string().nullable(),
  softwareVersion: z.string().nullable(),
  connectionStatus: gatewayConnectionStatusSchema,
  lastSeenAt: z.string().datetime().nullable(),
  deviceCount: z.number().int(),
  terrariumCount: z.number().int()
});

export const overviewResponseSchema = z.object({
  metrics: z.object({
    terrariumCount: z.number().int(),
    connectedTerrariumCount: z.number().int(),
    disconnectedTerrariumCount: z.number().int(),
    activeAlertCount: z.number().int(),
    gatewayCount: z.number().int()
  }),
  gateways: z.array(gatewaySummarySchema),
  terrariums: z.array(terrariumSummarySchema)
});

export const TERRARIUM_STALE_AFTER_MINUTES = 5;
export const GATEWAY_DEGRADED_AFTER_MINUTES = 2;
export const GATEWAY_OFFLINE_AFTER_MINUTES = 5;

export type GatewayRegistrationRequest = z.infer<typeof gatewayRegistrationRequestSchema>;
export type GatewayRegistrationResponse = z.infer<typeof gatewayRegistrationResponseSchema>;
export type TelemetryBatch = z.infer<typeof telemetryBatchSchema>;
export type TelemetryReading = z.infer<typeof telemetryReadingSchema>;
export type TerrariumCreateInput = z.infer<typeof terrariumCreateSchema>;
export type TerrariumUpdateInput = z.infer<typeof terrariumUpdateSchema>;
export type DeviceSummary = z.infer<typeof deviceSummarySchema>;
export type TerrariumSummary = z.infer<typeof terrariumSummarySchema>;
export type TerrariumHistoryPoint = z.infer<typeof terrariumHistoryPointSchema>;
export type TerrariumEvent = z.infer<typeof terrariumEventSchema>;
export type TerrariumDetail = z.infer<typeof terrariumDetailSchema>;
export type GatewaySummary = z.infer<typeof gatewaySummarySchema>;
export type OverviewResponse = z.infer<typeof overviewResponseSchema>;
