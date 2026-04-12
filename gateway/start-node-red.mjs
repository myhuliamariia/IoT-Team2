import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageJsonPath = require.resolve("node-red/package.json");
const nodeRedRoot = path.dirname(packageJsonPath);
const nodeRedPackage = require(packageJsonPath);

const candidateRelativePaths = [
  typeof nodeRedPackage.bin === "string" ? nodeRedPackage.bin : nodeRedPackage.bin?.["node-red"],
  "red.js",
  "packages/node_modules/node-red/red.js"
].filter(Boolean);

const redScriptPath = candidateRelativePaths
  .map((relativePath) => path.resolve(nodeRedRoot, relativePath))
  .find((candidatePath) => fs.existsSync(candidatePath));

if (!redScriptPath) {
  throw new Error(`Unable to locate the Node-RED entry script from ${packageJsonPath}.`);
}

const userDir = path.resolve(".node-red");
fs.mkdirSync(userDir, { recursive: true });
fs.writeFileSync(
  path.join(userDir, "package.json"),
  `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`,
  "utf8"
);

const bundledFlowPath = path.resolve("flows", "terrarium-gateway.json");
const runtimeFlowPath = path.join(userDir, "flows.json");

if (fs.existsSync(bundledFlowPath) && !fs.existsSync(runtimeFlowPath)) {
  fs.copyFileSync(bundledFlowPath, runtimeFlowPath);
}

const child = spawn(process.execPath, [redScriptPath, "--userDir", userDir], {
  stdio: "inherit",
  env: process.env
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
