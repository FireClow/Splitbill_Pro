#!/usr/bin/env node

const requiredVars = [
  "EXPO_PUBLIC_BACKEND_URL",
  "EXPO_PUBLIC_PRIVACY_POLICY_URL",
  "EXPO_PUBLIC_TERMS_URL",
];

const localhostHosts = new Set(["localhost", "127.0.0.1", "10.0.2.2"]);
const uniqueErrors = new Set();

function addError(message) {
  uniqueErrors.add(message);
}

function validateHttpsUrl(name, value) {
  if (!value) {
    addError(`${name} is missing.`);
    return;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    addError(`${name} is not a valid URL: ${value}`);
    return;
  }

  if (parsed.protocol !== "https:") {
    addError(`${name} must use https in production: ${value}`);
  }

  if (localhostHosts.has(parsed.hostname)) {
    addError(`${name} cannot point to localhost-like host in production: ${value}`);
  }
}

for (const variable of requiredVars) {
  if (!process.env[variable] || process.env[variable].trim().length === 0) {
    addError(`${variable} is missing.`);
  }
}

validateHttpsUrl("EXPO_PUBLIC_BACKEND_URL", process.env.EXPO_PUBLIC_BACKEND_URL);
validateHttpsUrl("EXPO_PUBLIC_PRIVACY_POLICY_URL", process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL);
validateHttpsUrl("EXPO_PUBLIC_TERMS_URL", process.env.EXPO_PUBLIC_TERMS_URL);

const errors = Array.from(uniqueErrors);

if (errors.length > 0) {
  console.error("[release-env] Validation failed:\n");
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  process.exit(1);
}

console.log("[release-env] Validation passed.");
