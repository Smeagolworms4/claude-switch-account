/**
 * Claude Multi-Compte — service worker.
 *
 * Principe : l'authentification claude.ai repose sur des cookies (sessionKey & co).
 * On prend un "instantané" de tous les cookies du domaine, on le range dans
 * chrome.storage.local sous un profil, et basculer = purger les cookies courants
 * puis réinjecter ceux du profil cible.
 */

const t = (key, ...subs) => chrome.i18n.getMessage(key, subs.map(String)) || key;

const COOKIE_DOMAINS = ["claude.ai", "anthropic.com"];
const STORAGE_KEY = "cmc_state";

const DEFAULT_STATE = { accounts: [], activeId: null };

const COLORS = [
  "#d97757", "#6a9fb5", "#8a7bbd", "#5fa87c",
  "#c9a227", "#c2687f", "#4f8fc0", "#a2795d"
];

/* ---------------------------------------------------------------- state --- */

async function getState() {
  const raw = await chrome.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_STATE, ...(raw[STORAGE_KEY] || {}) };
}

async function setState(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
  return state;
}

/* -------------------------------------------------------------- cookies --- */

async function readCookies() {
  const jars = await Promise.all(
    COOKIE_DOMAINS.map((domain) => chrome.cookies.getAll({ domain }))
  );
  const seen = new Set();
  const cookies = [];
  for (const cookie of jars.flat()) {
    const key = `${cookie.domain}|${cookie.path}|${cookie.name}|${cookie.storeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cookies.push(cookie);
  }
  return cookies;
}

function cookieUrl(cookie) {
  const host = cookie.domain.startsWith(".") ? cookie.domain.slice(1) : cookie.domain;
  return `${cookie.secure ? "https" : "http"}://${host}${cookie.path}`;
}

async function clearCookies() {
  const cookies = await readCookies();
  await Promise.all(
    cookies.map((cookie) =>
      chrome.cookies
        .remove({
          url: cookieUrl(cookie),
          name: cookie.name,
          storeId: cookie.storeId,
          ...(cookie.partitionKey ? { partitionKey: cookie.partitionKey } : {})
        })
        .catch(() => {})
    )
  );
}

async function writeCookies(cookies) {
  for (const cookie of cookies) {
    const details = {
      url: cookieUrl(cookie),
      name: cookie.name,
      value: cookie.value,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      storeId: cookie.storeId
    };

    // Un cookie "hostOnly" ne doit pas recevoir de champ domain, sinon Chrome
    // le transforme en cookie de domaine (et l'ancre au mauvais scope).
    if (!cookie.hostOnly) details.domain = cookie.domain;

    // SameSite=None exige secure:true, sinon chrome.cookies.set rejette.
    if (cookie.sameSite && cookie.sameSite !== "unspecified") {
      details.sameSite = cookie.sameSite;
      if (cookie.sameSite === "no_restriction") details.secure = true;
    }

    if (!cookie.session && cookie.expirationDate) {
      details.expirationDate = cookie.expirationDate;
    }
    if (cookie.partitionKey) details.partitionKey = cookie.partitionKey;

    try {
      await chrome.cookies.set(details);
    } catch (err) {
      console.warn("[CMC] cookie ignoré:", cookie.name, err);
    }
  }
}

/* -------------------------------------------------------------- identité --- */

/** Interroge l'API claude.ai avec les cookies courants pour nommer le profil. */
async function probeIdentity() {
  const endpoints = [
    "https://claude.ai/api/auth/current_account",
    "https://claude.ai/api/bootstrap",
    "https://claude.ai/api/organizations"
  ];

  const found = { email: null, name: null, org: null };

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) continue;
      const text = await res.text();

      found.email ||= text.match(/"email_address"\s*:\s*"([^"]+)"/)?.[1] || null;
      found.name ||= text.match(/"full_name"\s*:\s*"([^"]+)"/)?.[1]
        || text.match(/"display_name"\s*:\s*"([^"]+)"/)?.[1] || null;
      // Le nom d'organisation vit sous "name" dans /api/organizations.
      found.org ||= text.match(/"name"\s*:\s*"([^"]+)"/)?.[1] || null;

      if (found.email && found.name) break;
    } catch {
      /* endpoint indisponible, on tente le suivant */
    }
  }

  // Dernier recours : la partie locale de l'e-mail sert de nom lisible.
  if (!found.name && found.email) found.name = found.email.split("@")[0];
  return found;
}

