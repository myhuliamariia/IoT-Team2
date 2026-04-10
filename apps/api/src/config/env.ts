import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotEnvFile } from "dotenv";
import { z } from "zod";

const currentFilePath = fileURLToPath(import.meta.url);
const apiRootMarker = `${path.sep}apps${path.sep}api${path.sep}`;
const apiRootIndex = currentFilePath.lastIndexOf(apiRootMarker);

if (apiRootIndex === -1) {
  throw new Error(`Unable to resolve the API root from path: ${currentFilePath}`);
}

const repoRoot = currentFilePath.slice(0, apiRootIndex);
const apiRoot = path.join(repoRoot, "apps", "api");
const defaultWebDistPath = path.resolve(repoRoot, "apps/web/dist");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z.string().trim().min(1).default("biot"),
  APP_BASE_URL: z.string().url().default("http://localhost:4000"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  GATEWAY_ENROLLMENT_KEY: z.string().min(12).default("change-me-enrollment-key"),
  WEB_DIST_DIR: z.string().default(defaultWebDistPath)
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  loadDotEnvFile({ path: path.resolve(repoRoot, ".env"), override: false, quiet: true });
  loadDotEnvFile({ path: path.resolve(apiRoot, ".env"), override: false, quiet: true });
  const env = envSchema.parse(source);
  process.env.MONGODB_URI = env.MONGODB_URI;
  process.env.MONGODB_DB_NAME = env.MONGODB_DB_NAME;
  return env;
}
