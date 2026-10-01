/* ============================================================
   VDEX COP — pages/core.js
   Overview · Customization · Verification · Server Management
   ============================================================ */

window.Pages = window.Pages || {};

/* ============================================================
   OVERVIEW
   ============================================================ */
Pages.overview = {
  render: function () {
    const s = DB.server;
    const t = DB.config.tracking;
    const on = DB.modules.filter(m => Store.isOn(m.key)).length;

    const wrap = UI.h('div', { class: 'stack' });

    /* --- stats --- */
    wrap.appendChild(UI.h('div', { class: 'grid grid--stats' }, [
      UI.stat('Members', s.members.toLocaleString(), { icon: '\u{1F465}', tone: 'brand', sub: `<span class="text-green">+${t.netGrowth}</span> last 30 days` }),
      UI.stat('Online Now', s.online, { icon: '\u{1F7E2}', tone: 'green', sub: `${Math.round(s.online / s.members * 100)}% of members` }),
      UI.stat('Channels', s.channels, { icon: '#\uFE0F', tone: 'blue', sub: `${DB.channels.length} shown` }),
      UI.stat('Roles', s.roles, { icon: '\u{1F3E2}', tone: 'amber', sub: `${DB.roles.filter(r => r.staff).length} staff roles` }),
      UI.stat('Modules Active', on + ' / ' + DB.modules.length, { icon: '\u{1F9E9}', tone: 'green', sub: 'across the dashboard' }),
      UI.stat('Bot Uptime', s.uptime, { icon: '\u26A1', sub: `<span class="text-amber">${s.latency}ms</span> latency` }),
    ]));

    /* --- Server Mapping: demo slots (c1, r5) ko asli Discord ids se jodo ---
       Modules me abhi tak demo ids hain; ek baar map kar do to 24 kaam
       karne lagte hain. Save karne par backend `api/ids` me likh deta hai
       aur bot resolve karte waqt sabse pehle yahi dekhta hai. */
    (function mappingCard() {
      let st = null;
      try { st = (window.API && API.isReady() && API.state()) || null; } catch (e) { /* offline */ }
      const textCh = ((st && st.channels) || []).filter(c => c.type === 'text' || c.type === 'news');
      const roles = (st && st.roles) || [];
      const saved = (st && st.modules && st.modules._ids) || {};
      const chMap = Object.assign({}, saved.channels || {});
      const roleMap = Object.assign({}, saved.roles || {});
      const mockCh = DB.channels.filter(c => /^c\d+$/.test(c.id));
      const mockRoles = DB.roles.filter(r => /^r\d+$/.test(r.id));

      function makeSelect(list, value, placeholder) {
        const sel = UI.h('select', { class: 'input', style: 'width:100%;padding:6px 8px;font-size:12.5px' });
        sel.appendChild(UI.h('option', { value: '', text: placeholder }));
        list.forEach(x => sel.appendChild(UI.h('option', { value: x.id, text: x.text })));
        sel.value = value || '';
        return sel;
      }

      function rows(mock, map, list, prefix) {
        return UI.h('div', { class: 'stack-sm' }, mock.map(item => {
          const sel = makeSelect(list, map[item.id], '— chuno —');
          sel.addEventListener('change', () => {
            if (sel.value) map[item.id] = sel.value;
            else delete map[item.id];
          });
          const mapped = !!map[item.id];
          return UI.h('div', { class: 'setting' }, [
            UI.h('div', { class: 'setting__meta' }, [
              UI.h('div', { class: 'setting__label', text: `${item.id} → ${prefix}${item.name}` }),
            ]),
            UI.h('div', { class: 'setting__control' }, [sel]),
          ]);
        }));
      }

      const saveBtn = UI.h('button', {
        class: 'btn btn--primary btn--sm',
        onclick: async (e) => {
          const b = e.currentTarget;
          const old = b.textContent;
          b.disabled = true; b.textContent = '…';
          try {
            await API.saveIds({ channels: chMap, roles: roleMap });
            UI.toast('Mapping save — ab 24 modules asli channels/roles use karenge', 'ok', 5000);
            Router.render();
          } catch (err) {
            UI.toast('Mapping save fail: ' + err.message, 'err', 6000);
          } finally { b.disabled = false; b.textContent = old; }
        },
      }, '\u{1F4BE} Save mapping');

      const filled = Object.keys(chMap).length + Object.keys(roleMap).length;
      const total = mockCh.length + mockRoles.length;

      wrap.appendChild(UI.card({
        title: '\u{1F517} Server Mapping',
        sub: `${filled} / ${total} slots mapped — modules ke liye ye zaroori hai`,
        actions: [saveBtn],
        body: UI.h('div', { class: 'split' }, [
          UI.h('div', { class: 'stack' }, [
            UI.h('div', { class: 'tiny dim mb-8', text: 'Channels (demo c1..c13)' }),
            rows(mockCh, chMap, textCh.map(c => ({ id: c.id, text: '# ' + c.name })), '#'),
          ]),
          UI.h('div', { class: 'stack' }, [
            UI.h('div', { class: 'tiny dim mb-8', text: 'Roles (demo r1..r14)' }),
            rows(mockRoles, roleMap, roles.map(r => ({ id: r.id, text: '@' + r.name })), '@'),
          ]),
        ]),
      }));
    })();

    /* --- main split --- */
    const left = UI.h('div', { class: 'stack' });

    left.appendChild(UI.card({
      title: '\u{1F4CA} Member Growth',
      sub: 'Last 30 days — joins vs leaves',
      actions: [UI.pill('30 days', 'info')],
      body: [
        UI.sparkline(t.daily, { h: 130, labels: ['30 days ago', 'Today'] }),
        UI.h('div', { class: 'grid grid--3 mt-16' }, [
          UI.stat('Joins', t.totalJoins, { tone: 'green' }),
          UI.stat('Leaves', t.totalLeaves, { tone: 'red' }),
          UI.stat('Net', '+' + t.netGrowth, { tone: 'brand' }),
        ]),
      ],
    }));

    left.appendChild(UI.card({
      title: '\u{1F5C2} All Modules',
      sub: 'Click any module to configure it',
      actions: [UI.h('a', { class: 'btn btn--sm btn--ghost', href: '#/customization', text: 'Manage' })],
      body: UI.h('div', { class: 'grid grid--cards' },
        DB.modules.filter(m => m.key !== 'overview').map(m =>
          UI.h('a', { class: 'mcard', href: '#/' + m.key }, [
            UI.h('div', { class: 'mcard__top' }, [
              UI.h('div', { class: 'mcard__ico', text: m.icon }),
              UI.h('div', { class: 'grow' }, [
                UI.h('div', { class: 'mcard__title', text: m.name }),
              ]),
              UI.pill(Store.isOn(m.key) ? 'On' : 'Off', Store.isOn(m.key) ? 'on' : 'off'),
            ]),
            UI.h('div', { class: 'mcard__desc', text: m.desc }),
          ])
        )
      ),
    }));

    /* --- right column --- */
    const right = UI.h('div', { class: 'stack' });

    right.appendChild(UI.card({
      title: '\u{1F6E1} Security Status',
      body: [
        UI.h('div', { class: 'stack-sm' }, [
          secRow('Anti-Nuke', Store.isOn('antinuke'), DB.config.antinuke.thresholds.filter(t2 => t2.on).length + ' rules active'),
          secRow('Scam Protection', Store.isOn('scam'), DB.config.scam.blockedLinks + ' links blocked'),
          secRow('Verification', Store.isOn('verification'), 'Entry gate active'),
          secRow('Tickets', Store.isOn('tickets'), DB.config.tickets.openTicket + ' open'),
        ]),
        UI.h('div', { class: 'mt-16' }, UI.alert('ok', 'No active threats detected. Last raid blocked <b>2 hours ago</b>.')),
      ],
    }));

    right.appendChild(UI.card({
      title: '\u{1F4CD} Join Sources',
      sub: 'Last 30 days',
      body: UI.bars(DB.config.tracking.sources.map((s2, i) => ({
        label: s2.name, value: s2.count, tone: ['', 'green', 'blue', 'amber'][i],
      }))),
    }));

    right.appendChild(UI.card({
      title: '\u{1F4F1} Quick Links',
      body: UI.h('div', { class: 'stack-sm' }, [
        quickLink('\u{1F3AB} Open Tickets', '#/tickets', DB.config.tickets.openTicket + ' open'),
        quickLink('\u{1F44B} Welcome', '#/welcome', Store.isOn('welcome') ? 'On' : 'Off'),
        quickLink('\u{1F9F0} Sticky Messages', '#/stickymessages', Store.isOn('stickymessages') ? 'On' : 'Off'),
        quickLink('\u{1F4A1} Embed Builder', '#/embedbuilder', Store.isOn('embedbuilder') ? 'On' : 'Off'),
      ]),
    }));

    wrap.appendChild(UI.h('div', { class: 'split' }, [left, right]));

    /* --- recent activity --- */
    wrap.appendChild(UI.card({
      title: '\u{1F4CA} Recent Activity',
      actions: [UI.h('a', { class: 'btn btn--sm btn--ghost', href: '#/servermgmt', text: 'View all' })],
      body: UI.table([
        { label: 'When', render: a => UI.h('span', { class: 'dim small nowrap', text: a.t }) },
        { label: 'Event', render: a => UI.pill(a.event, evtTone(a.type)) },
        { label: 'User', render: a => UI.h('div', { class: 'row' }, [UI.avatar(a.who, '#7c5cff', 'sm'), UI.h('span', { class: 'small', text: a.who })]) },
        { label: 'Details', render: a => UI.h('span', { class: 'small muted', text: a.detail }) },
      ], DB.auditLog.slice(0, 7)),
    }));

    return wrap;

    function secRow(name, isOn, sub) {
      return UI.h('div', { class: 'row justify-b' }, [
        UI.h('div', {}, [
          UI.h('div', { class: 'small bold', text: name }),
          UI.h('div', { class: 'tiny dim', text: sub }),
        ]),
        UI.pill(isOn ? 'Active' : 'Off', isOn ? 'on' : 'off'),
      ]);
    }
    function quickLink(label, href, sub) {
      return UI.h('a', { class: 'setting', href, style: 'text-decoration:none' }, [
        UI.h('div', { class: 'setting__meta' }, [
          UI.h('div', { class: 'setting__label', text: label }),
          UI.h('div', { class: 'setting__desc', text: sub }),
        ]),
        UI.h('span', { class: 'dim', text: '→' }),
      ]);
    }
    function evtTone(t) {
      return { ban: 'err', warn: 'warn', delete: 'warn', role: 'info', system: 'brand', join: 'on', boost: 'pink', channel: 'info' }[t] || null;
    }
  },
};

