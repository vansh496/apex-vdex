/* ============================================================
   VDEX COP — router.js
   Hash-based router, sidebar render, page dispatch
   ============================================================ */

window.Router = (function () {
  'use strict';

  let current = null;
  let navBuilt = false;

  /* ---------------------------------------------------------
     Sidebar
     --------------------------------------------------------- */
  function buildSidebar() {
    const nav = UI.$('#nav');
    if (!nav) return;

    /* guild card */
    const gc = UI.$('#guildCard');
    gc.innerHTML = '';
    gc.appendChild(UI.h('div', { class: 'guild-card__icon', text: DB.server.icon }));
    gc.appendChild(UI.h('div', { class: 'guild-card__meta' }, [
      UI.h('div', { class: 'guild-card__name', text: DB.server.name }),
      UI.h('div', { class: 'guild-card__sub', text: DB.server.members.toLocaleString() + ' members' }),
    ]));
    gc.appendChild(UI.h('div', { class: 'guild-card__chev', text: '▾' }));

    /* nav groups */
    nav.innerHTML = '';
    DB.groups.forEach(group => {
      const mods = DB.modules.filter(m => m.group === group);
      if (!mods.length) return;

      const g = UI.h('div', { class: 'nav__group' }, [
        UI.h('div', { class: 'nav__label', text: group }),
      ]);

      mods.forEach(m => {
        const on = Store.isOn(m.key);
        g.appendChild(UI.h('a', {
          class: 'nav__item' + (m.key === 'overview' ? ' is-active' : ''),
          href: '#/' + m.key,
          dataset: { key: m.key },
        }, [
          UI.h('span', { class: 'nav__ico', text: m.icon }),
          UI.h('span', { class: 'nav__txt', text: m.name }),
          m.key === 'overview' ? null : UI.h('span', {
            class: 'nav__badge ' + (on ? 'nav__badge--on' : 'nav__badge--off'),
            text: on ? 'ON' : 'OFF',
          }),
        ]));
      });

      nav.appendChild(g);
    });

    /* health */
    const hp = UI.$('#healthPill');
    const onCount = Store.enabledModules().length;
    const offCount = DB.modules.length - 1 - onCount;
    hp.className = 'health' + (offCount > 12 ? ' is-err' : offCount > 6 ? ' is-warn' : '');
    hp.querySelector('.health__text').textContent = DB.server.uptime + ' · ' + DB.server.latency + 'ms · ' + onCount + ' modules on';

    navBuilt = true;
  }

  function markActive(key) {
    UI.$$('.nav__item').forEach(a => a.classList.toggle('is-active', a.dataset.key === key));
  }

  /* ---------------------------------------------------------
     Page dispatch
     --------------------------------------------------------- */
  function getRoute() {
    const raw = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return raw || 'overview';
  }

  function render() {
    const key = getRoute();
    const content = UI.$('#content');
    if (!content) return;

    /* sirf sidebar wale modules hi route ho sakte hain (deep-link bhi) */
    const allowed = DB.modules.some(m => m.key === key);
    const page = allowed ? Pages[key] : null;
    if (!page) {
      content.innerHTML = '';
      content.appendChild(UI.h('div', { class: 'empty' }, [
        UI.h('div', { class: 'empty__ico', text: '\u{1F50D}' }),
        UI.h('div', { class: 'empty__title', text: 'Page not found' }),
        UI.h('div', { class: 'empty__desc', text: allowed
          ? 'No module called "' + UI.esc(key) + '" exists.'
          : '"' + UI.esc(key) + '" module hata diya gaya hai.' }),
        UI.h('a', { class: 'btn btn--primary', href: '#/overview', text: 'Back to overview' }),
      ]));
      return;
    }

    /* header + content */
    const mod = DB.modByKey(key);
    const head = UI.pageHead({
      name: mod.name,
      icon: mod.icon,
      desc: key === 'tickets' ? mod.desc + '  ·  Live list available at the bottom.' : mod.desc,
    });

    content.innerHTML = '';
    try {
      const body = page.render();
      content.appendChild(head);
      content.appendChild(body);

      /* tickets: live view */
      if (key === 'tickets' && Pages.ticketsLive) {
        content.appendChild(UI.h('hr', { class: 'mt-24' }));
        content.appendChild(UI.h('h2', { class: 'mb-16', text: '\u{1F5DD} Live Tickets' }));
        const liveWrap = UI.h('div', { id: 'liveTickets' });
        liveWrap.appendChild(Pages.ticketsLive.render());
        content.appendChild(liveWrap);
      }
    } catch (err) {
      console.error('[router] render failed', err);
      content.appendChild(UI.h('div', {}, UI.alert('err', 'Something broke while rendering this page: <b>' + UI.esc(err.message) + '</b>')));
    }

    /* breadcrumb */
    const cp = UI.$('.crumb__page');
    if (cp) cp.textContent = mod.name;

    markActive(key);
    current = key;

    /* scroll top */
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  /* ---------------------------------------------------------
     Module search
     --------------------------------------------------------- */
  function search(q) {
    const input = UI.$('#moduleSearch');
    const wrap = input.parentElement;
    let pop = wrap.querySelector('.search-pop');

    const term = (q || input.value).trim().toLowerCase();
    if (!term) { if (pop) pop.remove(); return; }

    const hits = DB.modules.filter(m =>
      m.name.toLowerCase().includes(term) || m.desc.toLowerCase().includes(term) || m.group.toLowerCase().includes(term)
    ).slice(0, 8);

    if (!pop) {
      pop = UI.h('div', { class: 'search-pop' });
      wrap.appendChild(pop);
    }
    pop.innerHTML = '';

    if (!hits.length) {
      pop.appendChild(UI.h('div', { class: 'nav__empty', text: 'No modules match "' + term + '"' }));
      return;
    }

    hits.forEach((m, i) => {
      pop.appendChild(UI.h('a', {
        class: 'search-pop__item' + (i === 0 ? ' is-cursor' : ''),
        href: '#/' + m.key,
        onclick: () => { pop.remove(); input.value = ''; },
      }, [
        UI.h('span', { class: 'nav__ico', text: m.icon }),
        UI.h('span', { class: 'grow', text: m.name }),
        UI.h('small', { text: m.group }),
      ]));
    });
  }

  /* ---------------------------------------------------------
     Mobile nav
     --------------------------------------------------------- */
  function openNav(open) {
    UI.$('#sidebar').classList.toggle('is-open', open);
    UI.$('#scrim').hidden = !open;
  }

  /* ---------------------------------------------------------
     Live tickets — sirf wahi section refresh karo (upar ka
     config form dobara render nahi hoga, focus nahi tootega)
     --------------------------------------------------------- */
  async function refreshLive(showToast) {
    const host = UI.$('#liveTickets');
    if (!host || !Pages.ticketsLive) return;
    try {
      if (window.API && API.isReady && API.isReady()) await API.refresh();
    } catch (e) {
      if (showToast && window.UI) UI.toast(e.message, 'err');
      return;
    }
    if (Router.current && Router.current() !== 'tickets') return;
    host.innerHTML = '';
    host.appendChild(Pages.ticketsLive.render());
    if (showToast && window.UI) UI.toast('Ticket list updated', 'ok', 1500);
  }

  function init() {
    if (!navBuilt) buildSidebar();

    window.addEventListener('hashchange', () => {
      render();
      openNav(false);
    });

    /* har 15s par tickets page ho to live list sync — Discord se
       naya ticket aaye to dashboard turant dikhe */
    window.__refreshLive = refreshLive;
    setInterval(() => {
      if (current === 'tickets' && document.visibilityState === 'visible') {
        refreshLive(false);
      }
    }, 15000);

    /* mobile burger */
    UI.$('#navToggle').addEventListener('click', () => openNav(true));
    UI.$('#navClose').addEventListener('click', () => openNav(false));
    UI.$('#scrim').addEventListener('click', () => openNav(false));

    /* guild card */
    UI.$('#guildCard').addEventListener('click', () => UI.toast('Server switcher — only one server connected', 'info'));

    /* search */
    const input = UI.$('#moduleSearch');
    input.addEventListener('input', () => search());
    input.addEventListener('focus', () => search());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { input.value = ''; const p = input.parentElement.querySelector('.search-pop'); if (p) p.remove(); input.blur(); }
      if (e.key === 'Enter') {
        const first = input.parentElement.querySelector('.search-pop__item');
        if (first) { location.hash = first.getAttribute('href'); input.value = ''; const p = input.parentElement.querySelector('.search-pop'); if (p) p.remove(); }
      }
    });
    document.addEventListener('click', (e) => {
      const pop = UI.$('.search-pop');
      if (pop && !pop.contains(e.target) && e.target !== input) pop.remove();
    });

    /* "/" focuses search */
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== input && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        input.focus();
      }
    });

    /* customize button */
    UI.$('#btnCustomize').addEventListener('click', () => { location.hash = '#/customization'; });

    render();
  }

  return { init, render, buildSidebar, current: () => current, refreshLive };
})();
