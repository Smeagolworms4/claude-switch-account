# Privacy Policy — Claude Switch Account

Last updated: 6 August 2026

## Summary

Claude Switch Account does not collect, transmit, sell or share any personal
data. There is no server, no analytics, no tracking and no third party. Every
piece of data the extension handles stays on your own device.

## What the extension stores

To switch between accounts, the extension saves the **cookies of your
claude.ai sessions**, including the authentication cookie (`sessionKey`). For
each profile you create, it also stores the account name, e-mail address and
organization name, so the profile can be labelled in the list.

This data is written to `chrome.storage.local`, the extension's local storage
area on your computer. It is **not** synchronized to your Google account and
never leaves your browser.

## Network requests

The extension makes exactly one kind of network request: it calls the
claude.ai API (`claude.ai/api/...`) using the cookies already present in your
browser, in order to read the display name and e-mail of the account you are
saving. The response is used only to label the profile.

No data is sent anywhere else. The extension contacts no server operated by
the developer, loads no remote code, and embeds no analytics or advertising
SDK.

## Permissions and why they are needed

| Permission | Purpose |
| --- | --- |
| `cookies` | Read and restore claude.ai session cookies — this is the mechanism that makes switching possible |
| `storage` | Save the account profiles locally on your device |
| `tabs` | Reload open claude.ai tabs after a switch so the new session takes effect |
| Access to `claude.ai` and `anthropic.com` | The only domains whose cookies are read or written |

## Data retention and deletion

You remain in control at all times:

- deleting a profile (🗑 in the popup) erases its stored cookies immediately;
- uninstalling the extension deletes all stored data.

The developer has no copy of this data and no means of retrieving it.

## Security note

Session cookies are stored unencrypted in the extension's local storage, in the
same way your browser already stores its own cookie jar. Anyone with access to
your unlocked user session on the machine could read them. On a shared or
unattended computer, delete your profiles before walking away.

## Third parties

None. No data is shared with, sold to, or transferred to any third party, and
none is used for purposes unrelated to the single purpose of switching between
claude.ai accounts.

## Affiliation

This extension is unofficial and not affiliated with, endorsed by, or connected
to Anthropic.

## Contact

Questions or concerns: open an issue at
<https://github.com/Smeagolworms4/claude-switch-account/issues>.

The full source code is public and auditable at
<https://github.com/Smeagolworms4/claude-switch-account>.