/* ============================================================
   CUSTOMIZATION
   ============================================================ */
Pages.customization = {
  render: function () {
    const c = Store.merged('customization');
    /* Live Preview turant update ho — isi liye set() me drawPreview() (poora
       Router.render() nahi, warna colour picker beech me toot jata). */
    const set = (patch) => { Store.setCfg('customization', patch); drawPreview(); };

    const left = UI.h('div', { class: 'stack' });
    const hexLabel = UI.h('span', { class: 'mono small', text: c.accentColor });

    left.appendChild(UI.card({
      title: '\u{1F3A8} Server Identity',
      sub: 'Name, description and banner — Save par Discord par apply hota hai',
      actions: [UI.moduleToggle('customization', () => Router.render())],
      body: [
        UI.field('Server Name', c.serverName, v => { set({ serverName: v }); }, { max: 100, on: true, hint: 'Max 100 characters (Discord limit) — type karte hi neeche preview live update hota hai.' }),
        UI.field('Server Description', c.description, v => set({ description: v }), { textarea: true, rows: 3, max: 200, on: true }),
        UI.h('div', { class: 'field mt-16' }, [
          UI.h('label', { class: 'label', text: 'Accent Colour' }),
          UI.h('div', { class: 'color-field' }, [
            UI.h('input', {
              type: 'color', value: c.accentColor,
              oninput: (e) => { hexLabel.textContent = e.target.value; set({ accentColor: e.target.value }); },
              onchange: (e) => { hexLabel.textContent = e.target.value; set({ accentColor: e.target.value }); },
            }),
            hexLabel,
            UI.h('span', { class: 'dim', text: '·' }),
            UI.h('span', { class: 'small dim', text: 'Used in embeds and the dashboard theme' }),
          ]),
        ]),
        UI.field('Banner Image URL', c.banner, v => set({ banner: v }), { placeholder: 'https://cdn.discordapp.com/banners/.../…png', hint: 'Recommended 600×240.' }),
      ],
      foot: [UI.saveBtn(() => {}), UI.h('span', { class: 'tiny dim', text: 'Changes go live instantly on save.' })],
    }));

    left.appendChild(UI.card({
      title: '\u{1F916} Bot Identity',
      sub: 'Bot ka naam — Apply/Save par Discord par lag jaata hai',
      body: [
        UI.field('Bot Name (is server me)', c.botName, v => set({ botName: v }), {
          on: true, max: 32, placeholder: 'Apex Bot',
          hint: 'Server members ko yahi dikhta hai (Discord nickname, max 32). Khali chhodo = asli Discord naam. Type karte hi neeche preview live.',
        }),
        UI.h('hr'),
        UI.field('Global Discord Username', c.botUsername, v => set({ botUsername: v }), {
          on: true, max: 32, placeholder: 'Apex Bot',
          hint: 'Poore Discord par username badalta hai — Discord limit: 2 badle/ghante (429 aaye to thodi der baad dobara). Khali = mat chhoo.',
        }),
        UI.h('hr'),
        UI.field('Bot DP (image URL)', c.botAvatar, v => set({ botAvatar: v }), {
          on: true, placeholder: 'https://…/icon.png  ya  server message link',
          hint: 'Seedhi image URL (image/*) ya server message link — Embed Builder wale rules. Khali = mat chhoo, likho reset = wapas Discord default DP.',
        }),
        UI.field('Bot Banner (image URL)', c.botBanner, v => set({ botBanner: v }), {
          on: true, placeholder: 'https://…/banner.png  ya  server message link',
          hint: 'Profile banner (Discord wali banner jagah) — 600×240 accha dikhta hai. Khali = mat chhoo, likho reset = banner hatao.',
        }),
        UI.alert('info', 'Neela <b>⚡ Apply on Discord</b> dabao to turant lagta hai; warna Save ke kuch second baad khud lag jaata hai.'),
      ],
      foot: [
        UI.saveBtn(() => {}),
        UI.h('button', {
          class: 'btn btn--ok',
          onclick: async (e) => {
            const b = e.currentTarget;
            const old = b.textContent;
            b.disabled = true;
            b.textContent = '\u2026';
            try {
              const r = await API.testModule('customization');
              UI.toast(UI.esc(r.result || 'applied'), 'ok', 9000);
            } catch (err) {
              UI.toast('Apply fail: ' + UI.esc(err.message), 'err', 9000);
            } finally {
              b.disabled = false;
              b.textContent = old;
            }
          },
        }, '\u26A1 Apply on Discord'),
      ],
    }));

    left.appendChild(UI.card({
      title: '\u{1F4E1} System Channels',
      sub: 'Where the bot posts and listens',
      body: [
        UI.h('div', { class: 'grid grid--2' }, [
          UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'System Channel' }), UI.channelPicker(c.systemChannel, v => set({ systemChannel: v }))]),
          UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Rules Channel' }), UI.channelPicker(c.rulesChannel, v => set({ rulesChannel: v }))]),
          UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Public Updates' }), UI.channelPicker(c.publicUpdates, v => set({ publicUpdates: v }))]),
          UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Default Notifications' }), UI.channelPicker(c.defaultNotifications, v => set({ defaultNotifications: v }))]),
        ]),
      ],
    }));

    left.appendChild(UI.card({
      title: '\u{1F30A} Welcome Splash',
      sub: 'What new members see on join',
      body: [
        UI.selectField('Splash Type', c.splash, [
          { value: 'none', label: 'None — classic' },
          { value: 'level', label: 'Level' },
          { value: 'member', label: 'Member Count' },
          { value: 'boost', label: 'Boost Count' },
        ], v => set({ splash: v })),
      ],
    }));

    const right = UI.h('div', { class: 'stack' });

    /* Live Preview ka poora khandaas yahin rebuild hota hai — accent colour,
       naam, description kuch bhi badlo to turant dikhe (poora Router.render()
       nahi: usse colour picker beech me toot jata). */
    const previewBox = UI.h('div', { class: 'stack' });
    right.appendChild(UI.card({
      title: '\u{1F5BC} Live Preview',
      sub: 'Accent colour / naam / description — sab live',
      body: previewBox,
    }));

    function drawPreview() {
      const cc = Store.merged('customization');
      previewBox.innerHTML = '';
      previewBox.appendChild(previewBanner(cc));
      previewBox.appendChild(UI.h('div', { style: 'text-align:center;padding:6px 0' }, [
        UI.h('div', { class: 'row items-c', style: 'justify-content:center;gap:10px' }, [
          UI.h('div', {
            style: {
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'linear-gradient(135deg,#ff4757,#b3273a)',
              display: 'grid', placeItems: 'center',
              fontSize: '22px', fontWeight: '800', color: '#fff',
            },
            text: (cc.serverName || 'A').slice(0, 1).toUpperCase(),
          }),
          UI.h('div', { style: 'text-align:left' }, [
            UI.h('div', { class: 'bold', text: cc.serverName }),
            UI.h('div', { class: 'tiny dim', text: DB.server.members.toLocaleString() + ' members · ' + DB.server.online + ' online' }),
          ]),
        ]),
        UI.h('div', { class: 'tiny dim mt-8', text: cc.description }),
        UI.h('div', { class: 'row items-c', style: 'justify-content:center;gap:6px;margin-top:6px' }, [
          UI.h('span', { class: 'tiny dim', text: '\u{1F916} Bot:' }),
          UI.h('span', { class: 'tiny bold', text: cc.botName || (function () {
            try { const s = API.state(); return (s && s.bot_name) || 'Apex Bot'; } catch (e) { return 'Apex Bot'; }
          })() }),
          cc.botUsername ? UI.h('span', { class: 'tiny dim', text: '\u00B7 global: ' + cc.botUsername }) : null,
        ]),
      ]));
    }
    drawPreview();

    right.appendChild(UI.card({
      title: '\u{1F517} Invite Link',
      body: [
        UI.h('div', { class: 'input-group' }, [
          UI.h('input', { class: 'input mono', value: DB.server.invite, readonly: true }),
          UI.h('button', { class: 'btn btn--ghost', onclick: () => UI.copy(DB.server.invite, 'Invite link copied') }, '\u{1F4CB} Copy'),
        ]),
        UI.field('Vanity URL', c.vanityURL, v => set({ vanityURL: v }), { placeholder: 'discord.gg/apexcheats', hint: 'Requires Discord Nitro and server level 3.' }),
      ],
    }));

    right.appendChild(UI.card({
      title: '\u26A1 Module Switches',
      sub: 'Quick on/off for the whole dashboard',
      body: DB.modules.filter(m => m.key !== 'overview' && m.key !== 'customization').map(m =>
        UI.h('div', { class: 'setting' }, [
          UI.h('div', { class: 'setting__meta' }, [
            UI.h('div', { class: 'setting__label', text: m.icon + '  ' + m.name }),
          ]),
          UI.h('div', { class: 'setting__control' },
            UI.switchBox(Store.isOn(m.key), v => {
              Store.setOn(m.key, v);
              UI.toast(`<b>${UI.esc(m.name)}</b> ${v ? 'enabled' : 'disabled'}`, v ? 'ok' : 'info');
              Router.render();
            })),
        ])
      ),
    }));

    return UI.h('div', { class: 'split' }, [left, right]);

    function previewBanner(c2) {
      return UI.h('div', {
        style: {
          height: '104px', borderRadius: '10px',
          background: 'linear-gradient(120deg,' + c2.accentColor + '33,' + c2.accentColor + '0a)',
          border: '1px solid ' + c2.accentColor + '44',
          display: 'grid', placeItems: 'center',
          overflow: 'hidden', position: 'relative',
        },
      }, UI.h('div', { class: 'tiny dim', text: c2.banner ? 'Banner preview' : 'No banner set' }));
    }
  },
};

