# Firefox support

The same package runs on both browsers — there is no separate Firefox build.
`manifest.json` declares what each engine needs and each ignores the other's
keys:

```json
"background": {
  "service_worker": "background.js",   // Chrome
  "type": "module",                    // Chrome
  "scripts": ["background.js"]         // Firefox (event page)
},
"browser_specific_settings": {
  "gecko": {
    "id": "claude-switch-account@smeagolworms4",
    "strict_min_version": "140.0",
    "data_collection_permissions": { "required": ["none"] }
  }
}
```

Firefox has no Manifest V3 service worker: it runs an event page from
`background.scripts`. `background.js` has no imports, so it loads fine both as
an ES module (Chrome) and as a classic script (Firefox).

No JavaScript changes were needed. Every API the extension uses — `cookies`,
`storage`, `tabs`, `windows`, `runtime` — exists in Firefox, and the `chrome.*`
namespace is aliased there, callbacks included.

`strict_min_version` is 140 because `data_collection_permissions` (required by
AMO for new extensions) is not understood by older builds. Dropping that key
would allow older Firefox versions at the cost of an AMO warning.

## Testing locally

`web-ext run` does not work against a **snap-packaged** Firefox: snap
confinement blocks the remote debugging port and web-ext fails with
`ECONNREFUSED`. Use the manual route instead.

1. `bash tools/build.sh`
2. Open `about:debugging#/runtime/this-firefox`
3. **Load Temporary Add-on…** → pick `dist/claude-switch-account-<version>.zip`
   (or `manifest.json` from the source tree)
4. The extension stays until Firefox is restarted.

Its console is behind the **Inspect** button on the add-on card, which opens a
dedicated devtools window for the background page — the equivalent of Chrome's
"service worker" link.

With a non-snap Firefox, `npx web-ext run --source-dir .` works and reloads on
every file change.

## Linting

```bash
npx web-ext lint --source-dir dist-unpacked
```

Lint the *built* package, not the source tree, otherwise `tools/` and `docs/`
raise `FLAGGED_FILE_EXTENSION`. Current state: **0 errors**, 2 warnings:

- `BACKGROUND_SERVICE_WORKER_IGNORED` — expected, it is the Chrome key;
- `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` — Firefox for Android needs
  a higher minimum for the data-collection key. Desktop is unaffected.

## Publishing to AMO

Unlike the Chrome Web Store, the first submission can be done entirely through
the API — no manual item creation.

1. Get API credentials (JWT issuer + secret) at
   [addons.mozilla.org/developers/addon/api/key](https://addons.mozilla.org/en-US/developers/addon/api/key/).
2. Store them as `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` repository secrets.
3. Sign and publish:

   ```bash
   npx web-ext sign --source-dir dist-unpacked \
     --api-key "$AMO_JWT_ISSUER" --api-secret "$AMO_JWT_SECRET" \
     --channel listed
   ```

`--channel listed` publishes on AMO; `unlisted` only signs the package for
self-distribution.

Wiring this into `.github/workflows/build.yml` mirrors the Chrome job: a step
gated on `AMO_JWT_ISSUER` being present, running on `v*` tags.

## Is it worth it?

Firefox ships **Multi-Account Containers** natively, which solves the same
problem better: several accounts open *simultaneously* in different tabs, where
this extension switches between them one at a time. On Chrome the extension
fills a real gap; on Firefox it competes with a built-in feature and only wins
on convenience — one click in a popup versus managing containers by hand.

One upside: the extension preserves each cookie's `storeId`, which in Firefox
is the container identifier. Switching therefore works inside containers
without extra work.
