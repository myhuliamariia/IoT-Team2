import { loadEnv } from "../config/env.js";
import { connectToDatabase, disconnectFromDatabase } from "../db/mongo.js";
import { TerrariumModel } from "../db/models.js";

const env = loadEnv();

async function main() {
  await connectToDatabase(env);

  const terrariums = [
    {
      name: "Panther Chameleon",
      speciesName: "Furcifer pardalis",
      notes: "Warm terrarium kept as the connected demo profile.",
      minTemperatureC: 24,
      maxTemperatureC: 29,
      minHumidityPct: 55,
      maxHumidityPct: 75
    },
    {
      name: "Crested Gecko",
      speciesName: "Correlophus ciliatus",
      notes: "Unassigned profile used to demonstrate the disconnected-device scenario.",
      minTemperatureC: 21,
      maxTemperatureC: 26,
      minHumidityPct: 60,
      maxHumidityPct: 85
    }
  ];

  for (const terrarium of terrariums) {
    await TerrariumModel.findOneAndUpdate(
      { name: terrarium.name },
      terrarium,
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
  }

  // eslint-disable-next-line no-console
  console.log("Seed data written to MongoDB.");
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
