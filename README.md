# Claude Switch Account

Extension navigateur (Manifest V3) pour jongler entre **plusieurs comptes claude.ai** et basculer de l'un à l'autre **en un clic**, sans se déconnecter/reconnecter à chaque fois.

[![build](https://github.com/Smeagolworms4/claude-switch-account/actions/workflows/build.yml/badge.svg)](https://github.com/Smeagolworms4/claude-switch-account/actions/workflows/build.yml)

*(English version below — [English](#english))*

---

## Fonctionnement

L'authentification claude.ai repose sur des cookies (`sessionKey` en tête). L'extension :

1. prend un **instantané** de tous les cookies `claude.ai` / `anthropic.com` et le range dans un profil ;
2. récupère le **nom et l'e-mail** du compte via l'API claude.ai pour l'étiqueter automatiquement ;
3. au clic sur un autre profil : resauvegarde la session courante (le `sessionKey` tourne), purge les cookies, réinjecte ceux du profil cible, puis recharge les onglets claude.ai ouverts.

Tout reste **en local** dans `chrome.storage.local`. Aucun serveur, aucune télémétrie, aucun mot de passe : uniquement les cookies que votre navigateur possède déjà.

## Installation

### Depuis une release

1. Téléchargez le `.zip` depuis [Releases](https://github.com/Smeagolworms4/claude-switch-account/releases) et décompressez-le.
2. Ouvrez `chrome://extensions` (ou `brave://extensions`, `edge://extensions`).
3. Activez le **mode développeur**.
4. **Charger l'extension non empaquetée** → sélectionnez le dossier décompressé.

### Depuis les sources

```bash
git clone https://github.com/Smeagolworms4/claude-switch-account.git
cd claude-switch-account
```

Puis chargez le dossier directement via **Charger l'extension non empaquetée**. Aucune étape de build n'est nécessaire : le code est du JS natif sans dépendance.

## Utilisation

| Action | Effet |
| --- | --- |
| **＋ Enregistrer la session actuelle** | Ajoute le compte connecté à la liste (nom + e-mail détectés automatiquement) |
| **Clic sur un compte** | Bascule dessus et recharge les onglets claude.ai |
| **⇥ Nouvelle connexion** | Vide la session sans supprimer les profils — pour ajouter un compte supplémentaire |
| **↻ Rafraîchir le compte actif** | Resauvegarde les cookies du compte actif (utile après une reconnexion) |
| **✎ / 🗑** | Renommer / supprimer un profil |

### Ajouter un deuxième compte

1. Connectez-vous au compte A sur claude.ai → **＋ Enregistrer la session actuelle**.
2. **⇥ Nouvelle connexion** → connectez-vous au compte B.
3. **＋ Enregistrer la session actuelle**.
4. Les deux comptes sont dans la liste : un clic suffit pour basculer.

## Langues

Interface traduite via `chrome.i18n`, sélectionnée automatiquement selon la langue du navigateur :

🇬🇧 English (défaut) · 🇫🇷 Français · 🇩🇪 Deutsch · 🇪🇸 Español · 🇮🇹 Italiano · 🇵🇹 Português

Ajouter une langue = créer `_locales/<code>/messages.json` en copiant `_locales/en/messages.json`. La CI vérifie que toutes les langues ont exactement les mêmes clés.

## Développement

```
manifest.json          # MV3, permissions cookies/storage/tabs
background.js          # service worker : snapshot / purge / restauration des cookies
popup.html/.css/.js    # interface de la liste des comptes
_locales/<lang>/       # traductions
icons/                 # icônes générées
tools/build.sh         # produit dist/claude-switch-account-<version>.zip
tools/make-icons.py    # régénère les icônes (nécessite Pillow)
```

```bash
bash tools/build.sh          # empaqueter
python3 tools/make-icons.py  # régénérer les icônes
```

### CI

`.github/workflows/build.yml` sur chaque push, PR et tag :

- valide le manifest et la **parité des clés de traduction** entre toutes les langues ;
- vérifie la syntaxe JS (`node --check`) ;
- construit le zip et le publie en **artefact** téléchargeable ;
- sur un tag `v*` : aligne `manifest.version` sur le tag et crée la **release GitHub** avec le zip.

Publier une version :

```bash
git tag v1.0.1 && git push origin v1.0.1
```

## Sécurité & limites

- Les cookies de session sont stockés **en clair** dans le stockage local de l'extension — comme dans le jar de cookies du navigateur. Sur une machine partagée, supprimez les profils avant de partir.
- Un seul compte est actif **par profil navigateur** à un instant donné : c'est une bascule, pas du cloisonnement simultané (pour du simultané, utilisez les profils Chrome ou les conteneurs Firefox).
- Extension non officielle, sans lien avec Anthropic.
- Testée sur Chrome / Brave / Edge. Firefox nécessite une variante du manifest (`background.scripts`).

## Licence

MIT

---

<a name="english"></a>

# English

Browser extension (Manifest V3) to keep **several claude.ai accounts** side by side and switch between them **in one click**.

**How it works.** claude.ai authentication lives in cookies (`sessionKey` first and foremost). The extension snapshots every `claude.ai` / `anthropic.com` cookie into a profile, labels it with the account name and e-mail fetched from the claude.ai API, and on switch: re-saves the current session (the `sessionKey` rotates), clears the jar, restores the target profile's cookies, and reloads open claude.ai tabs. Everything stays local in `chrome.storage.local` — no server, no telemetry, no passwords.

**Install.** Grab the `.zip` from [Releases](https://github.com/Smeagolworms4/claude-switch-account/releases), unzip it, then `chrome://extensions` → enable **Developer mode** → **Load unpacked**. Or clone the repo and load the folder as-is; there is no build step.

**Usage.** Log into account A → **＋ Save current session**. Then **⇥ New login** → log into account B → **＋ Save current session**. Both now sit in the list; click either one to switch. **↻ Refresh active account** re-saves the current cookies, **✎ / 🗑** rename and delete.

**Languages.** UI auto-selects from the browser language: English (default), French, German, Spanish, Italian, Portuguese. Add one by copying `_locales/en/messages.json` to `_locales/<code>/messages.json` — CI enforces key parity across all locales.

**Caveats.** Session cookies are stored in plaintext in extension storage (same as your browser's cookie jar) — remove profiles on a shared machine. Only one account is active per browser profile at a time: this is switching, not simultaneous isolation. Unofficial, unaffiliated with Anthropic. Tested on Chrome / Brave / Edge.

MIT licensed.