/* ============================================================
   VERIFICATION
   ============================================================ */
Pages.verification = {
  render: function () {
    const c = Store.merged('verification');
    const set = (patch) => { Store.setCfg('verification', patch); drawPreview(); };

    const left = UI.h('div', { class: 'stack' });

    left.appendChild(UI.card({
      title: '\u2705 Verification Gate',
      sub: 'Require proof of humanity before accessing the server',
      actions: [UI.moduleToggle('verification', () => Router.render())],
      body: [
        UI.toggleRow('Enable verification', 'When on, new members must verify before they can see anything', c.enabled, v => { set({ enabled: v }); Router.render(); }),
        UI.h('hr'),
        UI.selectField('Verification Mode', c.mode, [
          { value: 'captcha', label: 'Captcha — image challenge' },
          { value: 'button', label: 'Simple button — click to verify' },
          { value: 'question', label: 'Question — human check' },
          { value: 'role', label: 'Hybrid — captcha then role check' },
        ], v => set({ mode: v }), { hint: 'Captcha blocks most bots, button is friendliest.' }),
        UI.h('div', { class: 'grid grid--2 mt-16' }, [
          UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Gate Channel' }), UI.channelPicker(c.gateChannel, v => set({ gateChannel: v }), { textOnly: true })]),
          UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Role to Assign' }), UI.rolePicker(c.roleToAssign, v => { set({ roleToAssign: v, autoRole: v }); })]),
        ]),
      ],
    }));

    left.appendChild(UI.card({
      title: '\u{1F6E1} Entry Rules',
      sub: 'Auto-reject raiders and brand new accounts',
      body: [
        UI.h('div', { class: 'grid grid--2' }, [
          UI.field('Min Account Age (days)', c.minAccountAge, v => set({ minAccountAge: v }), { type: 'number', hint: '0 = allow fresh accounts' }),
          UI.field('Verify Timeout (minutes)', c.verifyTimeout, v => set({ verifyTimeout: v }), { type: 'number', hint: 'Unverified members get removed after this' }),
        ]),
        UI.h('div', { class: 'mt-16' }, [
          UI.toggleRow('Kick on failure', 'Remove members who fail verification', c.kickOnFail, v => set({ kickOnFail: v })),
          UI.toggleRow('Allow role re-check', 'Let already-verified members verify again', c.allowRoleRecheck, v => set({ allowRoleRecheck: v })),
          UI.toggleRow('Check alt accounts', 'Look for linked alts on ban', c.checkAlt, v => set({ checkAlt: v })),
          UI.toggleRow('Spam blacklist', 'Block known spam accounts', c.checkSpam, v => set({ checkSpam: v })),
        ]),
      ],
    }));

    left.appendChild(UI.card({
      title: '\u{1F9E9} Captcha Settings',
      body: [
        UI.h('div', { class: 'grid grid--2' }, [
          UI.selectField('Captcha Type', c.captchaType, [
            { value: 'image', label: 'Image text' },
            { value: 'click', label: 'Click the object' },
            { value: 'math', label: 'Math problem' },
          ], v => set({ captchaType: v })),
          UI.selectField('Difficulty', c.captchaDifficulty, [
            { value: 'easy', label: 'Easy' },
            { value: 'medium', label: 'Medium' },
            { value: 'hard', label: 'Hard' },
          ], v => set({ captchaDifficulty: v })),
        ]),
      ],
    }));

    const right = UI.h('div', { class: 'stack' });

    right.appendChild(UI.card({
      title: '\u{1F4DD} Entry Message',
      body: [
        UI.field('Message', c.entryMessage, v => set({ entryMessage: v }), { textarea: true, rows: 4, max: 1000, on: true }),
        UI.field('Button Label', c.buttonLabel, v => set({ buttonLabel: v }), { max: 80, on: true }),
      ],
    }));

    /* ---- live preview: set() isi ko dobara banata hai ---- */
    const previewBox = UI.h('div', { class: 'stack' });
    function drawPreview() {
      const cur = Store.merged('verification');
      previewBox.innerHTML = '';
      previewBox.appendChild(
        UI.messageBox(UI.botName(), 'Today at 16:44', '',
          UI.embedPreview({
            color: '#2ecc71', title: '\u{1F6E1} Verification Required',
            desc: cur.entryMessage,
            fields: [
              { name: 'Challenge', value: cur.captchaType === 'image' ? 'Image text' : cur.captchaType === 'math' ? 'Math problem' : 'Click the object' },
              { name: 'Difficulty', value: cur.captchaDifficulty },
              { name: 'Expires in', value: cur.verifyTimeout + ' minutes' },
            ],
            footer: 'Role granted instantly on success',
          })
        ));
      previewBox.appendChild(UI.h('div', { class: 'center' },
        UI.h('button', {
          class: 'btn btn--ok',
          onclick: () => UI.toast('Preview: captcha would be solved here', 'ok'),
        }, '\u2705 ' + (cur.buttonLabel || 'Verify'))));
    }

    right.appendChild(UI.card({
      title: '\u{1F5A5} How members see it',
      sub: 'Live preview — likhte hi update',
      body: previewBox,
    }));
    drawPreview();

    if (!c.enabled) {
      right.appendChild(UI.h('div', {}, UI.alert('warn', 'Verification is <b>disabled</b>. New members currently join without any check.')));
    }

    return UI.h('div', { class: 'split' }, [left, right]);
  },
};

