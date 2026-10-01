/* ============================================================
   VDEX COP — pages/moderation.js
   Anti-Nuke · Automod · Scam Protection · Audit Logging
   ============================================================ */

/* ============================================================
   ANTI-NUKE
   ============================================================ */
Pages.antinuke = {
  render: function () {
    const c = Store.merged('antinuke');
    const set = (patch) => Store.setCfg('antinuke', patch);

    const left = UI.h('div', { class: 'stack' });

    left.appendChild(UI.card({
      title: '\u{1F6E1} Anti-Nuke Protection',
      sub: 'Catches and punishes mass actions instantly',
      actions: [UI.moduleToggle('antinuke', () => Router.render())],
      body: [
        UI.toggleRow('Enable Anti-Nuke', 'Blocks raid and mass-ban attacks', c.enabled, v => { set({ enabled: v }); Router.render(); }),
        UI.h('hr'),
        UI.selectField('Default Punishment', c.action, [
          { value: 'ban', label: 'Ban — remove the attacker' },
          { value: 'kick', label: 'Kick — remove but allow rejoin' },
          { value: 'banDelete', label: 'Ban + delete their messages' },
          { value: 'log', label: 'Log only — no action' },
        ], v => set({ action: v })),
        UI.h('div', { class: 'mt-16' }, [
          UI.toggleRow('Whitelist admins', 'Sirf server owner chhoda jayega — OFF (default) par admin ko bhi ban/kick lagegi', c.whitelistAdmins, v => set({ whitelistAdmins: v })),
          UI.toggleRow('Send alerts', 'DM the owner when a rule trips', c.alerts, v => set({ alerts: v })),
        ]),
        UI.h('div', { class: 'field mt-16' }, [
          UI.h('label', { class: 'label', text: 'Alert Channel' }),
          UI.channelPicker(c.logChannel, v => set({ logChannel: v })),
        ]),
      ],
    }));

    /* threshold table */
    const rows = c.thresholds.map(t => {
      const limitEl = UI.h('input', { class: 'input', type: 'number', value: t.limit, style: 'width:70px', min: 1, max: 50 });
      const winEl = UI.selectField('', t.window, [
        { value: '5s', label: '5s' }, { value: '10s', label: '10s' }, { value: '15s', label: '15s' },
        { value: '30s', label: '30s' }, { value: '60s', label: '60s' },
      ], v => { t.window = v; set({ thresholds: c.thresholds }); });
      const actEl = UI.selectField('', t.action, [
        { value: 'Ban', label: 'Ban' }, { value: 'Kick', label: 'Kick' },
        { value: 'Ban + Delete Msgs', label: 'Ban + Delete Msgs' }, { value: 'Log', label: 'Log only' },
      ], v => { t.action = v; set({ thresholds: c.thresholds }); });

      return UI.h('tr', {}, [
        UI.h('td', {}, UI.h('span', { class: 'small bold', text: t.event })),
        UI.h('td', {}, limitEl),
        UI.h('td', {}, winEl.querySelector('select')),
        UI.h('td', {}, actEl.querySelector('select')),
        UI.h('td', {}, UI.h('div', { class: 'center' }, UI.switchBox(t.on, v => { t.on = v; set({ thresholds: c.thresholds }); }))),
        UI.h('td', {}, UI.h('div', { class: 'table__actions' }, [
          UI.h('button', {
            class: 'btn btn--xs btn--danger', text: 'Remove',
            onclick: () => {
              c.thresholds.splice(c.thresholds.indexOf(t), 1);
              set({ thresholds: c.thresholds });
              Router.render();
            },
          }),
        ])),
      ]);
    });

    left.appendChild(UI.card({
      title: '\u{1F6A8} Action Thresholds',
      sub: 'How many actions in what window before punishment',
      body: [
        UI.h('div', { class: 'table-wrap' }, [
          UI.h('div', { class: 'table-scroll' }, [
            UI.h('table', { class: 'table' }, [
              UI.h('thead', {}, UI.h('tr', {}, ['Action', 'Limit', 'Window', 'Punish', 'On', ''].map(x => UI.h('th', { text: x })))),
              UI.h('tbody', {}, rows),
            ]),
          ]),
        ]),
        UI.alert('info',
          '<b>Limit = 1</b> ka matlab pehle hi action par trip — koi time/counting wait nahi. '
          + 'Window ab sirf <i>executor dhoondne</i> ke liye use hota hai (audit log ka lag). '
          + 'Saza: sirf <b>server owner</b> chhoda jata hai (admin ko bhi ban).'),
        UI.h('button', {
          class: 'btn btn--soft mt-16',
          onclick: () => {
            c.thresholds.push({ id: 't' + Date.now(), event: 'New Rule', limit: 1, window: '10s', action: 'Ban', on: true });
            set({ thresholds: c.thresholds });
            Router.render();
          },
        }, '＋ Add threshold'),
      ],
      foot: [UI.saveBtn(() => {})],
    }));

    /* ---------------- Anti-Nuke Instances (spec §4) ---------------- */
    const instances = ((DB.antinuke && DB.antinuke.instances) || []).slice();

    left.appendChild(UI.card({
      title: '🛡️ Anti-Nuke Instances',
      sub: 'Har instance ka apna config, whitelist aur rules',
      actions: [UI.h('button', {
        class: 'btn btn--sm btn--primary',
        onclick: () => instanceModal(null),
      }, '＋ Create Anti-Nuke Instance')],
      body: instances.length
        ? UI.h('div', { class: 'stack-sm' }, instances.map(instanceCard))
        : UI.h('div', {},
            UI.alert('info', 'Abhi koi instance nahi hai. <b>Create Anti-Nuke Instance</b> dabao — '
              + 'upar wali "Default rules" se alag ek protection layer ban jayegi.')),
    }));

    /* ---------------- Whitelist / protected / recovery ---------------- */
    left.appendChild(UI.card({
      title: '🔑 Whitelist & Protected',
      sub: 'Inhe kabhi khud saza nahi di jayegi (spec §7)',
      body: [
        idChips('user', c.whitelistUsers || (c.whitelistUsers = []), v => set({ whitelistUsers: v })),
        UI.h('div', { class: 'hint', text: 'Upar: whitelisted users (Discord id) — inhe chhoda jayega.' }),
        idChips('role', c.whitelistRoles || (c.whitelistRoles = []), v => set({ whitelistRoles: v })),
        UI.h('hr'),
        idChips('role', c.protectedRoles || (c.protectedRoles = []), v => set({ protectedRoles: v })),
        UI.h('div', { class: 'hint', text: 'Protected roles — in role wale members par kabhi ban/kick nahi.' }),
        idChips('channel', c.protectedChannels || (c.protectedChannels = []), v => set({ protectedChannels: v })),
        UI.h('hr'),
        UI.toggleRow('Whitelist admins',
          'ON = admin chhode jayenge. OFF (default) = sirf owner safe — admin ko bhi ban/kick lagegi',
          c.whitelistAdmins, v => set({ whitelistAdmins: v })),
        UI.h('div', { class: 'grid grid--2 mt-16' }, [
          UI.field('Timeout (minutes)', c.timeoutMinutes, v => set({ timeoutMinutes: v }), { type: 'number' }),
          UI.field('Lockdown (minutes)', c.lockdownMinutes, v => set({ lockdownMinutes: v }), { type: 'number' }),
        ]),
      ],
      foot: [UI.saveBtn(() => {})],
    }));

    left.appendChild(UI.card({
      title: '♻️ Recovery (spec §6)',
      sub: 'Delete hue channel/role wapas banao',
      body: [
        UI.toggleRow('Restore deleted channels', 'Channel delete hote hi same naam/category/permission se wapas',
          c.restoreChannels, v => set({ restoreChannels: v })),
        UI.toggleRow('Restore deleted roles', 'Role delete hote hi naam/color/permission se wapas',
          c.restoreRoles, v => set({ restoreRoles: v })),
        UI.h('div', { class: 'hint', text: 'Members wapas role nahi milte — sirf role object restore hota hai.' }),
      ],
      foot: [UI.saveBtn(() => {})],
    }));

    const right = UI.h('div', { class: 'stack' });

    /* ---------------- Lockdown (spec §6) ---------------- */
    const lk = (DB.antinuke && DB.antinuke.lockdown) || { on: false };
    right.appendChild(UI.card({
      title: '🔒 Lockdown',
      sub: 'Emergency — sab text channels me @everyone ki writing band',
      body: [
        UI.h('div', { class: 'row', style: 'align-items:center;gap:10px' }, [
          UI.pill(lk.on ? 'LOCKDOWN ON' : 'OFF', lk.on ? 'err' : 'on'),
          UI.h('button', {
            class: 'btn ' + (lk.on ? 'btn--ok' : 'btn--danger'),
            onclick: async (e) => {
              const b = e.currentTarget, old = b.textContent;
              b.textContent = '…';
              try {
                const r = await API.setLockdown(!lk.on);
                UI.toast(r.result || 'done', 'ok');
                Router.render();
              } catch (err) {
                b.textContent = old;
                UI.toast(err.message || 'fail', 'err');
              }
            },
          }, lk.on ? '🔓 Unlock server' : '🔒 Lock server now'),
        ]),
        lk.on ? UI.alert('warn', 'Server <b>lockdown</b> me hai — ' + UI.esc(lk.reason || '') + '. Upar wale button se unlock karo.') : null,
      ].filter(Boolean),
    }));

    /* ---------------- Security Incidents (spec §8) ---------------- */
    const incidents = (DB.antinuke && DB.antinuke.incidents) || [];
    right.appendChild(UI.card({
      title: '\u{1F6A8} Security Incidents',
      sub: 'Anti-Nuke trips — asli data (Discord par bhi alert jata hai)',
      body: incidents.length
        ? UI.h('div', { class: 'stack-sm' }, incidents.slice(0, 12).map(incidentRow))
        : UI.h('div', {},
            UI.alert('info', 'Abhi tak koi incident nahi. Jab bhi koi threshold trip hoga, '
              + 'yahan executor, action, threshold aur time ke saath aayega.')),
    }));

    right.appendChild(UI.card({
      title: '\u{1F4D7} How it works',
      body: UI.h('div', { class: 'stack-sm' }, [
        step('1', 'Bot watches every channel, role, ban and webhook event in real time.'),
        step('2', 'It counts actions inside your chosen window (e.g. 3 deletes in 10s).'),
        step('3', 'If the limit is crossed, it instantly locks the channel and punishes the user.'),
        step('4', 'Everything is logged, and you get a DM if alerts are on.'),
        step('5', 'Sirf server owner hamesha safe hai — "Whitelist admins" ON karne par hi admin bhi chhode jayenge, warna admin ko bhi ban/kick lagegi.'),
      ]),
    }));

    if (!c.enabled) right.appendChild(UI.h('div', {}, UI.alert('err', 'Anti-Nuke is <b>OFF</b>. Your server is unprotected against raids.')));

    return UI.h('div', { class: 'split' }, [left, right]);

    /* ---------------- helpers (hoisted) ---------------- */
    function step(n, txt) {
      return UI.h('div', { class: 'row', style: 'align-items:flex-start;gap:11px' }, [
        UI.h('div', {
          style: {
            width: '20px', height: '20px', flex: '0 0 20px', borderRadius: '50%',
            background: 'rgba(124,92,255,.16)', color: 'var(--brand-400)',
            display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: '700',
          }, text: n,
        }),
        UI.h('div', { class: 'small muted', text: txt }),
      ]);
    }

    function labelFor(kind, id) {
      if (kind === 'role') return DB.roleName(id);
      if (kind === 'channel') return DB.chName(id);
      return String(id);
    }

    /** id chips + dropdown se add (spec §7: whitelist/protected users & roles) */
    function idChips(kind, values, onChange) {
      const box = UI.h('div', { class: 'chips' });
      const draw = () => {
        box.innerHTML = '';
        if (!values.length) box.appendChild(UI.h('span', { class: 'tiny dim', text: 'koi nahi — upar se chuno' }));
        values.slice().forEach(id => {
          box.appendChild(UI.h('button', {
            class: 'chip',
            title: 'hatao',
            onclick: () => {
              const i = values.indexOf(id);
              if (i >= 0) values.splice(i, 1);
              onChange(values);
              draw();
            },
          }, labelFor(kind, id) + ' ✕'));
        });
      };
      draw();

      const pool = kind === 'role' ? DB.roles
        : kind === 'channel' ? DB.channels
          : (DB.members || []);
      const opts = (pool || []).filter(x => !values.includes(String(x.id)));
      const placeholder = kind === 'role' ? 'Role chuno…'
        : kind === 'channel' ? 'Channel chuno…' : 'Member chuno…';
      const sel = UI.h('select', { class: 'select', style: 'max-width:220px' }, [
        UI.h('option', { value: '', text: placeholder }),
        ...opts.map(o => UI.h('option', { value: String(o.id), text: o.name })),
      ]);
      sel.addEventListener('change', () => {
        if (!sel.value) return;
        if (!values.includes(sel.value)) values.push(sel.value);
        onChange(values);
        draw();
        sel.selectedIndex = 0;
      });

      const raw = UI.h('input', {
        class: 'input', placeholder: 'Discord id paste + Enter', style: 'max-width:210px',
      });
      raw.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const v = raw.value.trim();
        if (!/^\d{5,25}$/.test(v)) return UI.toast('Sahi Discord id daalo', 'err');
        if (!values.includes(v)) values.push(v);
        raw.value = '';
        onChange(values);
        draw();
      });

      return UI.h('div', { class: 'field' }, [
        box,
        UI.h('div', { class: 'row gap-8 mt-8' }, [sel, raw]),
      ]);
    }

    function defaultRules(threshold, timeWindow, action) {
      return (DB.antinukeEvents || []).map((event, i) => ({
        id: 'r' + Date.now() + '_' + i,
        event,
        threshold: threshold || 1,
        timeWindow: timeWindow || '10s',
        action: action || 'Ban',
        enabled: true,
      }));
    }

    async function saveInstances(list) {
      try {
        await API.saveAntinukeInstances(list);
        UI.toast('Instances saved', 'ok');
        Router.render();
      } catch (e) {
        UI.toast(e.message || 'save fail', 'err');
      }
    }

    function incidentRow(x) {
      const when = String(x.t || '').replace('T', ' ').slice(0, 19);
      const act = String(x.action || '');
      const tone = /ban/i.test(act) ? 'err' : (/kick|timeout|lockdown/i.test(act) ? 'warn' : 'on');
      return UI.h('div', { class: 'setting', title: x.result || '' }, [
        UI.h('div', { class: 'setting__meta' }, [
          UI.h('div', { class: 'setting__label' }, [
            UI.h('b', { text: x.event }),
            UI.h('span', { class: 'tiny dim', text: '  ·  ' + (x.actor || '?') }),
          ]),
          UI.h('div', { class: 'setting__desc' },
            `${x.hits} actions / threshold ${x.threshold} in ${x.window}s  ·  ${x.instance || 'Default rules'}`),
          UI.h('div', { class: 'tiny muted', text: (x.result || '') + '  ·  ' + when }),
        ]),
        UI.h('div', { class: 'setting__control' }, UI.pill(act.toUpperCase(), tone)),
      ]);
    }

    function instanceCard(inst) {
      const rules = inst.rules || [];
      return UI.h('div', { class: 'card card--pad', style: 'border:1px solid var(--line)' }, [
        UI.h('div', { class: 'row', style: 'justify-content:space-between;align-items:center' }, [
          UI.h('div', { class: 'small bold', text: inst.name || 'Instance' }),
          UI.pill(inst.enabled ? 'ENABLED' : 'DISABLED', inst.enabled ? 'on' : 'err'),
        ]),
        UI.h('div', { class: 'stack-sm mt-8' },
          rules.slice(0, 5).map(r => UI.h('div', { class: 'tiny mono dim' }, [
            `${r.event}: ${r.threshold || r.limit} / ${r.timeWindow || r.window} → ${r.action}`,
          ]))),
        rules.length > 5
          ? UI.h('div', { class: 'tiny dim', text: `+ ${rules.length - 5} aur rules` })
          : null,
        !rules.length ? UI.h('div', { class: 'tiny dim', text: 'koi rule nahi' }) : null,
        UI.h('div', { class: 'row gap-8 mt-8' }, [
          UI.h('button', { class: 'btn btn--xs btn--soft', text: 'Edit', onclick: () => instanceModal(inst) }),
          UI.h('button', {
            class: 'btn btn--xs btn--soft', text: inst.enabled ? 'Disable' : 'Enable',
            onclick: () => { inst.enabled = !inst.enabled; saveInstances(instances); },
          }),
          UI.h('button', {
            class: 'btn btn--xs btn--danger', text: 'Delete',
            onclick: () => UI.confirmDialog(
              'Delete instance?',
              `"${inst.name}" delete kar dein? Ye protection band ho jayegi.`,
              () => saveInstances(instances.filter(x => x.id !== inst.id)),
              'Delete'),
          }),
        ]),
      ].filter(Boolean));
    }

    function instanceModal(inst) {
      const isNew = !inst;
      const cur = JSON.parse(JSON.stringify(inst || {
        id: 'nki' + Date.now(),
        name: 'Main Protection',
        enabled: true,
        guildId: String(DB.server.id || ''),
        logChannel: c.logChannel || 'c11',
        defaultAction: 'Ban',
        threshold: 1,
        timeWindow: '10s',
        whitelistUsers: [], whitelistRoles: [],
        protectedUsers: [], protectedRoles: [], protectedChannels: [],
        restoreChannels: false, restoreRoles: false,
        timeoutMinutes: Number(c.timeoutMinutes) || 15,
        rules: [],
      }));
      ['whitelistUsers', 'whitelistRoles', 'protectedUsers', 'protectedRoles', 'protectedChannels']
        .forEach(k => { if (!Array.isArray(cur[k])) cur[k] = []; });

      const body = [
        UI.field('Instance Name', cur.name, v => { cur.name = v; }, { max: 60, on: true, placeholder: 'Main Protection' }),
        UI.toggleRow('Enabled', 'Ye instance active protection karega', cur.enabled, v => { cur.enabled = v; }),
        UI.h('div', { class: 'field' }, [
          UI.h('label', { class: 'label', text: 'Protected Guild' }),
          UI.h('div', { class: 'input', style: 'opacity:.72;cursor:not-allowed' },
            (DB.server.name || '') + ' · ' + (DB.server.id || '')),
        ]),
        UI.h('div', { class: 'field' }, [
          UI.h('label', { class: 'label', text: 'Log Channel' }),
          UI.channelPicker(cur.logChannel, v => { cur.logChannel = v; }),
        ]),
        UI.h('div', { class: 'grid grid--2' }, [
          UI.selectField('Action', cur.defaultAction,
            (DB.antinukeActions || []).map(a => ({ value: a, label: a })),
            v => { cur.defaultAction = v; }),
          UI.selectField('Time Window', cur.timeWindow,
            ['5s', '10s', '15s', '30s', '60s'].map(s => ({ value: s, label: s })),
            v => { cur.timeWindow = v; }),
        ]),
        UI.field('Threshold', cur.threshold, v => { cur.threshold = parseInt(v, 10) || 1; },
          { type: 'number', on: true, hint: 'Itni actions ek window me hone par trip.' }),
        UI.h('hr'),
        UI.h('div', { class: 'label', text: 'Whitelisted Users' }),
        idChips('user', cur.whitelistUsers, v => { cur.whitelistUsers = v; }),
        UI.h('div', { class: 'label', text: 'Whitelisted Roles' }),
        idChips('role', cur.whitelistRoles, v => { cur.whitelistRoles = v; }),
        UI.h('div', { class: 'label', text: 'Protected Roles' }),
        idChips('role', cur.protectedRoles, v => { cur.protectedRoles = v; }),
        UI.h('div', { class: 'label', text: 'Protected Channels' }),
        idChips('channel', cur.protectedChannels, v => { cur.protectedChannels = v; }),
        UI.h('div', { class: 'hint', text: 'Whitelisted/protected par kabhi ban/kick/timeout nahi hoga.' }),
        UI.h('hr'),
        UI.h('div', { class: 'label', text: 'Rules' }),
        isNew
          ? UI.h('div', { class: 'hint', text: 'Naye instance me saare ' + (DB.antinukeEvents || []).length
              + ' events ke rules banenge — Threshold/Window/Action upar se.' })
          : rulesEditor(cur),
      ];

      UI.modal({
        title: isNew ? 'Create Anti-Nuke Instance' : 'Edit Anti-Nuke Instance',
        body: UI.h('div', { class: 'stack' }, body),
        actions: [
          UI.h('button', { class: 'btn btn--ghost', 'data-close': true, text: 'Cancel' }),
          UI.h('button', {
            class: 'btn btn--primary', text: isNew ? 'Create Instance' : 'Save Instance',
            onclick: () => {
              if (!String(cur.name || '').trim()) return UI.toast('Instance name chahiye', 'err');
              if (isNew) {
                cur.rules = defaultRules(cur.threshold, cur.timeWindow, cur.defaultAction);
                instances.push(cur);
              } else {
                const i = instances.findIndex(x => x.id === cur.id);
                if (i >= 0) instances[i] = cur; else instances.push(cur);
              }
              UI.$$('[data-close]').forEach(x => x.click());
              setTimeout(() => {
                const m = document.querySelector('#modalRoot');
                if (m) m.hidden = true;
                document.body.style.overflow = '';
              }, 0);
              saveInstances(instances);
            },
          }),
        ],
      });

      function rulesEditor(draft) {
        const box = UI.h('div', { class: 'stack-sm' });
        const draw = () => {
          box.innerHTML = '';
          draft.rules.forEach((r, idx) => {
            box.appendChild(UI.h('div', { class: 'row gap-8', style: 'align-items:center;flex-wrap:wrap' }, [
              UI.h('select', {
                class: 'select', style: 'flex:1 1 150px',
                onchange: (e) => { r.event = e.target.value; },
              }, [
                ...(DB.antinukeEvents || []).map(ev =>
                  UI.h('option', { value: ev, text: ev, selected: ev === r.event })),
                ...((DB.antinukeEvents || []).includes(r.event) ? []
                  : [UI.h('option', { value: r.event, text: r.event, selected: true })]),
              ]),
              UI.h('input', {
                class: 'input', type: 'number', min: 1, value: r.threshold, style: 'width:64px',
                oninput: (e) => { r.threshold = parseInt(e.target.value, 10) || 1; },
              }),
              UI.h('select', {
                class: 'select', style: 'width:78px',
                onchange: (e) => { r.timeWindow = e.target.value; },
              }, ['5s', '10s', '15s', '30s', '60s'].map(s =>
                UI.h('option', { value: s, text: s, selected: s === r.timeWindow }))),
              UI.h('select', {
                class: 'select', style: 'flex:0 1 150px',
                onchange: (e) => { r.action = e.target.value; },
              }, (DB.antinukeActions || []).map(a =>
                UI.h('option', { value: a, text: a, selected: a === r.action }))),
              UI.switchBox(r.enabled, v => { r.enabled = v; }),
              UI.h('button', {
                class: 'btn btn--xs btn--danger', text: '✕',
                onclick: () => { draft.rules.splice(idx, 1); draw(); },
              }),
            ]));
          });
          if (!draft.rules.length) {
            box.appendChild(UI.h('div', { class: 'hint', text: 'Koi rule nahi — instance kuch nahi karega.' }));
          }
        };
        draw();
        box.appendChild(UI.h('button', {
          class: 'btn btn--sm btn--soft mt-8',
          onclick: () => {
            draft.rules.push({
              id: 'r' + Date.now(), event: 'Channel Delete',
              threshold: 1, timeWindow: '10s', action: 'Ban', enabled: true,
            });
            draw();
          },
        }, '＋ Add rule'));
        return box;
      }
    }
  },
};

