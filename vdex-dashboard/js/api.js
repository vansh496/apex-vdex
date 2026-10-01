/* ============================================================
   VDEX COP — api.js
   Backend se baat karta hai (Discord OAuth + REST API).

   - `/auth/login`  → Discord OAuth
   - `/api/state`   → real server data + saved module settings
   - `POST /api/...` → toggle / config save / ticket actions

   Agar backend na ho (file:// se khola) to chup-chaap localStorage
   wale mode me chalta rehta hai — kuch tootna nahi chahiye.
   ============================================================ */

window.API = (function () {
  'use strict';

  const GUILD_KEY = 'vdex.guild';
  const SESSION_KEY = 'vdex.login';

  let ready = false;      // backend connected + state loaded
  let loggedIn = false;
  let me = null;
  let state = null;
  let guildId = '';

  /* ---------------------------------------------------------
     low-level fetch
     --------------------------------------------------------- */
  async function j(url, opts = {}) {
    let res;
    try {
      res = await fetch(url, Object.assign({
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      }, opts));
    } catch (e) {
      throw new Error('Network fail — server chal raha hai?');
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) {
      const msg = (data && data.error) || res.statusText || 'Request failed';
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  const post = (url, body) => j(url, { method: 'POST', body: JSON.stringify(body || {}) });
  const get = (url) => j(url);

  /* ---------------------------------------------------------
     login / logout  (link-based — OAuth nahi)
     --------------------------------------------------------- */
  function login() {
    /* server par session nahi hai to `/` connect page serve karta hai */
    location.href = '/';
  }

  async function logout() {
    try { await post('/auth/logout'); } catch (e) { /* ignore */ }
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(GUILD_KEY);
    location.href = '/';
  }

  /* ---------------------------------------------------------
     state load + merge into DB / Store
     --------------------------------------------------------- */
  function pickGuild() {
    const saved = localStorage.getItem(GUILD_KEY);
    const list = (me && me.guilds) || [];
    if (!list.length) return '';
    const hit = list.find(g => g.id === saved);
    return hit ? hit.id : list[0].id;
  }

  function apply(s) {
    state = s;

    // --- server meta (sidebar + stats cards) ---
    if (s.server && s.server.id) {
      Object.assign(DB.server, s.server);
      if (!DB.server.online) DB.server.online = s.server.memberCount;
      if (!DB.server.channels) DB.server.channels = (s.channels || []).length;
      if (!DB.server.roles) DB.server.roles = (s.roles || []).length;
    }

    // --- real channels / roles / members (khaali na ho to) ---
    if (Array.isArray(s.channels) && s.channels.length) DB.channels = s.channels;
    if (Array.isArray(s.roles) && s.roles.length) DB.roles = s.roles;
    if (Array.isArray(s.categories) && s.categories.length) DB.categories = s.categories;

    if (Array.isArray(s.members) && s.members.length) {
      /* level/xp/messages/status Discord REST se nahi aate (presence intent
         chahiye + bot abhi XP track nahi karta) — mock values ko rehne dete
         hain taki leveling page toota na ho, baaki sab asli ho jaata hai. */
      const old = Array.isArray(DB.members) ? DB.members : [];
      s.members = s.members.map((m, i) => {
        const prev = old[i] || {};
        return Object.assign({
          level: prev.level || 1,
          xp: prev.xp || 0,
          messages: prev.messages || 0,
          status: prev.status || 'online',
        }, m);
      });
      DB.members = s.members;
    }

    // --- saved module settings (server overrides > data.js defaults) ---
    Store.loadServerState(s.modules || {});

    // --- anti-nuke instances / security incidents / lockdown state ---
    DB.antinuke = Object.assign(
      { instances: [], incidents: [], lockdown: { on: false } },
      s.antinuke || (DB.antinuke || {})
    );
  }

  /* ---------------------------------------------------------
     public API used by store.js
     --------------------------------------------------------- */
  async function toggleModule(key, enabled) {
    if (!ready) return { offline: true };
    return post('/api/modules/' + encodeURIComponent(key) + '/toggle', {
      guild: guildId, enabled: !!enabled,
    });
  }

  async function saveConfig(key, patch, opts) {
    if (!ready) return { offline: true };
    // apply=false → sirf save, Discord par kuch mat badlo (boot-sync ke liye)
    const apply = !(opts && opts.apply === false);
    return post('/api/modules/' + encodeURIComponent(key) + '/config', {
      guild: guildId, cfg: patch, apply,
    });
  }

  async function testModule(key) {
    if (!ready) throw new Error('Backend connected nahi hai');
    return post('/api/modules/' + encodeURIComponent(key) + '/test', { guild: guildId });
  }

  async function saveIds(mapping) {
    if (!ready) throw new Error('Backend connected nahi hai');
    return post('/api/ids', {
      guild: guildId,
      channels: (mapping && mapping.channels) || {},
      roles: (mapping && mapping.roles) || {},
    });
  }

  async function resetConfig(key) {
    if (!ready) return { offline: true };
    const r = await post('/api/modules/' + encodeURIComponent(key) + '/reset', { guild: guildId });
    return r;
  }

  /* ---- Anti-Nuke: instances (spec §4) + lockdown (spec §6) ---- */
  async function saveAntinukeInstances(instances) {
    if (!ready) throw new Error('Backend connected nahi hai');
    const r = await post('/api/antinuke/instances', {
      guild: guildId, action: 'save', instances: instances || [],
    });
    if (r && r.instances) {
      DB.antinuke = Object.assign({}, DB.antinuke, { instances: r.instances });
    }
    return r;
  }

  async function setLockdown(on) {
    if (!ready) throw new Error('Backend connected nahi hai');
    const r = await post('/api/antinuke/lockdown', { guild: guildId, on: !!on });
    if (r && r.lockdown) {
      DB.antinuke = Object.assign({}, DB.antinuke, { lockdown: r.lockdown });
    }
    return r;
  }

  async function ticketAction(action, channel) {
    return post('/api/tickets/' + encodeURIComponent(action), { guild: guildId, channel });
  }

  async function setupTickets(opts) {
    if (!ready) throw new Error('Backend connected nahi hai');
    return post('/api/setup', Object.assign({ guild: guildId }, opts || {}));
  }

  async function resendPanel() {
    if (!ready) throw new Error('Backend connected nahi hai');
    return post('/api/panel', { guild: guildId });
  }

  async function refresh() {
    if (!ready) return null;
    const s = await get('/api/state?guild=' + encodeURIComponent(guildId));
    apply(s);
    return s;
  }

  async function setGuild(id) {
    localStorage.setItem(GUILD_KEY, id);
    guildId = id;
    const s = await get('/api/state?guild=' + encodeURIComponent(id));
    apply(s);
    return s;
  }

  /* ---------------------------------------------------------
     boot — app.js isse call karta hai
     --------------------------------------------------------- */
  async function init() {
    try {
      me = await get('/api/me');
    } catch (e) {
      console.warn('[api] backend unavailable:', e.message);
      ready = false; loggedIn = false;
      return { logged_in: false, backend: false };
    }

    if (!me.logged_in) {
      ready = false; loggedIn = false;
      return { logged_in: false, backend: true };
    }

    guildId = pickGuild();
    if (!guildId) {
      loggedIn = true; ready = false;
      return { logged_in: true, backend: true, no_guilds: true };
    }

    try {
      const s = await get('/api/state?guild=' + encodeURIComponent(guildId));
      apply(s);
      ready = true; loggedIn = true;
      localStorage.setItem(SESSION_KEY, '1');
      return { logged_in: true, backend: true, guilds: me.guilds, guild: guildId };
    } catch (e) {
      console.warn('[api] state failed:', e.message);
      ready = false; loggedIn = true;
      return { logged_in: true, backend: true, error: e.message };
    }
  }

  return {
    init, login, logout, refresh, setGuild,
    toggleModule, saveConfig, resetConfig, ticketAction,
    setupTickets, resendPanel, testModule, saveIds,
    saveAntinukeInstances, setLockdown,
    isReady: () => ready,
    isLoggedIn: () => loggedIn,
    user: () => me && me.user,
    guilds: () => (me && me.guilds) || [],
    guild: () => guildId,
    state: () => state,
  };
})();
