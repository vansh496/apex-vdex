/* ============================================================
   VDEX COP — store.js
   Module on/off state + form values ko localStorage me save karta hai.
   Taaki refresh karne par bhi settings bani rahein.
   ============================================================ */

window.Store = (function () {
  'use strict';

  const KEY = 'vdex.dashboard.v1';
  const listeners = [];

  /* ---- module enabled state (pehli baar: table se) ---- */
  const defaults = {
    overview: true, customization: true, verification: true, servermgmt: true,
    antinuke: true, automod: true, scam: true, logging: true,
    welcome: true, farewell: false, leveling: true, counting: true,
    reactionroles: true, customroles: true, giveaways: true,
    embedbuilder: false, stickymessages: true, autoresponder: true, joindm: true,
    tickets: true,
    invites: true, tracking: true, memberbackup: true, boosterperks: false,
  };

  let state = load();

  function load() {
    const base = { modules: Object.assign({}, defaults), cfg: {}, ui: {} };
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return base;
      const saved = JSON.parse(raw);
      return {
        modules: Object.assign({}, defaults, saved.modules || {}),
        cfg: saved.cfg || {},
        ui: saved.ui || {},
      };
    } catch (e) {
      console.warn('[store] corrupt state, reset', e);
      return base;
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[store] save failed', e);
    }
    listeners.forEach(fn => fn(state));
  }

  /* ---- module state ---- */
  function isOn(key) { return !!state.modules[key]; }

  function setOn(key, val) {
    state.modules[key] = !!val;
    save();
    pushToggle(key, state.modules[key]);
  }

  function toggle(key) {
    state.modules[key] = !state.modules[key];
    save();
    pushToggle(key, state.modules[key]);
    return state.modules[key];
  }

  /* ---- backend (API) se aaya hua state apply karo, bina wapas bheje ---- */
  function loadServerState(modules) {
    let touched = false;
    Object.keys(modules || {}).forEach(k => {
      const entry = modules[k] || {};
      if (entry.enabled !== undefined && state.modules[k] !== !!entry.enabled) {
        state.modules[k] = !!entry.enabled;
        touched = true;
      }
      if (entry.cfg && Object.keys(entry.cfg).length) {
        if (!state.cfg[k]) state.cfg[k] = {};
        deepMerge(state.cfg[k], entry.cfg);
        touched = true;
      }
    });
    save();
    return touched;
  }

  function pushToggle(key, val) {
    if (window.API && API.isReady && API.isReady()) {
      API.toggleModule(key, val).catch(e => console.warn('[store] toggle sync fail', e.message));
    }
  }

  function enabledModules() {
    return Object.keys(state.modules).filter(k => state.modules[k]);
  }

  /* ---- per-module config (DB.config ka live copy, override-able) ---- */
  function cfg(key) {
    if (!state.cfg[key]) {
      state.cfg[key] = JSON.parse(JSON.stringify((window.DB && window.DB.config[key]) || {}));
    }
    return state.cfg[key];
  }

  /** DbConfig merge: user changes > stored > defaults */
  function merged(key) {
    const base = JSON.parse(JSON.stringify((window.DB && window.DB.config[key]) || {}));
    const over = state.cfg[key] || {};
    deepMerge(base, over);
    return base;
  }

  /* Har keystroke par server ko POST na bhejo — 400ms ruk kar ek baar.
     Local state turant update hota hai (isliye preview live rehta hai). */
  const _pendingSave = {};
  let _lastSaveToast = 0;

  /* Save hone par neeche chhota confirmation toast (auto-save feedback).
     Throttle — typing ke dauran har word par pop na ho. */
  function savedToast(key) {
    if (!window.UI || !UI.toast) return;
    /* Agar screen par pehle se koi toast hai (toggle/Save wala) to chup raho —
       do ek saath thode na pop karo. */
    if (document.querySelector('.toast')) return;
    const now = Date.now();
    if (now - _lastSaveToast < 4000) return;
    _lastSaveToast = now;
    const name = (window.DB && DB.modByKey) ? DB.modByKey(key).name : key;
    UI.toast('<b>' + String(name).replace(/</g, '&lt;') + '</b> updated', 'ok', 2000);
  }

  function setCfg(key, patch) {
    const cur = cfg(key);
    Object.assign(cur, patch);
    save();
    if (window.API && API.isReady && API.isReady()) {
      /* Poora merged config bhejo (defaults + user edits) - warna bot ke
         paas defaults (filters, triggers, rewards...) rehte hi nahi. */
      if (_pendingSave[key]) clearTimeout(_pendingSave[key]);
      _pendingSave[key] = setTimeout(() => {
        _pendingSave[key] = null;
        API.saveConfig(key, merged(key))
          .then(() => savedToast(key))
          .catch(e => console.warn('[store] config sync fail', e.message));
      }, 400);
    }
    return cur;
  }

  /** Boot par saare 24 modules ka poora config backend me daal do — apply=false,
      taaki Discord par kuch apne aap na badle. */
  async function syncAll() {
    if (!window.API || !API.isReady || !API.isReady()) return { skipped: true };
    const keys = Object.keys(state.modules || {});
    let ok = 0;
    for (const k of keys) {
      try {
        await API.saveConfig(k, merged(k), { apply: false });
        ok++;
      } catch (e) {
        console.warn('[store] sync fail', k, e.message);
      }
    }
    return { synced: ok, of: keys.length };
  }

  function reset(key) {
    delete state.cfg[key];
    save();
    if (window.API && API.isReady && API.isReady()) {
      API.resetConfig(key).catch(e => console.warn('[store] reset sync fail', e.message));
    }
  }

  function deepMerge(target, source) {
    Object.keys(source || {}).forEach(k => {
      const sv = source[k];
      if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
        if (target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
          deepMerge(target[k], sv);
        } else {
          target[k] = JSON.parse(JSON.stringify(sv));
        }
      } else {
        target[k] = sv;
      }
    });
    return target;
  }

  /* ---- ui prefs ---- */
  function ui(k, v) {
    if (v === undefined) return state.ui[k];
    state.ui[k] = v;
    save();
    return v;
  }

  function onChange(fn) { listeners.push(fn); }

  return {
    isOn, setOn, toggle, enabledModules, cfg, merged, setCfg, reset,
    ui, onChange, save, defaults, loadServerState,
    syncAll,
  };
})();