/* ============================================================
   AUTOMOD
   ============================================================ */
Pages.automod = {
  render: function () {
    const c = Store.merged('automod');
    const set = (patch) => Store.setCfg('automod', patch);

    const left = UI.h('div', { class: 'stack' });

    left.appendChild(UI.card({
      title: '\u{1F9F9} Auto Moderation',
      sub: 'Filter engine that cleans messages before anyone sees them',
      actions: [UI.moduleToggle('automod', () => Router.render())],
      body: [
        UI.toggleRow('Enable Automod', 'Runs the filters below on every message', c.enabled, v => { set({ enabled: v }); Router.render(); }),
        UI.h('hr'),
        UI.h('div', { class: 'grid grid--2' }, [
          UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Log Channel' }), UI.channelPicker(c.logChannel, v => set({ logChannel: v }))]),
          UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Punish Channel' }), UI.channelPicker(c.punishChannel, v => set({ punishChannel: v }))]),
          UI.selectField('Default Action', c.action, [
            { value: 'delete', label: 'Delete message' },
            { value: 'warn', label: 'Delete + warn' },
            { value: 'timeout', label: 'Delete + timeout 10m' },
            { value: 'kick', label: 'Delete + kick' },
            { value: 'ban', label: 'Delete + ban' },
          ], v => set({ action: v })),
        ]),
      ],
    }));

    /* filter list */
    const filterCards = c.filters.map(f =>
      UI.h('div', { class: 'setting', style: 'align-items:flex-start' }, [
        UI.h('div', { class: 'setting__meta' }, [
          UI.h('div', { class: 'setting__label', text: f.name }),
          UI.h('div', { class: 'setting__desc', text: 'Trigger: ' + f.trigger }),
          f.words ? UI.h('div', { class: 'tiny dim mt-4 mono truncate', text: f.words }) : null,
          UI.h('div', { class: 'row gap-6 mt-8' }, [
            UI.pill(f.action, 'info'),
            f.hits ? UI.pill(f.hits + ' hits', 'warn') : null,
          ]),
        ]),
        UI.h('div', { class: 'setting__control row gap-6' }, [
          UI.switchBox(f.on, v => { f.on = v; set({ filters: c.filters }); }),
          UI.h('button', {
            class: 'icon-btn icon-btn--sm', text: '✎', title: 'Edit',
            onclick: () => editFilter(f),
          }),
          UI.h('button', {
            class: 'icon-btn icon-btn--sm', text: '✕', title: 'Remove',
            onclick: () => {
              c.filters.splice(c.filters.indexOf(f), 1);
              set({ filters: c.filters });
              Router.render();
            },
          }),
        ]),
      ])
    );

    left.appendChild(UI.card({
      title: '\u{1F50D} Filter Rules',
      sub: c.filters.filter(f => f.on).length + ' of ' + c.filters.length + ' active',
      actions: [UI.h('button', { class: 'btn btn--sm btn--soft', onclick: () => editFilter(null) }, '＋ New filter')],
      body: filterCards,
    }));

    const right = UI.h('div', { class: 'stack' });

    right.appendChild(UI.card({
      title: '\u{1F4CA} Filter Activity',
      sub: 'Last 7 days',
      body: [
        UI.bars([
          { label: 'Discord invites', value: 128, tone: 'red' },
          { label: 'Caps spam', value: 63, tone: 'amber' },
          { label: 'Profanity', value: 41, tone: '' },
          { label: 'Mention mass', value: 17, tone: 'blue' },
          { label: 'External links', value: 9, tone: '' },
        ]),
        UI.h('div', { class: 'mt-16' }, UI.alert('ok', 'Automod removed <b>258 messages</b> this week and zero false positives reported.')),
      ],
    }));

    right.appendChild(UI.card({
      title: '\u{1F4CD} Per-Channel Overrides',
      sub: 'Some channels need different rules',
      body: UI.h('div', { class: 'stack-sm' }, DB.channels.slice(0, 6).map(c2 =>
        UI.h('div', { class: 'row justify-b' }, [
          UI.h('span', { class: 'small', text: '# ' + c2.name }),
          UI.pill(c2.id === 'c10' || c2.id === 'c11' ? 'Exempt' : 'Standard', c2.id === 'c10' || c2.id === 'c11' ? 'warn' : 'on'),
        ])
      )),
      foot: [UI.h('button', { class: 'btn btn--sm btn--ghost', onclick: () => UI.toast('Channel overrides editor', 'info') }, 'Manage overrides')],
    }));

    if (!c.enabled) right.appendChild(UI.h('div', {}, UI.alert('err', 'Automod is <b>OFF</b>. Filters are not being applied.')));

    return UI.h('div', { class: 'split' }, [left, right]);

    function editFilter(f) {
      const isNew = !f;
      const draft = f ? JSON.parse(JSON.stringify(f)) : {
        id: 'f' + Date.now(), name: '', trigger: 'Keyword list', words: '', action: 'Delete + Warn', on: true, hits: 0,
      };
      UI.modal({
        title: isNew ? 'New filter rule' : 'Edit filter rule',
        body: UI.h('div', { class: 'stack' }, [
          UI.field('Rule name', draft.name, v => draft.name = v, { placeholder: 'e.g. Discord Invites' }),
          UI.selectField('Trigger type', draft.trigger, [
            { value: 'Keyword list', label: 'Keyword list' },
            { value: 'Regex', label: 'Regular expression' },
            { value: 'discord.gg', label: 'Discord invite link' },
            { value: 'URL', label: 'Any URL' },
            { value: 'Mentions > 5', label: 'Too many mentions' },
            { value: 'Caps ratio', label: 'Caps lock ratio' },
            { value: 'Unicode abuse', label: 'Zalgo / spam characters' },
          ], v => draft.trigger = v),
          UI.field('Keywords', draft.words, v => draft.words = v, { textarea: true, rows: 3, placeholder: 'comma, separated, words' }),
          UI.selectField('Action on match', draft.action, [
            { value: 'Delete', label: 'Delete' },
            { value: 'Delete + Warn', label: 'Delete + Warn' },
            { value: 'Delete + Timeout 10m', label: 'Delete + Timeout 10m' },
            { value: 'Delete + Kick', label: 'Delete + Kick' },
            { value: 'Delete + Ban', label: 'Delete + Ban' },
          ], v => draft.action = v),
          UI.toggleRow('Enabled', 'Rule runs immediately', draft.on, v => draft.on = v),
        ]),
        actions: [
          UI.h('button', { class: 'btn btn--ghost', 'data-close': true, text: 'Cancel' }),
          UI.h('button', {
            class: 'btn btn--primary', text: isNew ? 'Create filter' : 'Save filter',
            onclick: () => {
              if (!draft.name.trim()) return UI.toast('Rule name is required', 'err');
              if (isNew) c.filters.push(draft); else Object.assign(f, draft);
              set({ filters: c.filters });
              UI.$$('[data-close]').forEach(x => x.click());
              setTimeout(() => { document.querySelector('#modalRoot').hidden = true; document.body.style.overflow = ''; }, 0);
              Router.render();
              UI.toast(isNew ? 'Filter created' : 'Filter updated', 'ok');
            },
          }),
        ],
      });
    }
  },
};

