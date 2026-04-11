import "dotenv/config";

const cloudBaseUrl = process.env.CLOUD_BASE_URL ?? "http://localhost:4000";
const enrollmentKey = process.env.GATEWAY_ENROLLMENT_KEY;
const gatewayName = process.env.GATEWAY_NAME ?? "Terrarium Gateway";
const gatewaySlug = process.env.GATEWAY_SLUG ?? "terrarium-gateway-01";
const machineLabel = process.env.MACHINE_LABEL ?? "Windows Laptop Gateway";
const softwareVersion = process.env.SOFTWARE_VERSION ?? "1.0.0";

if (!enrollmentKey) {
  console.error("Missing GATEWAY_ENROLLMENT_KEY in the environment.");
  process.exit(1);
}

const response = await fetch(`${cloudBaseUrl}/api/v1/gateways/register`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    enrollmentKey,
    gatewayName,
    gatewaySlug,
    machineLabel,
    softwareVersion
  })
});

if (!response.ok) {
  console.error(`Gateway registration failed with ${response.status}.`);
  console.error(await response.text());
  process.exit(1);
}

const payload = await response.json();

console.log("Gateway registration succeeded.");
console.log("");
console.log("Use these environment variables in Node-RED:");
console.log(`API_BASE_URL=${cloudBaseUrl}`);
console.log(`GATEWAY_SLUG=${payload.gatewaySlug}`);
console.log(`GATEWAY_API_KEY=${payload.apiKey}`);
