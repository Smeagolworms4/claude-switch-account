#!/usr/bin/env bash
# Builds dist/claude-switch-account-<version>.zip, ready to load or publish.
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="${1:-$(node -p "require('./manifest.json').version")}"
OUT="dist/claude-switch-account-${VERSION}.zip"

# An MV3 manifest without default_locale breaks every __MSG_*__, so check first.
node -e '
  const m = require("./manifest.json");
  if (!m.default_locale) throw new Error("manifest.default_locale is missing");
  const fs = require("fs");
  for (const l of fs.readdirSync("_locales")) JSON.parse(fs.readFileSync(`_locales/${l}/messages.json`));
  console.log(`manifest v${m.version} ok - locales: ${fs.readdirSync("_locales").join(", ")}`);
'

rm -rf dist
mkdir -p dist

zip -r -q "$OUT" \
  manifest.json background.js popup.html popup.css popup.js \
  _locales icons \
  -x '*.DS_Store'

echo "-> $OUT ($(du -h "$OUT" | cut -f1))"
