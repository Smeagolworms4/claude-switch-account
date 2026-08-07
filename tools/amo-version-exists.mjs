#!/usr/bin/env node
/**
 * Prints "exists" or "new" for the manifest version on addons.mozilla.org.
 *
 * The two stores drift: a version can already be on AMO while Chrome still
 * needs it (or the reverse). AMO rejects a duplicate version number outright,
 * so the release job checks first and skips instead of failing the build.
 *
 * Required env: AMO_JWT_ISSUER, AMO_JWT_SECRET
 */

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const issuer = process.env.AMO_JWT_ISSUER;
const secret = process.env.AMO_JWT_SECRET;
if (!issuer || !secret) {
  console.error("missing AMO_JWT_ISSUER / AMO_JWT_SECRET");
  process.exit(2);
}

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const version = manifest.version;
const addonId = manifest.browser_specific_settings?.gecko?.id;
if (!addonId) {
  console.error("manifest has no browser_specific_settings.gecko.id");
  process.exit(2);
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const head = b64({ alg: "HS256", typ: "JWT" });
const body = b64({ iss: issuer, jti: String(Math.random()), iat: now, exp: now + 120 });
const jwt = `${head}.${body}.${createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url")}`;

const res = await fetch(
  `https://addons.mozilla.org/api/v5/addons/addon/${addonId}/versions/?filter=all_with_unlisted`,
  { headers: { Authorization: `JWT ${jwt}` } }
);

// A brand new add-on has no versions endpoint yet — nothing can clash.
if (res.status === 404) {
  console.log("new");
  process.exit(0);
}
if (!res.ok) {
  console.error(`AMO returned ${res.status}; assuming the version is new`);
  console.log("new");
  process.exit(0);
}

const { results = [] } = await res.json();
const clash = results.some((v) => v.version === version);
console.error(`AMO has ${results.length} version(s): ${results.map((v) => v.version).join(", ") || "none"}`);
console.log(clash ? "exists" : "new");