async function isLoggedIn() {
  const cookies = await readCookies();
  return cookies.some((c) => c.name === "sessionKey" && c.value);
}

/* -------------------------------------------------------------- actions --- */

async function snapshotInto(account) {
  account.cookies = await readCookies();
  account.savedAt = Date.now();
  return account;
}

/** Enregistre la session actuellement active comme nouveau profil. */
async function addCurrentAccount(label) {
  if (!(await isLoggedIn())) throw new Error(t("errNoSession"));

  const state = await getState();
  const identity = await probeIdentity();
  const cookies = await readCookies();

  const id = crypto.randomUUID();
  const account = {
    id,
    label:
      label
      || identity.name
      || identity.email
      || t("defaultAccountName", state.accounts.length + 1),
    name: identity.name,
    email: identity.email,
    org: identity.org,
    color: COLORS[state.accounts.length % COLORS.length],
    cookies,
    savedAt: Date.now()
  };

  // Même e-mail déjà enregistré → on écrase au lieu de dupliquer.
  const existing = account.email
    ? state.accounts.find((a) => a.email && a.email === account.email)
    : null;

  if (existing) {
    Object.assign(existing, {
      cookies,
      savedAt: account.savedAt,
      name: identity.name || existing.name,
      org: identity.org || existing.org
    });
    state.activeId = existing.id;
  } else {
    state.accounts.push(account);
    state.activeId = id;
  }

  await setState(state);
  return state;
}

/** Bascule vers un profil : on rafraîchit d'abord la session courante. */
async function switchTo(id) {
  const state = await getState();
  const target = state.accounts.find((a) => a.id === id);
  if (!target) throw new Error(t("errNotFound"));

  // Le sessionKey tourne : on resauvegarde le compte actif avant de le quitter.
  const current = state.accounts.find((a) => a.id === state.activeId);
  if (current && current.id !== id && (await isLoggedIn())) {
    await snapshotInto(current);
  }

  await clearCookies();
  await writeCookies(target.cookies);

  state.activeId = id;
  await setState(state);
  await reloadClaudeTabs();
  return state;
}

/** Purge la session sans toucher aux profils enregistrés (pour ajouter un compte). */
async function startFreshSession() {
  const state = await getState();
  const current = state.accounts.find((a) => a.id === state.activeId);
  if (current && (await isLoggedIn())) await snapshotInto(current);

  await clearCookies();
  state.activeId = null;
  await setState(state);
  await reloadClaudeTabs();
  return state;
}

async function refreshActive() {
  const state = await getState();
  const current = state.accounts.find((a) => a.id === state.activeId);
  if (!current) throw new Error(t("errNoActive"));
  if (!(await isLoggedIn())) throw new Error(t("errNothingToSave"));

  await snapshotInto(current);
  const identity = await probeIdentity();
  if (identity.email) current.email = identity.email;
  if (identity.name) current.name = identity.name;
  if (identity.org) current.org = identity.org;
  return setState(state);
}

async function renameAccount(id, label) {
  const state = await getState();
  const account = state.accounts.find((a) => a.id === id);
  if (account) account.label = label;
  return setState(state);
}

async function removeAccount(id) {
  const state = await getState();
  state.accounts = state.accounts.filter((a) => a.id !== id);
  if (state.activeId === id) state.activeId = null;
  return setState(state);
}

async function reloadClaudeTabs() {
  const tabs = await chrome.tabs.query({ url: ["https://claude.ai/*", "https://*.claude.ai/*"] });
  await Promise.all(tabs.map((tab) => chrome.tabs.reload(tab.id).catch(() => {})));
}

async function openClaude() {
  const [tab] = await chrome.tabs.query({ url: ["https://claude.ai/*"] });
  if (tab) {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: "https://claude.ai/new" });
  }
}

/* ---------------------------------------------------------------- router --- */

const HANDLERS = {
  getState: async () => ({ state: await getState(), loggedIn: await isLoggedIn() }),
  addCurrent: ({ label }) => addCurrentAccount(label),
  switchTo: ({ id }) => switchTo(id),
  freshSession: () => startFreshSession(),
  refreshActive: () => refreshActive(),
  rename: ({ id, label }) => renameAccount(id, label),
  remove: ({ id }) => removeAccount(id),
  openClaude: () => openClaude()
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handler = HANDLERS[msg?.type];
  if (!handler) {
    sendResponse({ ok: false, error: t("errUnknownAction", msg?.type) });
    return false;
  }
  handler(msg)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
  return true; // réponse asynchrone
});
