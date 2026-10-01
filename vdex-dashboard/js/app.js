/* ============================================================
   VDEX COP — app.js
   Bootstrap + global handlers
   ============================================================ */

(function () {
  'use strict';

  /* ---- sanity check ---- */
  if (!window.DB || !window.UI || !window.Pages) {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.innerHTML =
        '<div style="padding:40px;font-family:sans-serif;color:#e8ebf2">' +
        '<h1>Something went wrong</h1>' +
        '<p>One of the script files failed to load. Check the console.</p></div>';
    });
    return;
  }

  /* ---- count missing pages ---- */
  const missing = DB.modules.filter(m => !Pages[m.key]).map(m => m.key);
  if (missing.length) {
    console.warn('[app] pages not implemented yet:', missing.join(', '));
  }

  /* ---- boot ---- */
  async function boot() {
    /* backend se state lao (agar na mile to mock mode me hi chalta hai) */
    if (window.API) {
      try {
        await API.init();
      } catch (e) {
        console.warn('[app] API init failed:', e.message);
      }
      renderAuth();
      /* backend ko saare 24 modules ka poora config de do (apply=false) —
         warna bot ko sirf user-edited patches milte hain, defaults nahi */
      if (window.API && API.isReady && API.isReady() && Store.syncAll) {
        Store.syncAll()
          .then(r => { if (r.synced) console.log('[app] config synced:', r.synced + '/' + r.of); })
          .catch(e => console.warn('[app] config sync fail', e.message));
      }
    }

    /* first visit → go to overview */
    if (!location.hash) location.replace('#/overview');

    Router.init();

    /* rebuild sidebar when store changes */
    Store.onChange(() => Router.buildSidebar());

    /* keyboard shortcuts */
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') e.target.blur();
        return;
      }
      /* g then o → overview */
      if (e.key === 'g') {
        const once = (ev2) => {
          if (ev2.key === 'o') { location.hash = '#/overview'; }
          document.removeEventListener('keydown', once);
        };
        document.addEventListener('keydown', once);
        setTimeout(() => document.removeEventListener('keydown', once), 1200);
      }
      /* ? → help */
      if (e.key === '?') {
        e.preventDefault();
        showHelp();
      }
    });

    /* console banner */
    console.log(
      '%c VDEX COP %c Dashboard ready · ' + DB.modules.length + ' modules · ' +
      DB.modules.filter(m => Store.isOn(m.key)).length + ' enabled ',
      'background:#7c5cff;color:#fff;font-weight:700;padding:3px 8px;border-radius:4px 0 0 4px',
      'background:#1a1f2e;color:#a3abc0;padding:3px 8px;border-radius:0 4px 4px 0'
    );
  }

  /* ---- topbar: login button / user chip / server switcher ---- */
  function renderAuth() {
    const box = document.getElementById('authBox');
    if (!box) return;

    if (!API.isLoggedIn()) {
      box.innerHTML =
        '<span class="pill pill--muted" title="Mock data mode">OFFLINE</span>' +
        '<button class="btn btn--primary" id="authLogin">Connect server</button>';
      const b = document.getElementById('authLogin');
      if (b) b.onclick = () => API.login();
      return;
    }

    const user = API.user() || {};
    const guilds = API.guilds();
    const cur = API.guild();
    const av = user.avatar
      ? 'https://cdn.discordapp.com/avatars/' + user.id + '/' + user.avatar + '.png?size=32'
      : '';

    let html = '';
    if (guilds.length > 1) {
      html += '<select id="guildPick" class="input input--sm" style="max-width:170px">' +
        guilds.map(g =>
          '<option value="' + UI.esc(g.id) + '"' + (g.id === cur ? ' selected' : '') + '>' +
          UI.esc(g.name) + '</option>').join('') +
        '</select>';
    }
    html +=
      '<span class="avatar" style="width:26px;height:26px;border-radius:50%;overflow:hidden;' +
      'background:linear-gradient(135deg,#7c5cff,#00d4ff);display:inline-flex;align-items:center;' +
      'justify-content:center;font-size:11px;font-weight:700;color:#fff">' +
      (av ? '<img src="' + av + '" alt="" style="width:100%;height:100%;object-fit:cover">'
          : UI.esc((user.username || '?').slice(0, 1).toUpperCase())) +
      '</span>' +
      '<span class="small muted hide-sm">' + UI.esc(user.username || '') + '</span>' +
      '<button class="btn btn--ghost btn--sm" id="authLogout">Logout</button>';

    box.innerHTML = html;

    const pick = document.getElementById('guildPick');
    if (pick) {
      pick.onchange = async () => {
        try {
          await API.setGuild(pick.value);
          location.reload();
        } catch (e) { UI.toast(e.message, 'error'); }
      };
    }
    const out = document.getElementById('authLogout');
    if (out) out.onclick = () => API.logout();
  }

  function showHelp() {
    UI.modal({
      title: 'Keyboard shortcuts',
      body: UI.table([
        { label: 'Key', render: r => UI.h('kbd', { text: r[0] }) },
        { label: 'Action', render: r => UI.h('span', { class: 'small muted', text: r[1] }) },
      ], [
        ['/', 'Focus module search'],
        ['g then o', 'Go to overview'],
        ['Esc', 'Close modal / blur input'],
        ['?', 'Show this help'],
      ]),
      actions: [UI.h('button', { class: 'btn btn--ghost', 'data-close': true, text: 'Close' })],
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
