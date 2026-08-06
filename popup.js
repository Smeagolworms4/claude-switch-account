/* Popup : rendu de la liste des comptes + dispatch vers le service worker. */

const t = (key, ...subs) => chrome.i18n.getMessage(key, subs.map(String)) || key;

const $ = (id) => document.getElementById(id);
const listEl = $("list");
const emptyEl = $("empty");
const statusEl = $("status");

let busy = false;

/** Remplit le HTML statique depuis _locales/. */
function localizeDom() {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  for (const el of document.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of document.querySelectorAll("[data-i18n-title]")) {
    el.title = t(el.dataset.i18nTitle);
  }
}

function send(type, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...payload }, (res) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!res?.ok) return reject(new Error(res?.error || t("errUnknown")));
      resolve(res.data);
    });
  });
}

function notify(message, ok = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("ok", ok);
  statusEl.hidden = !message;
}

function initials(account) {
  const source = account.name || account.label || account.email || "?";
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function subtitle(account) {
  const bits = [];
  if (account.email && account.email !== account.label) bits.push(account.email);
  if (account.org && account.org !== account.name) bits.push(account.org);
  if (!bits.length && account.savedAt) {
    const date = new Date(account.savedAt).toLocaleDateString(chrome.i18n.getUILanguage());
    bits.push(t("savedOn", date));
  }
  return bits.join(" · ");
}

function render(state) {
  listEl.replaceChildren();
  emptyEl.hidden = state.accounts.length > 0;

  for (const account of state.accounts) {
    const isActive = account.id === state.activeId;

    const li = document.createElement("li");
    li.className = `item${isActive ? " active" : ""}`;
    li.title = isActive ? t("titleActive") : t("titleSwitch", account.label);

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.style.background = account.color || "#d97757";
    avatar.textContent = initials(account);

    const info = document.createElement("div");
    info.className = "info";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = account.name || account.label;
    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = subtitle(account);
    info.append(name, sub);

    const actions = document.createElement("div");
    actions.className = "actions";

    const renameBtn = document.createElement("button");
    renameBtn.className = "icon-btn";
    renameBtn.textContent = "✎";
    renameBtn.title = t("titleRename");
    renameBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const label = prompt(t("promptRename"), account.label);
      if (label?.trim()) await run(() => send("rename", { id: account.id, label: label.trim() }));
    });

    const removeBtn = document.createElement("button");
    removeBtn.className = "icon-btn";
    removeBtn.textContent = "🗑";
    removeBtn.title = t("titleRemove");
    removeBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm(t("confirmRemove", account.label))) {
        await run(() => send("remove", { id: account.id }));
      }
    });

    actions.append(renameBtn, removeBtn);
    li.append(avatar, info);

    if (isActive) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = t("badgeActive");
      li.append(badge);
    } else {
      li.addEventListener("click", () =>
        run(async () => {
          const next = await send("switchTo", { id: account.id });
          notify(t("okSwitched", account.label), true);
          return next;
        })
      );
    }

    li.append(actions);
    listEl.append(li);
  }
}

/** Enveloppe une action : verrou anti double-clic + rendu + report d'erreur. */
async function run(action) {
  if (busy) return;
  busy = true;
  document.querySelectorAll("button").forEach((b) => (b.disabled = true));
  try {
    const state = await action();
    if (state?.accounts) render(state);
    else await load();
  } catch (err) {
    notify(err.message);
  } finally {
    busy = false;
    document.querySelectorAll("button").forEach((b) => (b.disabled = false));
  }
}

async function load() {
  const { state, loggedIn } = await send("getState");
  render(state);
  if (!loggedIn && state.accounts.length) notify(t("warnNoSession"));
  return state;
}

localizeDom();

$("add").addEventListener("click", () =>
  run(async () => {
    const state = await send("addCurrent");
    notify(t("okSaved"), true);
    return state;
  })
);

$("refresh").addEventListener("click", () =>
  run(async () => {
    const state = await send("refreshActive");
    notify(t("okRefreshed"), true);
    return state;
  })
);

$("fresh").addEventListener("click", () =>
  run(async () => {
    const state = await send("freshSession");
    notify(t("okFresh"), true);
    return state;
  })
);

$("open-claude").addEventListener("click", () => send("openClaude").then(() => window.close()));

load().catch((err) => notify(err.message));