/* ============================================================
   SCAM PROTECTION
   ============================================================ */
Pages.scam = {
  render: function () {
    const c = Store.merged('scam');
    const set = (patch) => Store.setCfg('scam', patch);

    const left = UI.h('div', { class: 'stack' });

    left.appendChild(UI.card({
      title: '\u{1F6E8} Scam Protection',
      sub: 'Blocks phishing, fake giveaways and impersonation',
      actions: [UI.moduleToggle('scam', () => Router.render())],
      body: [
        UI.toggleRow('Enable Scam Protection', 'Scans every link and DM', c.enabled, v => { set({ enabled: v }); Router.render(); }),
        UI.h('hr'),
        [
          ['checkPhishing', 'Phishing links', 'Known credential-stealing pages'],
          ['checkFreeNitro', 'Fake Nitro / Steam', 'The classic "free nitro" scam'],
          ['checkImpersonation', 'Staff impersonation', 'Fake @admin accounts'],
          ['checkGiveawayFake', 'Fake giveaways', 'Impersonating our giveaways'],
          ['checkExternal', 'Unknown external links', 'Warn on any new domain'],
        ].map(([k, lbl, desc]) =>
          UI.toggleRow(lbl, desc, c[k], v => { set({ [k]: v }); Router.render(); })),
        UI.h('hr'),
        UI.selectField('Default Action', c.action, [
          { value: 'delete', label: 'Delete message' },
          { value: 'quarantine', label: 'Quarantine + alert staff' },
          { value: 'deleteBan', label: 'Delete + ban sender' },
        ], v => set({ action: v })),
        UI.h('div', { class: 'mt-16' }, [
          UI.toggleRow('Send alerts', 'Ping staff when a scam is caught', c.alerts, v => set({ alerts: v })),
        ]),
        UI.h('div', { class: 'field mt-16' }, [UI.h('label', { class: 'label', text: 'Log Channel' }), UI.channelPicker(c.logChannel, v => set({ logChannel: v }))]),
      ],
    }));

    const right = UI.h('div', { class: 'stack' });

    right.appendChild(UI.card({
      title: '\u{1F6A8} Detections',
      sub: 'All time',
      body: [
        UI.h('div', { class: 'grid grid--3' }, [
          UI.stat('Quarantined', c.quarantined, { tone: 'red' }),
          UI.stat('Links Blocked', c.blockedLinks, { tone: 'amber' }),
          UI.stat('Bans', 9, { tone: 'brand' }),
        ]),
      ],
    }));

    right.appendChild(UI.card({
      title: '\u{1F440} Recent Detections',
      body: UI.h('div', { class: 'stack-sm' }, [
        detect('steamcommunnity-gift.ru', '@FreeNitroBot#9931', 'Phishing', '12m ago', 'err'),
        detect('discord-nitro.gift', '@NitroGiver#1123', 'Fake Nitro', '1h ago', 'err'),
        detect('@VDEXCOP', '@VDEX.COP#0001', 'Impersonation', '3h ago', 'warn'),
        detect('apexcheats.gift', '@CoolGiveaway#4412', 'Fake Giveaway', 'yesterday', 'err'),
        detect('bit.ly/steamdream', 'Unknown', 'Suspicious link', '2d ago', 'warn'),
      ]),
    }));

    if (!c.enabled) right.appendChild(UI.h('div', {}, UI.alert('err', 'Scam Protection is <b>OFF</b>. Members may fall for phishing links.')));

    return UI.h('div', { class: 'split' }, [left, right]);

    function detect(url, user, kind, when, tone) {
      return UI.h('div', { class: 'setting' }, [
        UI.h('div', { class: 'setting__meta' }, [
          UI.h('div', { class: 'setting__label mono truncate', text: url }),
          UI.h('div', { class: 'setting__desc', text: user + ' · ' + when }),
        ]),
        UI.h('div', { class: 'setting__control' }, UI.pill(kind, tone)),
      ]);
    }
  },
};

