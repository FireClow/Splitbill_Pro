#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const requiredVars = [
  "EXPO_PUBLIC_BACKEND_URL",
  "EXPO_PUBLIC_PRIVACY_POLICY_URL",
  "EXPO_PUBLIC_TERMS_URL",
  "EXPO_PUBLIC_ADMOB_ANDROID_APP_ID",
  "EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID",
  "EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID",
  "EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_ID",
];

const localhostHosts = new Set(["localhost", "127.0.0.1", "10.0.2.2"]);
const uniqueErrors = new Set();

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, "utf8");
  const env = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }

  return env;
}

const envFileOrder = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
];

const mergedEnvFromFiles = envFileOrder.reduce((acc, fileName) => {
  const filePath = path.join(process.cwd(), fileName);
  return { ...acc, ...loadDotEnvFile(filePath) };
}, {});

const processEnvValues = {
  EXPO_PUBLIC_BACKEND_URL: process.env.EXPO_PUBLIC_BACKEND_URL,
  EXPO_PUBLIC_PRIVACY_POLICY_URL: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
  EXPO_PUBLIC_TERMS_URL: process.env.EXPO_PUBLIC_TERMS_URL,
  EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID,
  EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID: process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID,
  EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID: process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID,
  EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_ID: process.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_ID,
  EXPO_PUBLIC_ADMOB_USE_TEST_IDS: process.env.EXPO_PUBLIC_ADMOB_USE_TEST_IDS,
};

const getEnvValue = (name) => {
  const direct = processEnvValues[name];
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct.trim();
  }

  const fromFile = mergedEnvFromFiles[name];
  if (typeof fromFile === "string" && fromFile.trim().length > 0) {
    return fromFile.trim();
  }

  return "";
};

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

function validateAdMobId(name, value, kind) {
  if (!value) {
    addError(`${name} is missing.`);
    return;
  }

  const testPublisher = "3940256099942544";
  if (value.includes(testPublisher)) {
    addError(`${name} uses Google test id and cannot be used in production: ${value}`);
  }

  const appIdPattern = /^ca-app-pub-\d{16}~\d{10}$/;
  const unitIdPattern = /^ca-app-pub-\d{16}\/\d{10}$/;
  const pattern = kind === "app" ? appIdPattern : unitIdPattern;

  if (!pattern.test(value)) {
    addError(`${name} has invalid AdMob format: ${value}`);
  }
}

for (const variable of requiredVars) {
  if (!getEnvValue(variable)) {
    addError(`${variable} is missing.`);
  }
}

validateHttpsUrl("EXPO_PUBLIC_BACKEND_URL", getEnvValue("EXPO_PUBLIC_BACKEND_URL"));
validateHttpsUrl("EXPO_PUBLIC_PRIVACY_POLICY_URL", getEnvValue("EXPO_PUBLIC_PRIVACY_POLICY_URL"));
validateHttpsUrl("EXPO_PUBLIC_TERMS_URL", getEnvValue("EXPO_PUBLIC_TERMS_URL"));
validateAdMobId("EXPO_PUBLIC_ADMOB_ANDROID_APP_ID", getEnvValue("EXPO_PUBLIC_ADMOB_ANDROID_APP_ID"), "app");
validateAdMobId("EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID", getEnvValue("EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID"), "unit");
validateAdMobId("EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID", getEnvValue("EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID"), "unit");
validateAdMobId("EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_ID", getEnvValue("EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_ID"), "unit");

if (getEnvValue("EXPO_PUBLIC_ADMOB_USE_TEST_IDS").toLowerCase() === "true") {
  addError("EXPO_PUBLIC_ADMOB_USE_TEST_IDS must be false for production release.");
}

const errors = Array.from(uniqueErrors);

if (errors.length > 0) {
  console.error("[release-env] Validation failed:\n");
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  process.exit(1);
}

console.log("[release-env] Validation passed.");
