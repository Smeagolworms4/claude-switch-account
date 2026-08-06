# Publishing to the Chrome Web Store

Releases are automated: pushing a `v*` tag builds the zip, creates the GitHub
release, then uploads and submits the package to the Chrome Web Store.

```bash
git tag v1.0.1 && git push origin v1.0.1
```

The one-time setup below is what makes that last step work.

## 1. Create the item (manual, once)

The API can only upload **to an existing item** — it cannot create one. So the
first submission goes through the dashboard by hand:

1. Open the [developer dashboard](https://chrome.google.com/webstore/devconsole).
2. **Add new item** → upload `dist/claude-switch-account-<version>.zip`
   (run `bash tools/build.sh` to produce it).
3. Fill in the store listing, privacy declarations and permission
   justifications, then submit.
4. Copy the item's ID from its URL — that is `CWS_EXTENSION_ID`.

Required listing assets:

| Asset | Size | Notes |
| --- | --- | --- |
| Icon | 128×128 | `icons/icon128.png` |
| Small promo tile | 440×280 | mandatory |
| Screenshot | 1280×800 or 640×400 | 1 to 5, square corners, no padding |
| Marquee tile | 1400×560 | optional |

A **hosted privacy policy URL is mandatory** here: the extension stores
authentication cookies, which Google classifies as sensitive user data.

## 2. Find your publisher ID

It appears in the dashboard URL (`.../devconsole/<publisherId>`) and under
**Publisher → Settings** as the account ID. That is `CWS_PUBLISHER_ID`.

## 3. Create OAuth credentials

Nothing is configured inside the dashboard itself — API access lives in Google
Cloud. Use the **same Google account** that owns the developer account.

1. Create a project in the [Cloud Console](https://console.cloud.google.com).
2. Enable the
   [Chrome Web Store API](https://console.cloud.google.com/apis/library/chromewebstore.googleapis.com).
3. **OAuth consent screen** → type *External* → fill in the app name and
   contact e-mail → add your own address as a **test user** (this avoids the
   Google verification process, which is pointless for a single-user client).
4. **Credentials** → *Create credentials* → *OAuth client ID* → type
   *Web application* → add this authorized redirect URI:
   ```
   https://developers.google.com/oauthplayground
   ```
5. Keep the client ID and client secret: `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`.

## 4. Get a refresh token

1. Open the [OAuth Playground](https://developers.google.com/oauthplayground).
2. Gear icon → check **Use your own OAuth credentials** → paste the client ID
   and secret.
3. In the left-hand field, type the scope manually:
   ```
   https://www.googleapis.com/auth/chromewebstore
   ```
4. *Authorize APIs* → sign in → *Exchange authorization code for tokens*.
5. Copy the refresh token: `CWS_REFRESH_TOKEN`.

Refresh tokens for an app left in *Testing* on the consent screen expire after
7 days. Publish the consent screen (no verification needed for a private
client) to get a long-lived token.

## 5. Add the GitHub secrets

**Settings → Secrets and variables → Actions**, five repository secrets:

| Secret | Where it comes from |
| --- | --- |
| `CWS_CLIENT_ID` | Cloud Console OAuth client |
| `CWS_CLIENT_SECRET` | Cloud Console OAuth client |
| `CWS_REFRESH_TOKEN` | OAuth Playground |
| `CWS_PUBLISHER_ID` | dashboard URL / Publisher settings |
| `CWS_EXTENSION_ID` | item URL after the first submission |

The `publish` job skips itself when `CWS_CLIENT_ID` is absent, so forks and
tags pushed before setup still build cleanly.

## Publishing by hand

The same script runs locally:

```bash
export CWS_CLIENT_ID=... CWS_CLIENT_SECRET=... CWS_REFRESH_TOKEN=...
export CWS_PUBLISHER_ID=... CWS_EXTENSION_ID=...

bash tools/build.sh
node tools/publish-cws.mjs dist/claude-switch-account-1.0.1.zip
```

Useful switches:

- `CWS_DRY_RUN=true` — upload as a draft without submitting for review
- `CWS_PUBLISH_TYPE=STAGED_PUBLISH` with `CWS_DEPLOY_PERCENTAGE=10` — staged rollout
- `CWS_BLOCK_ON_WARNINGS=true` — abort instead of publishing when the store warns

## Review notes

Expect `state=PENDING_REVIEW` after submission — Google reviews before the
update goes live. Two things draw extra scrutiny on this extension:

- **The name.** "Claude" is an Anthropic trademark. The listing should avoid
  implying affiliation; state plainly that it is unofficial.
- **Session cookie manipulation.** This is the whole point of the extension and
  a common rejection trigger. Spell out in the permission justifications that
  everything stays local, no data leaves the browser, no remote code is loaded,
  and the source is public.

Permission justifications to reuse:

- `cookies` — read and restore claude.ai session cookies to switch accounts.
- `storage` — store the saved account profiles locally.
- `tabs` — reload open claude.ai tabs after a switch.
- host permissions — limited to claude.ai and anthropic.com, the only domains
  whose cookies are handled.

The v1 API sunsets on **2026-10-15**; `tools/publish-cws.mjs` targets v2 only.
