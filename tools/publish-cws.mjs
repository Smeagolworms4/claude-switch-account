#!/usr/bin/env node
/**
 * Uploads and publishes the packaged extension through the Chrome Web Store
 * API v2. The v1 API sunsets on 2026-10-15, so this targets v2 only.
 *
 *   node tools/publish-cws.mjs dist/claude-switch-account-1.0.1.zip
 *
 * Required env: CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN,
 *               CWS_PUBLISHER_ID, CWS_EXTENSION_ID
 * Optional env: CWS_PUBLISH_TYPE      DEFAULT_PUBLISH (default) | STAGED_PUBLISH
 *               CWS_DEPLOY_PERCENTAGE 1-100, only with STAGED_PUBLISH
 *               CWS_BLOCK_ON_WARNINGS "true" to abort when the store warns
 *               CWS_DRY_RUN           "true" to upload without publishing
 */

import { readFile } from "node:fs/promises";

const API = "https://chromewebstore.googleapis.com";
const REQUIRED = [
  "CWS_CLIENT_ID",
  "CWS_CLIENT_SECRET",
  "CWS_REFRESH_TOKEN",
  "CWS_PUBLISHER_ID",
  "CWS_EXTENSION_ID"
];

const env = process.env;
const zipPath = process.argv[2];

if (!zipPath) fail("usage: node tools/publish-cws.mjs <package.zip>");

const missing = REQUIRED.filter((k) => !env[k]);
if (missing.length) fail(`missing environment variables: ${missing.join(", ")}`);

const NAME = `publishers/${env.CWS_PUBLISHER_ID}/items/${env.CWS_EXTENSION_ID}`;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Google returns errors as JSON; surface them instead of a bare status code. */
async function readError(res) {
  const body = await res.text();
  try {
    const json = JSON.parse(body);
    return json.error?.message || body;
  } catch {
    return body || `HTTP ${res.status}`;
  }
}

async function accessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.CWS_CLIENT_ID,
      client_secret: env.CWS_CLIENT_SECRET,
      refresh_token: env.CWS_REFRESH_TOKEN,
      grant_type: "refresh_token"
    })
  });
  if (!res.ok) fail(`token refresh failed: ${await readError(res)}`);
  const { access_token: token } = await res.json();
  if (!token) fail("token refresh returned no access_token");
  return token;
}

async function upload(token) {
  const pkg = await readFile(zipPath);
  console.log(`→ uploading ${zipPath} (${(pkg.length / 1024).toFixed(0)} KB)`);

  const res = await fetch(`${API}/upload/v2/${NAME}:upload?uploadType=media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/zip" },
    body: pkg
  });
  if (!res.ok) fail(`upload failed: ${await readError(res)}`);

  const result = await res.json();
  if (result.uploadState === "FAILED") {
    fail(`upload rejected: ${JSON.stringify(result)}`);
  }
  return result;
}

/**
 * Best-effort wait for the store to finish ingesting the package.
 *
 * fetchStatus is unreliable: it can keep omitting lastAsyncUploadState long
 * after the upload call itself returned SUCCEEDED and the package is visible
 * in the console. So this only ever *fails* on an explicit FAILED state — an
 * absent or stuck IN_PROGRESS state is reported and we go ahead and publish,
 * letting the publish call be the real verdict.
 */
async function waitForUpload(token, attempts = 18) {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(`${API}/v2/${NAME}:fetchStatus`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      console.log(`  fetchStatus unavailable (${res.status}), continuing`);
      return null;
    }

    const status = await res.json();
    const state = status.lastAsyncUploadState;

    if (state === "SUCCEEDED") return status;
    if (state === "FAILED") fail(`upload FAILED: ${JSON.stringify(status)}`);

    await sleep(10_000);
  }
  console.log("⚠ fetchStatus never confirmed ingestion — publishing anyway");
  return null;
}

async function publish(token) {
  const publishType = env.CWS_PUBLISH_TYPE || "DEFAULT_PUBLISH";
  const body = {
    publishType,
    blockOnWarnings: env.CWS_BLOCK_ON_WARNINGS === "true"
  };

  if (publishType === "STAGED_PUBLISH") {
    const pct = Number(env.CWS_DEPLOY_PERCENTAGE);
    if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
      fail("STAGED_PUBLISH requires CWS_DEPLOY_PERCENTAGE between 1 and 100");
    }
    body.deployInfos = [{ deployPercentage: pct }];
  }

  console.log(`→ publishing (${publishType})`);
  const res = await fetch(`${API}/v2/${NAME}:publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) fail(`publish failed: ${await readError(res)}`);
  return res.json();
}

const token = await accessToken();
const uploaded = await upload(token);
console.log(`  uploadState=${uploaded.uploadState} version=${uploaded.crxVersion ?? "?"}`);

const status = await waitForUpload(token);
if (status?.warned) {
  console.log("⚠ the store flagged warnings on this revision");
}

if (env.CWS_DRY_RUN === "true") {
  console.log("✓ uploaded as a draft (CWS_DRY_RUN=true, not published)");
  process.exit(0);
}

const published = await publish(token);
for (const w of published.warningInfo?.warnings ?? []) {
  console.log(`⚠ ${w.reason}: ${w.description}`);
}

// PENDING_REVIEW is the normal outcome: Google reviews before it goes live.
console.log(`✓ submitted — state=${published.state}`);
if (published.state === "REJECTED") process.exit(1);
