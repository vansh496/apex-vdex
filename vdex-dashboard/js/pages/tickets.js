/* ============================================================
   VDEX COP — pages/tickets.js
   Ticket system configuration + live ticket list
   ============================================================ */

Pages.tickets = {
  render: function () {
    const c = Store.merged('tickets');
    /* sirf store — har keystroke par render NHI (warna input ka focus chala
       jata tha — "prefix type nahi ho raha"). Structural changes (add/delete
       category) khud Router.render() karte hain. */
    const set = (patch) => { Store.setCfg('tickets', patch); };

    const left = UI.h('div', { class: 'stack' });

    /* ---- live setup (backend) — dashboard se /setup jaisa ---- */
    let setupInfo = null;
    try { setupInfo = (window.API && API.isReady() && API.state() && API.state().setup) || null; } catch (e) { /* offline */ }

    if (setupInfo) {
      const isSetup = !!setupInfo.is_setup;
      let staffRole = (setupInfo.staff_role_ids && String(setupInfo.staff_role_ids[0] || '')) || '';
      let supportRole = (setupInfo.support_role_id && String(setupInfo.support_role_id)) || '';
      let maxOpen = String(setupInfo.max_open_tickets || 3);
      const catCount = Object.keys(setupInfo.categories || {}).length;

      left.appendChild(UI.card({
        title: '⚙️ Ticket Setup',
        sub: isSetup ? 'Discord me categories + panel ready hain' : 'Abhi setup nahi hua — neeche se chalao',
        body: [
          UI.h('div', { class: 'row gap-12 wrap' }, [
            isSetup ? UI.pill('Setup complete', 'ok') : UI.pill('Not setup', 'err'),
            UI.h('span', {
              class: 'small dim',
              text: isSetup
                ? (catCount + ' categories · panel <#' + setupInfo.panel_channel_id + '> · log <#' + setupInfo.log_channel_id + '>')
                : '4 categories + #create-ticket + #ticket-logs ban jayenge',
            }),
          ]),
          UI.h('div', { class: 'grid grid--2 mt-16' }, [
            UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Staff Role' }), UI.rolePicker(staffRole, v => { staffRole = v; })]),
            UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Support Role (optional)' }), UI.rolePicker(supportRole, v => { supportRole = v; })]),
            UI.selectField('Max open / user', maxOpen, [
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
              { value: '5', label: '5' },
              { value: '10', label: '10' },
            ], v => { maxOpen = v; }),
          ]),
          UI.h('div', { class: 'row gap-12 mt-16 wrap' }, [
            UI.h('button', { class: 'btn btn--brand', text: isSetup ? 'Re-run Setup' : 'Run Setup', onclick: runSetup }),
            isSetup ? UI.h('button', { class: 'btn btn--soft', text: 'Re-send Panel', onclick: resend }) : null,
          ].filter(Boolean)),
        ],
      }));

      async function runSetup() {
        if (!staffRole) { UI.toast('Pehle Staff Role chuno', 'err'); return; }
        try {
          await API.setupTickets({
            staff_role: staffRole,
            support_role: supportRole || undefined,
            max_open: parseInt(maxOpen, 10) || 3,
          });
          UI.toast('Setup complete — panel bhej diya', 'ok');
        } catch (e) { UI.toast(e.message, 'err'); return; }
        try { await API.refresh(); } catch (e) { /* ignore */ }
        Router.render();
      }

      async function resend() {
        try { await API.resendPanel(); UI.toast('Panel bhej diya', 'ok'); }
        catch (e) { UI.toast(e.message, 'err'); }
      }
    }

    left.appendChild(UI.card({
      title: '\u{1F3AB} Ticket System',
      sub: 'Support tickets with private channels',
      actions: [UI.moduleToggle('tickets', () => Router.render())],
      body: [
        UI.toggleRow('Enable tickets', 'Members can open support tickets', c.enabled, v => { set({ enabled: v }); }),
        UI.h('hr'),
        UI.h('div', { class: 'grid grid--2' }, [
          UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Ticket Channel' }), UI.channelPicker(c.activeChannel, v => set({ activeChannel: v }))]),
          UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Transcript Log' }), UI.channelPicker(c.logChannel, v => set({ logChannel: v }))]),
          UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Support Ping Role' }), UI.rolePicker(c.supportPing, v => set({ supportPing: v }))]),
          UI.selectField('Category Selection', c.selectCategory ? 'on' : 'off', [
            { value: 'on', label: 'Members pick a category' },
            { value: 'off', label: 'All tickets go to one place' },
          ], v => set({ selectCategory: v === 'on' })),
        ]),
        UI.h('div', { class: 'mt-16' }, [
          UI.toggleRow('Save transcripts', 'Store a full chat log when closed', c.transcript, v => set({ transcript: v })),
        ]),
      ],
      foot: [UI.saveBtn(async () => {
        /* har field waise bhi autosave hota hai — ye button poora form
           backend par force-sync karta hai, taaki "Saved!" jhooth na ho */
        const r = await API.saveConfig('tickets', {
          enabled: c.enabled,
          activeChannel: c.activeChannel,
          logChannel: c.logChannel,
          supportPing: c.supportPing,
          selectCategory: c.selectCategory,
          transcript: c.transcript,
        });
        if (r && r.offline) throw new Error('Backend connected nahi hai');
      })],
    }));

    left.appendChild(UI.card({
      title: '\u{1F4E6} Ticket Categories',
      sub: c.categories.length + ' categories · ' + c.totalOptions + ' options',
      actions: [UI.h('button', { class: 'btn btn--sm btn--soft', onclick: () => addCat() }, '＋ New category')],
      body: UI.h('div', { class: 'stack-sm' }, c.categories.map((cat, i) =>
        UI.h('div', {
          class: 'setting',
          style: 'align-items:flex-start;border:1px solid var(--line);border-radius:10px;padding:13px',
        }, [
          UI.h('div', { style: { width: '34px', textAlign: 'center', fontSize: '18px', flex: '0 0 34px' }, text: cat.emoji }),
          UI.h('div', { class: 'setting__meta' }, [
            UI.field('Label', cat.label, v => { cat.label = v; set({ categories: c.categories }); }, { max: 80 }),
            UI.h('div', { class: 'row gap-12 mt-8 wrap' }, [
              UI.h('div', { style: 'width:150px' }, [
                UI.h('label', { class: 'label', text: 'Channel Prefix' }),
                UI.h('input', { class: 'input', value: cat.prefix, oninput: (e) => { cat.prefix = e.target.value; set({ categories: c.categories }); } }),
              ]),
              UI.h('div', { class: 'color-field' }, [
                UI.h('label', { class: 'label', text: 'Colour' }),
                UI.h('input', { type: 'color', value: cat.color, oninput: (e) => { cat.color = e.target.value; set({ categories: c.categories }); } }),
              ]),
              UI.h('div', {}, [
                UI.h('label', { class: 'label', text: 'Opened' }),
                UI.h('div', { class: 'small bold', text: cat.opens }),
              ]),
            ]),
          ]),
          UI.h('div', { class: 'setting__control' }, [
            UI.h('button', {
              class: 'icon-btn icon-btn--sm', text: '✕',
              onclick: () => { c.categories.splice(i, 1); set({ categories: c.categories }); Router.render(); },
            }),
          ]),
        ])
      )),
    }));

    const right = UI.h('div', { class: 'stack' });

    right.appendChild(UI.card({
      title: '\u{1F4CA} Ticket Stats',
      body: [
        UI.h('div', { class: 'grid grid--2' }, [
          UI.stat('Open now', c.openTicket, { tone: 'amber' }),
          UI.stat('Total opened', c.categories.reduce((s, x) => s + x.opens, 0), { tone: 'brand' }),
        ]),
        UI.h('div', { class: 'mt-16' },
          UI.bars(c.categories.map(cat => ({ label: cat.label, value: cat.opens })))),
      ],
    }));

    right.appendChild(UI.card({
      title: '\u{1F5A5} Ticket Panel',
      sub: 'Posted in #' + DB.chName(c.activeChannel),
      body: UI.messageBox(UI.botName(), 'Today at 16:44', 'Need help? Open a ticket and our team will get back to you fast.',
        UI.embedPreview({
          color: '#7c5cff', title: '\u{1F3AB} APEX CHEATS — Support',
          desc: c.categories.map(cat => cat.emoji + '  **' + cat.label + '**').join('\n'),
          footer: 'Average response time: 12 minutes',
        })),
    }));

    return UI.h('div', { class: 'split' }, [left, right]);

    function addCat() {
      c.categories.push({
        id: 'tc' + Date.now(), label: 'New Category', emoji: '\u{1F4AC}', color: '#9b59b6', prefix: 'new', opens: 0, cat: 'Support',
      });
      c.totalOptions = c.categories.length;
      set({ categories: c.categories, totalOptions: c.categories.length });
      Router.render();
    }
  },
};