/* ============================================================
   SERVER MANAGEMENT
   ============================================================ */
Pages.servermgmt = {
  render: function () {
    const s = DB.server;
    const left = UI.h('div', { class: 'stack' });

    left.appendChild(UI.card({
      title: '\u{1F5C2} Server Profile',
      body: [
        UI.h('div', { class: 'row mb-16', style: 'gap:14px' }, [
          UI.h('div', {
            style: {
              width: '64px', height: '64px', borderRadius: '16px', flex: '0 0 64px',
              background: 'linear-gradient(135deg,#ff4757,#b3273a)', display: 'grid',
              placeItems: 'center', fontSize: '26px', fontWeight: '800', color: '#fff',
            },
            text: s.icon,
          }),
          UI.h('div', { class: 'grow' }, [
            UI.h('div', { class: 'bold', style: 'font-size:16px', text: s.name }),
            UI.h('div', { class: 'tiny dim', text: 'ID ' + s.id }),
            UI.h('div', { class: 'row gap-6 mt-4' }, [
              UI.pill('Tier ' + s.boostTier + ' Boost', 'pink'),
              UI.pill(s.boostCount + ' boosts', 'info'),
              UI.pill(s.verifyLevel + ' verification', 'on'),
            ]),
          ]),
        ]),
        UI.table([
          { label: 'Property', render: r => UI.h('span', { class: 'small muted', text: r[0] }) },
          { label: 'Value', render: r => UI.h('span', { class: 'small bold', text: r[1] }) },
        ], [
          ['Owner', s.owner + ' (' + s.ownerId + ')'],
          ['Created', UI.relDate(s.createdAt)],
          ['Region', s.region],
          ['Locale', s.locale],
          ['Verification level', s.verifyLevel],
          ['Boost tier', 'Tier ' + s.boostTier],
        ]),
      ],
    }));

    /* ---- Server profile → Discord par APPLY (asli logic, demo config nahi) ---- */
    (function () {
      const sm = Store.merged('servermgmt');
      const set = (patch) => Store.setCfg('servermgmt', patch);
      left.appendChild(UI.card({
        title: '\u{2699}\u{FE0F} Apply Server Profile',
        sub: 'Save par bot Discord API se ye sab ASLI me badal deta hai',
        actions: [UI.moduleToggle('servermgmt', () => Router.render())],
        body: [
          UI.field('Server name', sm.name || '', v => set({ name: v }),
            { placeholder: 'khali = server ka naam mat chhuo', max: 100 }),
          UI.field('Description', sm.description || '', v => set({ description: v }),
            { textarea: true, rows: 3, max: 300,
              hint: 'khali = description hat jayegi' }),
          UI.selectField('Verification level', sm.verificationLevel, [
            { value: 'none', label: 'None' }, { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' },
            { value: 'highest', label: 'Highest' },
          ], v => set({ verificationLevel: v })),
          UI.selectField('Default notifications', sm.defaultNotifications, [
            { value: 'mentions', label: 'Sirf @mentions' },
            { value: 'all', label: 'Saare messages' },
          ], v => set({ defaultNotifications: v })),
          UI.selectField('AFK timeout', String(sm.afkTimeout), [
            { value: '60', label: '1 min' }, { value: '300', label: '5 min' },
            { value: '900', label: '15 min' }, { value: '1800', label: '30 min' },
            { value: '3600', label: '1 hour' },
          ], v => set({ afkTimeout: Number(v) })),
          UI.h('div', { class: 'field' }, [
            UI.h('label', { class: 'label', text: 'AFK channel' }),
            UI.channelPicker(sm.afkChannel || '', v => set({ afkChannel: v })),
          ]),
          UI.saveBtn(() => 'Server profile save — bot apply karega'),
        ],
      }));
    })();

    left.appendChild(UI.card({
      title: '\u{1F517} Invite Tracking',
      sub: 'Every invite and where it brought people from',
      body: UI.table([
        { label: 'Code', render: i => UI.h('span', { class: 'mono small bold', text: 'discord.gg/' + i.code }) },
        { label: 'Uses', render: i => UI.h('span', { class: 'small', text: i.uses.toLocaleString() }) },
        { label: 'Members', render: i => UI.h('span', { class: 'small text-green', text: '+' + i.members }) },
        { label: 'Source', render: i => UI.h('span', { class: 'small dim', text: i.source }) },
        { label: 'Status', render: i => UI.pill(i.active ? 'Active' : 'Expired', i.active ? 'on' : null) },
        {
          label: '', render: i => UI.h('div', { class: 'table__actions' }, [
            UI.h('button', { class: 'btn btn--xs btn--ghost', onclick: () => UI.copy('https://discord.gg/' + i.code, 'Invite copied') }, 'Copy'),
            i.active ? UI.h('button', {
              class: 'btn btn--xs btn--danger', text: 'Delete',
              onclick: () => UI.confirmDialog('Delete invite?', 'discord.gg/' + i.code + ' will stop working immediately.', () => UI.toast('Invite deleted', 'ok')),
            }) : null,
          ])
        },
      ], DB.config.invites.invites),
    }));

    const right = UI.h('div', { class: 'stack' });

    right.appendChild(UI.card({
      title: '\u{1F6E8} Moderation Snapshot',
      body: [
        UI.h('div', { class: 'grid grid--3' }, [
          UI.stat('Banned', s.banned, { tone: 'red' }),
          UI.stat('Muted', s.mutes, { tone: 'amber' }),
          UI.stat('Warnings', s.warns, { tone: 'blue' }),
        ]),
        UI.h('div', { class: 'mt-16' }, UI.alert('info', 'Use <b>/ban</b>, <b>/kick</b> and <b>/timeout</b> commands in the server — the dashboard is read-only for these.')),
      ],
    }));

    right.appendChild(UI.card({
      title: '\u{1F4C4} Audit History',
      sub: 'Last 10 events',
      actions: [UI.h('a', { class: 'btn btn--sm btn--ghost', href: '#/overview', text: 'Full log' })],
      body: UI.h('div', { class: 'stack-sm' }, DB.auditLog.map(a =>
        UI.h('div', { class: 'row justify-b' }, [
          UI.h('div', { class: 'grow' }, [
            UI.h('div', { class: 'small', text: a.detail }),
            UI.h('div', { class: 'tiny dim', text: a.t + ' · ' + a.who }),
          ]),
          UI.pill(a.event, a.type === 'ban' ? 'err' : a.type === 'warn' ? 'warn' : null),
        ])
      )),
    }));

    right.appendChild(UI.card({
      title: '\u{1F9F0} Danger Zone',
      body: [
        UI.h('div', { class: 'stack-sm' }, [
          dangerBtn('\u{1F6AB} Leave server', 'The bot leaves this server', () => UI.toast('Bot cannot leave its own server', 'err'), 'btn--ghost'),
          dangerBtn('\u{1F5D1} Delete all channels', 'Permanently removes every channel', () => UI.confirmDialog('Delete all channels?', 'This cannot be undone.', () => UI.toast('Blocked: owner only', 'err')), 'btn--danger'),
          dangerBtn('\u{1F4C8} Reset all settings', 'Wipes every module configuration', () => UI.confirmDialog('Reset everything?', 'All 25+ modules return to defaults.', () => {
            Object.keys(Store.defaults).forEach(k => Store.reset(k));
            UI.toast('All settings reset to defaults', 'ok');
            Router.render();
          }), 'btn--danger'),
        ]),
      ],
    }));

    return UI.h('div', { class: 'split' }, [left, right]);

    function dangerBtn(label, desc, onClick, cls) {
      return UI.h('button', { class: 'w-full ' + cls, style: 'justify-content:flex-start;text-align:left;height:auto;padding:11px 14px', onclick: onClick }, [
        UI.h('div', {}, [
          UI.h('div', { class: 'small bold', text: label }),
          UI.h('div', { class: 'tiny', style: 'opacity:.75;font-weight:400', text: desc }),
        ]),
      ]);
    }
  },
};
