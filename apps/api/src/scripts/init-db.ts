import { loadEnv } from "../config/env.js";
import { connectToDatabase, disconnectFromDatabase } from "../db/mongo.js";
import { allModels } from "../db/models.js";

const env = loadEnv();

async function main() {
  await connectToDatabase(env);
  await Promise.all(allModels.map((model) => model.syncIndexes()));
  // eslint-disable-next-line no-console
  console.log(`MongoDB initialized for database "${env.MONGODB_DB_NAME}".`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectFromDatabase();
  });