/* ============================================================
   TICKET LIVE VIEW (open tickets table)
   ---------------------------------------------------------
   Dashboard sidebar se link: #/tickets → config
   Yahan live list hai, click karke channel khul jata hai
   ============================================================ */
Pages.ticketsLive = {
  render: function () {
    const c = Store.merged('tickets');
    const wrap = UI.h('div', { class: 'stack' });

    /* live open tickets (backend) — offline ho to mock list */
    let rows = Array.isArray(c.openList) ? c.openList.slice() : [];
    let live = false;
    try {
      const st = (window.API && API.isReady() && API.state()) || null;
      if (st && Array.isArray(st.tickets)) {
        live = true;
        rows = st.tickets.map(t => ({
          id: '#' + t.number + ' · ' + (t.type || ''),
          subject: t.subject || '—',
          user: t.user_display || t.user_tag || t.user_id,
          wait: waitOf(t.created_at),
          staff: t.claimed_by_tag || '',
          channel: String(t.channel_id),
        }));
      }
    } catch (e) { /* mock rehne do */ }

    wrap.appendChild(UI.h('div', { class: 'grid grid--stats' }, [
      UI.stat('Open Tickets', rows.length, { icon: '\u{1F3AB}', tone: 'amber' }),
      UI.stat('Unclaimed', rows.filter(t => !t.staff).length, { icon: '\u26A0\uFE0F', tone: 'red' }),
      UI.stat('Claimed', rows.filter(t => t.staff).length, { icon: '\u2705', tone: 'green' }),
      UI.stat('Avg Wait', '12m', { icon: '\u23F1', tone: 'brand' }),
    ]));

    wrap.appendChild(UI.card({
      title: '\u{1F5DD} Open Tickets',
      sub: rows.length + ' active' + (live ? ' · live' : ''),
      actions: [UI.h('button', { class: 'btn btn--sm btn--soft', onclick: () => window.__refreshLive(true) }, '\u{1F504} Refresh')],
      body: rows.length ? UI.table([
        {
          label: 'Ticket', render: t => UI.h('div', {}, [
            UI.h('div', { class: 'mono small bold text-brand', text: t.id }),
            UI.h('div', { class: 'tiny dim truncate', style: 'max-width:220px', text: t.subject }),
          ]),
        },
        { label: 'User', render: t => UI.h('div', { class: 'row' }, [UI.avatar(t.user, '#7c5cff', 'sm'), UI.h('span', { class: 'small', text: t.user })]) },
        { label: 'Waiting', render: t => UI.pill(t.wait, String(t.wait).endsWith('h') ? 'warn' : 'info') },
        {
          label: 'Staff', render: t => t.staff
            ? UI.h('div', { class: 'row' }, [UI.avatar(t.staff, '#2ecc71', 'sm'), UI.h('span', { class: 'small', text: t.staff })])
            : UI.pill('Unclaimed', 'err'),
        },
        {
          label: '', render: (t) => UI.h('div', { class: 'table__actions' }, [
            t.staff
              ? UI.h('button', { class: 'btn btn--xs btn--ghost', text: 'Unclaim', onclick: () => clickAct('unclaim', t, 'Ticket unclaimed') })
              : UI.h('button', { class: 'btn btn--xs btn--ok', text: 'Claim', onclick: () => clickAct('claim', t, 'You claimed ' + t.id) }),
            UI.h('button', {
              class: 'btn btn--xs btn--danger', text: 'Close',
              onclick: () => {
                if (live && t.channel) {
                  UI.confirmDialog('Close ticket?', t.id + ' will be closed and the transcript saved.', () => clickAct('close', t, 'Ticket closed, transcript saved'));
                } else {
                  UI.confirmDialog('Close ticket?', t.id + ' will be closed and the transcript saved.', () => UI.toast('Ticket closed, transcript saved', 'ok'));
                }
              },
            }),
          ]),
        },
      ], rows) : UI.h('div', { class: 'small dim', text: live ? 'Abhi koi open ticket nahi hai — #create-ticket me button dabao.' : 'Backend offline hai.' }),
    }));

    return wrap;

    function waitOf(iso) {
      const ms = Date.now() - new Date(iso || Date.now()).getTime();
      const m = Math.max(1, Math.round(ms / 60000));
      return m >= 60 ? Math.floor(m / 60) + 'h' : m + 'm';
    }

    function clickAct(action, t, label) {
      if (!live || !t.channel) { UI.toast(label, 'ok'); return; }
      API.ticketAction(action, t.channel)
        .then(() => UI.toast(label, 'ok'))
        .catch(e => { UI.toast(e.message, 'err'); return; })
        .then(() => API.refresh().catch(() => null))
        .then(() => Router.render());
    }
  },
};
