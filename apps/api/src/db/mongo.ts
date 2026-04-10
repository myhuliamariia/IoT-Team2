import mongoose from "mongoose";
import type { AppEnv } from "../config/env.js";

declare global {
  // eslint-disable-next-line no-var
  var __biotMongoConnectionPromise__: Promise<typeof mongoose> | undefined;
}

const MAX_CONNECT_ATTEMPTS = 5;
const RETRY_DELAY_MS = 2_000;

function delay(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function openConnection(env: AppEnv) {
  return mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
    autoIndex: true,
    family: 4,
    serverSelectionTimeoutMS: 15_000,
    connectTimeoutMS: 15_000
  });
}

async function connectWithRetry(env: AppEnv): Promise<typeof mongoose> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt += 1) {
    try {
      return await openConnection(env);
    } catch (error) {
      lastError = error;
      await mongoose.disconnect().catch(() => undefined);

      if (attempt === MAX_CONNECT_ATTEMPTS) {
        break;
      }

      // Atlas free-tier clusters can take longer to become selectable after idle periods.
      console.warn(
        `MongoDB connection attempt ${attempt}/${MAX_CONNECT_ATTEMPTS} failed. Retrying in ${RETRY_DELAY_MS}ms.`
      );
      await delay(RETRY_DELAY_MS);
    }
  }

  throw lastError;
}

export async function connectToDatabase(env: AppEnv): Promise<void> {
  if (!globalThis.__biotMongoConnectionPromise__) {
    globalThis.__biotMongoConnectionPromise__ = connectWithRetry(env);
  }

  try {
    await globalThis.__biotMongoConnectionPromise__;
  } catch (error) {
    globalThis.__biotMongoConnectionPromise__ = undefined;
    throw error;
  }
}

export async function disconnectFromDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  globalThis.__biotMongoConnectionPromise__ = undefined;
}
