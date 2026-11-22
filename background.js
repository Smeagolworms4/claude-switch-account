/**
 * Claude Switch Account — service worker.
 *
 * How it works: claude.ai authentication lives in cookies (sessionKey chief
 * among them). We snapshot every cookie for the domain into a profile stored in
 * chrome.storage.local; switching means clearing the current jar and restoring
 * the target profile's cookies.
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

    // A hostOnly cookie must not carry a domain field, otherwise Chrome turns
    // it into a domain cookie and anchors it to the wrong scope.
    if (!cookie.hostOnly) details.domain = cookie.domain;

    // SameSite=None requires secure:true, or chrome.cookies.set rejects it.
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
      console.warn("[CSA] skipped cookie:", cookie.name, err);
    }
  }
}

/* -------------------------------------------------------------- identity --- */

/** Queries the claude.ai API with the current cookies to label the profile. */
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
      // The organization name lives under "name" in /api/organizations.
      found.org ||= text.match(/"name"\s*:\s*"([^"]+)"/)?.[1] || null;

      if (found.email && found.name) break;
    } catch {
      /* endpoint unavailable, try the next one */
    }
  }

  // Last resort: the e-mail local part doubles as a readable name.
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

/** Saves the currently active session as a new profile. */
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

  // Same e-mail already saved -> overwrite instead of duplicating.
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

/** Switches to a profile, re-saving the current session first. */
async function switchTo(id) {
  const state = await getState();
  const target = state.accounts.find((a) => a.id === id);
  if (!target) throw new Error(t("errNotFound"));

  // sessionKey rotates, so re-snapshot the active account before leaving it.
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

/** Clears the session without touching saved profiles (to add an account). */
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

/* ------------------------------------------------------- import / export --- */

const EXPORT_FORMAT = "claude-switch-account";
const EXPORT_VERSION = 1;
const SAME_SITE = new Set(["no_restriction", "lax", "strict", "unspecified"]);

/** Returns every saved account, with a fresh snapshot of the active one. */
async function exportAccounts() {
  const state = await getState();
  if (!state.accounts.length) throw new Error(t("errNothingToExport"));

  // sessionKey rotates: export the live cookies of the active account, not a stale copy.
  const current = state.accounts.find((a) => a.id === state.activeId);
  if (current && (await isLoggedIn())) {
    await snapshotInto(current);
    await setState(state);
  }

  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    accounts: state.accounts
  };
}

function isClaudeDomain(domain) {
  const host = String(domain || "").replace(/^\./, "").toLowerCase();
  return COOKIE_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

const optString = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Keeps only the cookie fields we write back; returns null for anything unusable. */
function sanitizeCookie(raw, storeIds) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.name !== "string" || !raw.name || typeof raw.value !== "string") return null;
  if (!isClaudeDomain(raw.domain)) return null;
  if (typeof raw.path !== "string" || !raw.path.startsWith("/")) return null;

  const cookie = {
    name: raw.name,
    value: raw.value,
    domain: raw.domain,
    path: raw.path,
    secure: raw.secure === true,
    httpOnly: raw.httpOnly === true,
    hostOnly: raw.hostOnly === true,
    session: raw.session === true
  };
  if (SAME_SITE.has(raw.sameSite)) cookie.sameSite = raw.sameSite;
  if (Number.isFinite(raw.expirationDate)) cookie.expirationDate = raw.expirationDate;
  // A store id from another browser would make cookies.set fail: keep it only if it exists here.
  if (typeof raw.storeId === "string" && storeIds.has(raw.storeId)) cookie.storeId = raw.storeId;
  if (raw.partitionKey && typeof raw.partitionKey === "object") cookie.partitionKey = raw.partitionKey;
  return cookie;
}

/** Validates one imported account; returns null when it cannot be used to sign in. */
function sanitizeAccount(raw, storeIds, position) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.cookies)) return null;

  const cookies = raw.cookies.map((c) => sanitizeCookie(c, storeIds)).filter(Boolean);
  if (!cookies.some((c) => c.name === "sessionKey" && c.value)) return null;

  const name = optString(raw.name);
  const email = optString(raw.email);
  return {
    id: optString(raw.id)?.slice(0, 100) || crypto.randomUUID(),
    label: optString(raw.label) || name || email || t("defaultAccountName", position + 1),
    name,
    email,
    org: optString(raw.org),
    color: /^#[0-9a-f]{3,8}$/i.test(raw.color || "") ? raw.color : COLORS[position % COLORS.length],
    cookies,
    savedAt: Number.isFinite(raw.savedAt) ? raw.savedAt : Date.now()
  };
}

/**
 * Merges an exported file into the saved accounts. An account that is already
 * saved (same id or same e-mail) is only overwritten when the imported session
 * is newer. The active account is left untouched.
 */
async function importAccounts(data) {
  if (!data || data.format !== EXPORT_FORMAT || !Array.isArray(data.accounts)) {
    throw new Error(t("errImportInvalid"));
  }
  if (!Number.isInteger(data.version) || data.version < 1 || data.version > EXPORT_VERSION) {
    throw new Error(t("errImportInvalid"));
  }

  const stores = await chrome.cookies.getAllCookieStores().catch(() => []);
  const storeIds = new Set(stores.map((s) => s.id));

  const state = await getState();
  const result = { added: 0, updated: 0, skipped: 0 };

  for (const raw of data.accounts) {
    const account = sanitizeAccount(raw, storeIds, state.accounts.length);
    if (!account) {
      result.skipped++;
      continue;
    }

    const existing = state.accounts.find(
      (a) => a.id === account.id || (account.email && a.email === account.email)
    );

    if (!existing) {
      state.accounts.push(account);
      result.added++;
    } else if (account.savedAt > (existing.savedAt || 0)) {
      Object.assign(existing, {
        cookies: account.cookies,
        savedAt: account.savedAt,
        name: account.name || existing.name,
        email: account.email || existing.email,
        org: account.org || existing.org
      });
      result.updated++;
    } else {
      result.skipped++;
    }
  }

  await setState(state);
  return { ...state, importResult: result };
}

/* ---------------------------------------------------------------- reorder --- */

/** Saves a new account order. Unknown ids are ignored; accounts left out keep their place at the end. */
async function reorderAccounts(ids) {
  if (!Array.isArray(ids)) throw new Error(t("errUnknown"));

  const state = await getState();
  const byId = new Map(state.accounts.map((a) => [a.id, a]));
  const ordered = [];
  for (const id of ids) {
    const account = byId.get(id);
    if (!account) continue;
    ordered.push(account);
    byId.delete(id);
  }
  state.accounts = [...ordered, ...byId.values()];
  return setState(state);
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

Object.assign(HANDLERS, {
  exportAccounts: () => exportAccounts(),
  importAccounts: ({ data }) => importAccounts(data)
});

Object.assign(HANDLERS, {
  reorder: ({ ids }) => reorderAccounts(ids)
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handler = HANDLERS[msg?.type];
  if (!handler) {
    sendResponse({ ok: false, error: t("errUnknownAction", msg?.type) });
    return false;
  }
  handler(msg)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
  return true; // async response
});