/* ============================================================
   AUDIT LOGGING
   ============================================================ */
Pages.logging = {
  render: function () {
    const c = Store.merged('logging');
    const set = (patch) => Store.setCfg('logging', patch);
    let filter = 'all';

    const container = UI.h('div', { class: 'stack' });

    function draw() {
      container.innerHTML = '';
      let rows = DB.auditLog;
      if (filter === 'members') rows = rows.filter(r => ['join', 'ban', 'warn'].includes(r.type));
      if (filter === 'messages') rows = rows.filter(r => ['delete', 'warn'].includes(r.type));
      if (filter === 'roles') rows = rows.filter(r => r.type === 'role');
      if (filter === 'system') rows = rows.filter(r => r.type === 'system');

      container.appendChild(UI.card({
        title: '\u{1F4DC} Event History',
        sub: rows.length + ' events shown',
        actions: [
          UI.h('select', { class: 'select', style: 'width:150px', onchange: (e) => { filter = e.target.value; draw(); } }, [
            h_option('all', 'All events'), h_option('members', 'Members'), h_option('messages', 'Messages'),
            h_option('roles', 'Roles'), h_option('system', 'System'),
          ]),
          UI.h('button', { class: 'btn btn--sm btn--ghost', onclick: () => UI.toast('Exported ' + rows.length + ' rows to CSV', 'ok') }, '\u{1F4E1} Export'),
        ],
        body: UI.table([
          { label: 'Timestamp', render: a => UI.h('span', { class: 'small dim mono nowrap', text: a.t }) },
          { label: 'Event', render: a => UI.pill(a.event, tone(a.type)) },
          { label: 'Actor', render: a => UI.h('div', { class: 'row' }, [UI.avatar(a.who, '#7c5cff', 'sm'), UI.h('span', { class: 'small', text: a.who })]) },
          { label: 'Details', render: a => UI.h('span', { class: 'small muted', text: a.detail }) },
        ], rows),
      }));
    }

    const left = UI.h('div', { class: 'stack' }, [
      UI.card({
        title: '\u{1F4C4} Audit Logging',
        sub: 'Every action in the server, recorded',
        actions: [UI.moduleToggle('logging', () => Router.render())],
        body: [
          UI.toggleRow('Enable logging', 'Records all selected events', c.enabled, v => { set({ enabled: v }); Router.render(); }),
          UI.h('hr'),
          UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Log Channel' }), UI.channelPicker(c.logChannel, v => set({ logChannel: v }))]),
          UI.h('div', { class: 'mt-16' }, [
            UI.toggleRow('Ignore bots', 'Skip messages from other bots', c.ignoreBots, v => set({ ignoreBots: v })),
          ]),
        ],
      }),
      UI.card({
        title: '\u{1F4E6} Tracked Events',
        sub: c.events.filter(e => e.on).length + ' of ' + c.events.length + ' active',
        body: c.events.map(e =>
          UI.h('div', { class: 'setting' }, [
            UI.h('div', { class: 'setting__meta' }, [
              UI.h('div', { class: 'setting__label', text: e.name }),
              UI.h('div', { class: 'setting__desc', text: e.sub }),
            ]),
            UI.h('div', { class: 'setting__control' }, UI.switchBox(e.on, v => { e.on = v; set({ events: c.events }); })),
          ])
        ),
      }),
      UI.card({
        title: '\u{1F6E5} Ignored Channels',
        sub: 'Not logged (quiet channels)',
        body: [
          UI.h('div', { class: 'chips' }, (c.ignoreChannels || []).map(id =>
            UI.h('span', { class: 'chip' }, [
              '# ' + DB.chName(id),
              UI.h('span', {
                class: 'chip__x', text: '✕',
                onclick: () => {
                  c.ignoreChannels.splice(c.ignoreChannels.indexOf(id), 1);
                  set({ ignoreChannels: c.ignoreChannels });
                  Router.render();
                },
              }),
            ])
          )),
          UI.h('select', {
            class: 'select mt-12',
            onchange: (e) => {
              if (e.target.value) {
                c.ignoreChannels.push(e.target.value);
                set({ ignoreChannels: c.ignoreChannels });
                e.target.value = '';
                Router.render();
              }
            },
          }, [h_option('', '＋ Ignore a channel…')].concat(
            DB.channels.map(ch => h_option(ch.id, '# ' + ch.name))
          )),
        ],
      }),
    ]);

    draw();

    return UI.h('div', { class: 'split' }, [left, container]);

    function h_option(v, l) { return UI.h('option', { value: v, text: l }); }
    function tone(t) {
      return { ban: 'err', warn: 'warn', delete: 'warn', role: 'info', system: 'brand', join: 'on', boost: 'pink', channel: 'info' }[t] || null;
    }
  },
};
