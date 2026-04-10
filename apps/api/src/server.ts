import { loadEnv } from "./config/env.js";
import { createApp } from "./app.js";
import { connectToDatabase, disconnectFromDatabase } from "./db/mongo.js";

const env = loadEnv();
await connectToDatabase(env);
const app = createApp(env);

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on ${env.APP_BASE_URL}`);
});

const shutdown = async () => {
  server.close(async () => {
    await disconnectFromDatabase();
    process.exit(0);
  });
};

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
