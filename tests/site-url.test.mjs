import assert from "node:assert/strict";
import test from "node:test";

import { getEmailAssetOrigin, getSiteUrl, PRODUCTION_SITE_ORIGIN } from "../src/lib/env.ts";

const original = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_URL: process.env.VERCEL_URL,
  VERCEL: process.env.VERCEL,
  EMAIL_ASSET_ORIGIN: process.env.EMAIL_ASSET_ORIGIN,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test("email images never point at localhost or a protected preview", () => {
  try {
    for (const key of Object.keys(original)) delete process.env[key];

    // Local development without any public URL falls back to production.
    process.env.NODE_ENV = "development";
    assert.equal(getSiteUrl(), "http://localhost:3000");
    assert.equal(getEmailAssetOrigin(), PRODUCTION_SITE_ORIGIN);

    // An HTTP dev site URL is not a usable image host either.
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    assert.equal(getEmailAssetOrigin(), PRODUCTION_SITE_ORIGIN);

    // A public HTTPS site URL hosts its own assets.
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.example.com/";
    assert.equal(getEmailAssetOrigin(), "https://staging.example.com");

    // Explicit override wins; a path or trailing slash is normalised away.
    process.env.EMAIL_ASSET_ORIGIN = "https://cdn.example.com/ignored/";
    assert.equal(getEmailAssetOrigin(), "https://cdn.example.com");

    // Locally an HTTP override is allowed for previewing new assets…
    process.env.EMAIL_ASSET_ORIGIN = "http://localhost:3000";
    assert.equal(getEmailAssetOrigin(), "http://localhost:3000");

    // …but production refuses anything that is not HTTPS.
    process.env.NODE_ENV = "production";
    assert.throws(() => getEmailAssetOrigin(), /EMAIL_ASSET_ORIGIN/);
    process.env.EMAIL_ASSET_ORIGIN = "ftp://cdn.example.com";
    assert.throws(() => getEmailAssetOrigin(), /EMAIL_ASSET_ORIGIN/);

    // Production with a misconfigured HTTP site URL uses Vercel's public domain.
    delete process.env.EMAIL_ASSET_ORIGIN;
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "samuelssoncuts.sk";
    assert.equal(getEmailAssetOrigin(), "https://samuelssoncuts.sk");
  } finally {
    restoreEnv();
  }
});

test("production links never use a local or deployment-specific URL", () => {
  try {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "samuelssoncuts.sk";
    process.env.VERCEL_URL = "protected-preview.vercel.app";
    process.env.VERCEL = "1";
    assert.equal(getSiteUrl(), "https://samuelssoncuts.sk");

    process.env.NEXT_PUBLIC_SITE_URL = "https://samuelssoncuts.sk/";
    assert.equal(getSiteUrl(), "https://samuelssoncuts.sk");

    process.env.NEXT_PUBLIC_SITE_URL = "http://samuelssoncuts.sk";
    assert.equal(getSiteUrl(), "https://samuelssoncuts.sk");

    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    assert.throws(() => getSiteUrl(), /public site URL/i);
  } finally {
    restoreEnv();
  }
});
