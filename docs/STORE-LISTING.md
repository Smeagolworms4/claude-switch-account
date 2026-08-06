# Chrome Web Store listing — ready-to-paste copy

Every field of the submission form, filled in. Copy them across as-is.

---

## Store listing tab

### Item name

```
Account Switcher for Claude
```

> Deliberately not "Claude Switch Account". "Claude" is an Anthropic trademark,
> and listings whose name reads as first-party get rejected. The "… for X"
> wording is the accepted pattern for third-party tools.

### Summary (132 characters max)

```
Save several claude.ai sessions and switch between accounts in one click. Local only, no tracking, open source.
```

*(110 characters)*

### Description

```
Keep several claude.ai accounts side by side and switch between them in one click — no logging out and back in every time.

Not affiliated with, endorsed by, or connected to Anthropic.

HOW IT WORKS

claude.ai keeps you signed in through cookies. This extension saves those cookies per profile, so switching account is just restoring the right set:

1. Log into an account on claude.ai, then click "Save current session".
2. Click "New login" and sign into another account, then save that one too.
3. Both accounts now sit in the list. One click switches between them.

Each profile is labelled automatically with the account name and e-mail, so you always know which one is active.

FEATURES

• One-click switching between saved accounts
• Automatic account name and e-mail detection
• Open claude.ai tabs reload themselves after a switch
• Rename and delete profiles
• "New login" clears the session without touching your saved profiles
• Available in English, French, German, Spanish, Italian and Portuguese

PRIVACY

Everything stays on your device. No server, no analytics, no tracking, no third party, no remote code. The only network request made is to the claude.ai API, using the cookies already in your browser, to read the account name shown in the list.

Session cookies are stored in the extension's local storage, the same way your browser already stores its own cookies. Deleting a profile erases them immediately; uninstalling removes everything.

GOOD TO KNOW

One account is active per browser profile at a time — this is switching, not running several accounts simultaneously. For simultaneous sessions, use Chrome profiles.

Full source code, auditable: https://github.com/Smeagolworms4/claude-switch-account
```

### Category

`Productivity`

### Language

`English`

---

## Privacy tab

### Single purpose

```
Switch between multiple claude.ai accounts by saving and restoring their session cookies.
```

### Permission justifications

**`cookies`**

```
The extension's entire function is switching claude.ai accounts, which is done by saving the cookies of one session and restoring another. Without this permission the extension cannot work at all. Only cookies on claude.ai and anthropic.com are ever read or written.
```

**`storage`**

```
Saved account profiles are kept in chrome.storage.local so they survive a browser restart. Nothing is written anywhere else and nothing is synchronized to the user's Google account.
```

**`tabs`**

```
After switching accounts, open claude.ai tabs still show the previous session. The extension reloads only those tabs so the new session takes effect. It does not read tab content.
```

**Host permission — `claude.ai`, `anthropic.com`**

```
These are the only domains whose cookies are handled. The extension also calls the claude.ai API with the user's existing cookies to read the account display name and e-mail, so each saved profile can be labelled in the list.
```

**Remote code**

```
No, I am not using remote code.
```

> True: everything is bundled, nothing is fetched and executed.

### Data usage — what is collected

Tick **Authentication information** ("PII such as passwords, credentials,
security question or PIN") — session cookies fall under it. Nothing else.

Then certify all three:

- data is not sold or transferred to third parties, outside approved use cases
- data is not used for purposes unrelated to the item's single purpose
- data is not used to determine creditworthiness or for lending purposes

Justification, if a free-text field is offered:

```
Authentication cookies are read and restored locally to switch between the user's own claude.ai accounts. They are stored only in the extension's local storage on the user's device, are never transmitted anywhere, and are deleted when the profile or the extension is removed.
```

### Privacy policy URL

```
https://github.com/Smeagolworms4/claude-switch-account/blob/main/PRIVACY.md
```

---

## Assets

| Field | File |
| --- | --- |
| Icon 128×128 | already inside the zip (`icons/icon128.png`) |
| Small promo tile 440×280 | `store/promo-440x280.png` |
| Screenshot 1280×800 | `store/screenshot-1280x800.png` |

---

## Distribution tab

- Visibility: **Public**
- Regions: all
- Pricing: free

---

## Review notes

Two things draw scrutiny on this item. Address them up front rather than
waiting for the reviewer's question:

- the name must not imply it is an official Anthropic product;
- manipulating a third party's session cookies is a common rejection trigger —
  the defence is that everything is local, no data leaves the browser, no
  remote code is loaded, and the source is public.
