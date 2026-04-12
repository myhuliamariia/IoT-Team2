import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Express } from "express";

process.env.NODE_ENV = "test";
process.env.GATEWAY_ENROLLMENT_KEY = "test-enrollment-key-123";
process.env.APP_BASE_URL = "http://localhost:4000";
process.env.CORS_ORIGIN = "http://localhost:5173";

const { loadEnv } = await import("../config/env.js");
const { createApp } = await import("../app.js");
const { connectToDatabase, disconnectFromDatabase } = await import("../db/mongo.js");
const {
  AlertModel,
  DeviceEventModel,
  DeviceModel,
  GatewayModel,
  IngestBatchModel,
  SensorReadingModel,
  TerrariumModel
} = await import("../db/models.js");

let app: Express;
let mongoServer: MongoMemoryServer;

describe("Terrarium API", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.MONGODB_DB_NAME = "biot_test";
    const env = loadEnv(process.env);
    await connectToDatabase(env);
    app = createApp(env);
  });

  beforeEach(async () => {
    await Promise.all([
      AlertModel.deleteMany({}),
      DeviceEventModel.deleteMany({}),
      SensorReadingModel.deleteMany({}),
      IngestBatchModel.deleteMany({}),
      TerrariumModel.deleteMany({}),
      DeviceModel.deleteMany({}),
      GatewayModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    await disconnectFromDatabase();
    await mongoServer.stop();
  });

  it("creates terrariums and rejects duplicate names", async () => {
    const payload = {
      name: "Crested Gecko",
      speciesName: "Correlophus ciliatus",
      minTemperatureC: 22,
      maxTemperatureC: 26,
      minHumidityPct: 60,
      maxHumidityPct: 82,
      deviceId: null
    };

    const first = await request(app).post("/api/v1/terrariums").send(payload);
    expect(first.status).toBe(201);
    expect(first.body.connectionStatus).toBe("disconnected");

    const second = await request(app).post("/api/v1/terrariums").send(payload);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("terrarium.duplicate_name");
  });

  it("registers a gateway, discovers a device, and links telemetry to a terrarium", async () => {
    const registration = await request(app).post("/api/v1/gateways/register").send({
      enrollmentKey: "test-enrollment-key-123",
      gatewayName: "Laptop Gateway",
      gatewaySlug: "laptop-gateway",
      machineLabel: "Windows test host",
      softwareVersion: "1.0.0"
    });

    expect(registration.status).toBe(201);
    expect(registration.body.apiKey).toMatch(/^gw_/);

    const terrarium = await request(app).post("/api/v1/terrariums").send({
      name: "Panther Chameleon",
      speciesName: "Furcifer pardalis",
      minTemperatureC: 24,
      maxTemperatureC: 29,
      minHumidityPct: 55,
      maxHumidityPct: 75,
      deviceId: null
    });

    expect(terrarium.status).toBe(201);

    const firstIngest = await request(app)
      .post("/api/v1/ingest/telemetry")
      .set("Authorization", `Bearer ${registration.body.apiKey}`)
      .send({
        gatewaySlug: "laptop-gateway",
        sentAt: new Date().toISOString(),
        readings: [
          {
            deviceExternalId: "cm-test-01",
            capturedAt: new Date().toISOString(),
            temperatureC: 26.3,
            humidityPct: 64.4,
            accelerationG: 1.02,
            movementDetected: false,
            buttonPressed: false,
            sampleCount: 1,
            source: "aggregate",
            firmwareVersion: "1.0.0",
            hardwareRevision: "core-module-r2"
          }
        ]
      });

    expect(firstIngest.status).toBe(202);

    const devices = await request(app).get("/api/v1/devices");
    expect(devices.status).toBe(200);
    expect(devices.body).toHaveLength(1);
    expect(devices.body[0].assignedTerrariumId).toBeNull();

    const updateTerrarium = await request(app)
      .patch(`/api/v1/terrariums/${terrarium.body.id}`)
      .send({
        deviceId: devices.body[0].id
      });

    expect(updateTerrarium.status).toBe(200);
    expect(updateTerrarium.body.device.externalId).toBe("cm-test-01");

    const secondIngest = await request(app)
      .post("/api/v1/ingest/telemetry")
      .set("Authorization", `Bearer ${registration.body.apiKey}`)
      .send({
        gatewaySlug: "laptop-gateway",
        sentAt: new Date().toISOString(),
        readings: [
          {
            deviceExternalId: "cm-test-01",
            capturedAt: new Date().toISOString(),
            temperatureC: 27.1,
            humidityPct: 68.9,
            accelerationG: 1.05,
            movementDetected: false,
            buttonPressed: false,
            sampleCount: 6,
            source: "aggregate",
            firmwareVersion: "1.0.0",
            hardwareRevision: "core-module-r2"
          }
        ]
      });

    expect(secondIngest.status).toBe(202);

    const detail = await request(app).get(`/api/v1/terrariums/${terrarium.body.id}?hours=24`);
    expect(detail.status).toBe(200);
    expect(detail.body.connectionStatus).toBe("connected");
    expect(detail.body.latestReading.temperatureC).toBe(27.1);
    expect(detail.body.history.length).toBeGreaterThan(0);
  });

  it("rejects partial updates that would make terrarium limits invalid", async () => {
    const terrarium = await request(app).post("/api/v1/terrariums").send({
      name: "Boa Enclosure",
      speciesName: "Boa imperator",
      minTemperatureC: 24,
      maxTemperatureC: 29,
      minHumidityPct: 55,
      maxHumidityPct: 75,
      deviceId: null
    });

    expect(terrarium.status).toBe(201);

    const invalidTemperatureUpdate = await request(app)
      .patch(`/api/v1/terrariums/${terrarium.body.id}`)
      .send({
        maxTemperatureC: 20
      });

    expect(invalidTemperatureUpdate.status).toBe(400);
    expect(invalidTemperatureUpdate.body.error.code).toBe("validation.failed");

    const invalidHumidityUpdate = await request(app)
      .patch(`/api/v1/terrariums/${terrarium.body.id}`)
      .send({
        maxHumidityPct: 50
      });

    expect(invalidHumidityUpdate.status).toBe(400);
    expect(invalidHumidityUpdate.body.error.code).toBe("validation.failed");

    const detail = await request(app).get(`/api/v1/terrariums/${terrarium.body.id}?hours=24`);
    expect(detail.status).toBe(200);
    expect(detail.body.minTemperatureC).toBe(24);
    expect(detail.body.maxTemperatureC).toBe(29);
    expect(detail.body.minHumidityPct).toBe(55);
    expect(detail.body.maxHumidityPct).toBe(75);
  });
});
