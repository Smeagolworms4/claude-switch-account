# Claude Switch Account

Browser extension (Manifest V3) to keep **several claude.ai accounts** side by side and switch between them **in one click** — no logging out and back in every time.

[![build](https://github.com/Smeagolworms4/claude-switch-account/actions/workflows/build.yml/badge.svg)](https://github.com/Smeagolworms4/claude-switch-account/actions/workflows/build.yml)

[!["Buy Me A Coffee"](https://raw.githubusercontent.com/Smeagolworms4/donate-assets/master/coffee.png)](https://www.buymeacoffee.com/smeagolworms4)
[!["Buy Me A Coffee"](https://raw.githubusercontent.com/Smeagolworms4/donate-assets/master/paypal.png)](https://www.paypal.com/donate/?business=SURRPGEXF4YVU&no_recurring=0&item_name=Hello%2C+I%27m+SmeagolWorms4.+For+my+open+source+projects.%0AThanks+you+very+mutch+%21%21%21&currency_code=EUR)

**English** · [Français](README.fr.md)

<p align="center">
  <img src="docs/screenshot.png" alt="The extension popup listing three saved accounts, with the active one highlighted" width="380">
</p>

---

## How it works

claude.ai authentication lives in cookies (`sessionKey` chief among them). The extension:

1. **snapshots** every `claude.ai` / `anthropic.com` cookie into a profile;
2. fetches the account **name and e-mail** from the claude.ai API to label it automatically;
3. on switching: re-saves the current session (the `sessionKey` rotates), clears the jar, restores the target profile's cookies, then reloads any open claude.ai tab.

Everything stays **local** in `chrome.storage.local`. No server, no telemetry, no passwords — only the cookies your browser already holds.

## Install

### From a release

1. Download the `.zip` from [Releases](https://github.com/Smeagolworms4/claude-switch-account/releases) and unzip it.
2. Open `chrome://extensions` (or `brave://extensions`, `edge://extensions`).
3. Enable **Developer mode**.
4. **Load unpacked** → pick the unzipped folder.

### From source

```bash
git clone https://github.com/Smeagolworms4/claude-switch-account.git
cd claude-switch-account
```

Then load the folder directly with **Load unpacked**. There is no build step: plain JS, zero dependencies.

## Usage

| Action | Effect |
| --- | --- |
| **＋ Save current session** | Adds the logged-in account to the list (name + e-mail detected automatically) |
| **Click an account** | Switches to it and reloads claude.ai tabs |
| **⇥ New login** | Clears the session without deleting profiles — to add another account |
| **↻ Refresh active account** | Re-saves the active account's cookies (handy after re-authenticating) |
| **✎ / 🗑** | Rename / delete a profile |

### Adding a second account

1. Log into account A on claude.ai → **＋ Save current session**.
2. **⇥ New login** → log into account B.
3. **＋ Save current session**.
4. Both accounts now sit in the list; one click switches between them.

## Languages

UI translated through `chrome.i18n`, auto-selected from the browser language:

🇬🇧 English (default) · 🇫🇷 Français · 🇩🇪 Deutsch · 🇪🇸 Español · 🇮🇹 Italiano · 🇵🇹 Português

Adding a language = copy `_locales/en/messages.json` to `_locales/<code>/messages.json`. CI enforces that every locale carries exactly the same keys.

## Development

```
manifest.json          # MV3, cookies/storage/tabs permissions
background.js          # service worker: cookie snapshot / clear / restore
popup.html/.css/.js    # account list UI
_locales/<lang>/       # translations
icons/                 # generated icons
tools/build.sh         # produces dist/claude-switch-account-<version>.zip
tools/make-icons.py    # regenerates the icons (needs Pillow)
```

```bash
bash tools/build.sh          # package
python3 tools/make-icons.py  # regenerate icons
```

### CI

`.github/workflows/build.yml` runs on every push, PR and tag:

- validates the manifest and **translation key parity** across all locales;
- checks JS syntax (`node --check`);
- builds the zip and uploads it as a downloadable **artifact**;
- on a `v*` tag: aligns `manifest.version` with the tag, creates the **GitHub release** with the zip attached, then publishes to the Chrome Web Store.

Cutting a release:

```bash
git tag v1.0.1 && git push origin v1.0.1
```

The one-time setup for automated publishing is documented in
[docs/PUBLISHING.md](docs/PUBLISHING.md).

## Security & limitations

- Session cookies are stored **in plaintext** in the extension's local storage — same as your browser's cookie jar. On a shared machine, delete the profiles before walking away.
- Only one account is active **per browser profile** at a time: this is switching, not simultaneous isolation (for that, use Chrome profiles or Firefox containers).
- Unofficial extension, unaffiliated with Anthropic.
- Tested on Chrome / Brave / Edge. Firefox needs a manifest variant (`background.scripts`).

## Support

If this saves you time, coffee is appreciated:

[!["Buy Me A Coffee"](https://raw.githubusercontent.com/Smeagolworms4/donate-assets/master/coffee.png)](https://www.buymeacoffee.com/smeagolworms4)
[!["Buy Me A Coffee"](https://raw.githubusercontent.com/Smeagolworms4/donate-assets/master/paypal.png)](https://www.paypal.com/donate/?business=SURRPGEXF4YVU&no_recurring=0&item_name=Hello%2C+I%27m+SmeagolWorms4.+For+my+open+source+projects.%0AThanks+you+very+mutch+%21%21%21&currency_code=EUR)

## License

MIT
