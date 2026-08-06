#!/usr/bin/env bash
# Construit dist/claude-switch-account-<version>.zip prêt à charger / publier.
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="${1:-$(node -p "require('./manifest.json').version")}"
OUT="dist/claude-switch-account-${VERSION}.zip"

# Un manifest v3 sans default_locale casse les __MSG_*__ : on vérifie avant de packager.
node -e '
  const m = require("./manifest.json");
  if (!m.default_locale) throw new Error("manifest.default_locale manquant");
  const fs = require("fs");
  for (const l of fs.readdirSync("_locales")) JSON.parse(fs.readFileSync(`_locales/${l}/messages.json`));
  console.log(`manifest v${m.version} ok — locales: ${fs.readdirSync("_locales").join(", ")}`);
'

rm -rf dist
mkdir -p dist

zip -r -q "$OUT" \
  manifest.json background.js popup.html popup.css popup.js \
  _locales icons \
  -x '*.DS_Store'

echo "→ $OUT ($(du -h "$OUT" | cut -f1))"
