/* ============================================================
   VDEX COP — pages/utility.js
   Invites · Tracking · Member Backup · Booster Perks
   ============================================================ */

/* ============================================================
   INVITES
   ============================================================ */
Pages.invites = {
  render: function () {
    const c = Store.merged('invites');
    const set = (patch) => { Store.setCfg('invites', patch); Router.render(); };

    const left = UI.h('div', { class: 'stack' });

    left.appendChild(UI.card({
      title: '\u{1F517} Invite Tracking',
      sub: 'See which invites actually bring members',
      actions: [UI.moduleToggle('invites', () => Router.render())],
      body: [
        UI.toggleRow('Enable invite tracking', 'Log who joined through which invite', c.enabled, v => { set({ enabled: v }); }),
        UI.h('div', { class: 'mt-16' }, [
          UI.toggleRow('Track sources', 'Record where each invite was shared', c.trackSources, v => set({ trackSources: v })),
          UI.toggleRow('Flag fake accounts', 'Warn on raid-style join patterns', c.flagFake, v => set({ flagFake: v })),
        ]),
        UI.h('div', { class: 'grid grid--2 mt-16' }, [
          UI.field('Minimum account age (days)', c.minAgeDays, v => set({ minAgeDays: v }), { type: 'number', hint: 'Younger = suspicious' }),
          UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Log Channel' }), UI.channelPicker(c.logChannel, v => set({ logChannel: v }))]),
        ]),
      ],
      foot: [UI.saveBtn(() => {})],
    }));

    left.appendChild(UI.card({
      title: '\u{1F4CB} Server Invites',
      sub: c.invites.length + ' total',
      actions: [UI.h('button', { class: 'btn btn--sm btn--soft', onclick: () => UI.toast('Invite creation panel', 'info') }, '＋ Create invite')],
      body: UI.table([
        { label: 'Code', render: i => UI.h('span', { class: 'mono small bold', text: 'discord.gg/' + i.code }) },
        { label: 'Uses', render: i => UI.h('span', { class: 'small', text: i.uses.toLocaleString() }) },
        { label: 'Members', render: i => UI.h('span', { class: 'small text-green', text: '+' + i.members }) },
        { label: 'Conversion', render: i => UI.h('span', { class: 'small dim', text: Math.round(i.members / i.uses * 100) + '%' }) },
        { label: 'Source', render: i => UI.h('span', { class: 'small dim', text: i.source }) },
        { label: 'Status', render: i => UI.pill(i.active ? 'Active' : 'Expired', i.active ? 'on' : null) },
        {
          label: '', render: (i) => UI.h('div', { class: 'table__actions' }, [
            UI.h('button', { class: 'btn btn--xs btn--ghost', text: 'Copy', onclick: () => UI.copy('https://discord.gg/' + i.code, 'Invite copied') }),
            UI.h('button', {
              class: 'btn btn--xs btn--danger', text: '✕',
              onclick: () => UI.confirmDialog('Delete invite?', 'discord.gg/' + i.code + ' stops working.', () => {
                c.invites.splice(c.invites.indexOf(i), 1); set({ invites: c.invites }); Router.render();
              }),
            }),
          ]),
        },
      ], c.invites),
    }));

    const right = UI.h('div', { class: 'stack' });

    right.appendChild(UI.card({
      title: '\u{1F6A8} Suspicious Joins',
      sub: c.suspicious.length + ' flagged',
      body: UI.h('div', { class: 'stack-sm' }, c.suspicious.map(s =>
        UI.h('div', { class: 'setting' }, [
          UI.h('div', { class: 'setting__meta' }, [
            UI.h('div', { class: 'setting__label', text: s.tag }),
            UI.h('div', { class: 'setting__desc', text: s.joins + ' joins · account age ' + s.age + ' · ' + s.reason }),
          ]),
          UI.h('div', { class: 'setting__control' }, UI.pill(s.action, 'err')),
        ])
      )),
    }));

    right.appendChild(UI.card({
      title: '\u{1F4CA} Invite Performance',
      body: UI.bars(c.invites.map(i => ({ label: i.code, value: i.members, tone: i.active ? 'green' : '' })), { suffix: ' members' }),
    }));

    return UI.h('div', { class: 'split' }, [left, right]);
  },
};

/* ============================================================
   TRACKING
   ============================================================ */
Pages.tracking = {
  render: function () {
    const c = Store.merged('tracking');
    const set = (patch) => { Store.setCfg('tracking', patch); };

    const left = UI.h('div', { class: 'stack' });

    left.appendChild(UI.card({
      title: '\u{1F4CD} Member Tracking',
      sub: 'Growth, activity and retention',
      actions: [UI.moduleToggle('tracking', () => Router.render())],
      body: [
        UI.toggleRow('Enable tracking', 'Collect analytics about your community', c.enabled, v => { set({ enabled: v }); Router.render(); }),
        UI.h('hr'),
        UI.selectField('Reporting Period', c.period, [
          { value: '7d', label: 'Last 7 days' },
          { value: '30d', label: 'Last 30 days' },
          { value: '90d', label: 'Last 90 days' },
          { value: '1y', label: 'Last year' },
        ], v => set({ period: v })),
      ],
    }));

    left.appendChild(UI.card({
      title: '\u{1F4C8} Daily Joins',
      sub: 'Last 30 days',
      actions: [UI.pill('+' + c.netGrowth + ' net', 'on')],
      body: [
        UI.sparkline(c.daily, { h: 150, labels: ['30 days ago', 'Today'] }),
        UI.h('div', { class: 'grid grid--4 mt-16', style: 'grid-template-columns:repeat(auto-fit,minmax(120px,1fr))' }, [
          UI.stat('Joins', c.totalJoins, { tone: 'green' }),
          UI.stat('Leaves', c.totalLeaves, { tone: 'red' }),
          UI.stat('Online', c.activeNow, { tone: 'brand' }),
          UI.stat('Peak', c.peakToday, { tone: 'blue' }),
        ]),
      ],
    }));

    const right = UI.h('div', { class: 'stack' });

    right.appendChild(UI.card({
      title: '\u{1F550} Active Hours',
      sub: 'When your members are online',
      body: UI.bars([
        { label: '00–06', value: 18, tone: '' },
        { label: '06–12', value: 96, tone: 'blue' },
        { label: '12–18', value: 148, tone: 'green' },
        { label: '18–24', value: 124, tone: 'amber' },
      ], { suffix: ' avg online' }),
    }));

    right.appendChild(UI.card({
      title: '\u{1F4C9} Join Sources',
      body: [
        UI.h('div', { class: 'flex items-c gap-16 wrap mb-16' }, [
          UI.donut(c.sources.map((s, i) => ({
            value: s.count, color: ['#7c5cff', '#2ecc71', '#2e9bff', '#ffa502'][i],
          })), { center: String(c.totalJoins), centerSub: 'joins' }),
          UI.h('div', { class: 'stack-sm grow' }, c.sources.map((s, i) =>
            UI.h('div', { class: 'row gap-8' }, [
              UI.h('div', { style: { width: '10px', height: '10px', borderRadius: '3px', background: ['#7c5cff', '#2ecc71', '#2e9bff', '#ffa502'][i] } }),
              UI.h('span', { class: 'small grow', text: s.name }),
              UI.h('span', { class: 'small dim', text: s.pct + '%' }),
            ])
          )),
        ]),
      ],
    }));

    right.appendChild(UI.card({
      title: '\u{1F3AF} Retention',
      body: [
        UI.h('div', { class: 'row justify-b mb-8' }, [
          UI.h('span', { class: 'small muted', text: '30-day retention' }),
          UI.h('span', { class: 'bold text-green', text: c.retention30 + '%' }),
        ]),
        UI.h('div', { class: 'meter meter--green' }, UI.h('div', { class: 'meter__fill', style: { width: c.retention30 + '%' } })),
        UI.h('div', { class: 'hint mt-8', text: 'Retention above 85% is considered healthy for a gaming community.' }),
      ],
    }));

    return UI.h('div', { class: 'split' }, [left, right]);
  },
};

/* ============================================================
   MEMBER BACKUP
   ============================================================ */
Pages.memberbackup = {
  render: function () {
    const c = Store.merged('memberbackup');
    const set = (patch) => { Store.setCfg('memberbackup', patch); Router.render(); };

    const left = UI.h('div', { class: 'stack' });

    left.appendChild(UI.card({
      title: '\u{1F4E6} Member Backup System',
      sub: 'Automatic backups of your entire server',
      actions: [UI.moduleToggle('memberbackup', () => Router.render())],
      body: [
        UI.toggleRow('Enable auto backup', 'Back up members, roles and channels', c.enabled, v => { set({ enabled: v }); }),
        UI.h('hr'),
        UI.h('div', { class: 'grid grid--2' }, [
          UI.selectField('Backup interval', c.interval, [
            { value: 1, label: 'Every 1 hour' },
            { value: 6, label: 'Every 6 hours' },
            { value: 12, label: 'Every 12 hours' },
            { value: 24, label: 'Every 24 hours' },
          ], v => set({ interval: v })),
          UI.field('Keep last N backups', c.keepBackups, v => set({ keepBackups: v }), { type: 'number' }),
        ]),
        UI.h('div', { class: 'mt-16' }, [
          UI.toggleRow('Members', 'All member accounts', c.includes.members, v => { c.includes.members = v; set({ includes: c.includes }); }),
          UI.toggleRow('Roles', 'Role names, colours and hierarchy', c.includes.roles, v => { c.includes.roles = v; set({ includes: c.includes }); }),
          UI.toggleRow('Channels', 'Channel structure and settings', c.includes.channels, v => { c.includes.channels = v; set({ includes: c.includes }); }),
          UI.toggleRow('Server settings', 'Verification level, boosts, etc.', c.includes.settings, v => { c.includes.settings = v; set({ includes: c.includes }); }),
          UI.toggleRow('Ban list', 'Current bans', c.includes.bans, v => { c.includes.bans = v; set({ includes: c.includes }); }),
        ]),
      ],
      foot: [UI.saveBtn(() => {})],
    }));

    const right = UI.h('div', { class: 'stack' });

    right.appendChild(UI.card({
      title: '\u{1F4CA} Backup Status',
      body: [
        UI.h('div', { class: 'grid grid--3' }, [
          UI.stat('Backed Up', c.totalBackedUp.toLocaleString(), { tone: 'brand' }),
          UI.stat('Valid Tokens', c.validTokens.toLocaleString(), { tone: 'green' }),
          UI.stat('Expired', c.expired, { tone: 'red' }),
        ]),
        UI.h('div', { class: 'mt-16' }, [
          UI.h('div', { class: 'row justify-b mb-8' }, [
            UI.h('span', { class: 'small muted', text: 'Token validity' }),
            UI.h('span', { class: 'small bold text-green', text: Math.round(c.validTokens / c.totalBackedUp * 100) + '%' }),
          ]),
          UI.h('div', { class: 'meter meter--green' },
            UI.h('div', { class: 'meter__fill', style: { width: (c.validTokens / c.totalBackedUp * 100) + '%' } })),
        ]),
        UI.h('div', { class: 'row justify-b mt-16' }, [
          UI.h('span', { class: 'small muted', text: 'Last backup' }),
          UI.h('span', { class: 'small bold', text: c.lastBackup }),
        ]),
      ],
    }));

    right.appendChild(UI.card({
      title: '\u{1F5DD} Backup History',
      sub: 'Last ' + c.backups.length + ' backups',
      body: UI.table([
        { label: 'When', render: b => UI.h('span', { class: 'small mono dim nowrap', text: b.at }) },
        { label: 'Members', render: b => UI.h('span', { class: 'small', text: b.members.toLocaleString() }) },
        { label: 'Roles', render: b => UI.h('span', { class: 'small', text: b.roles }) },
        { label: 'Channels', render: b => UI.h('span', { class: 'small', text: b.channels }) },
        { label: 'Size', render: b => UI.h('span', { class: 'small dim', text: b.size }) },
        { label: 'Status', render: b => UI.pill(b.ok ? 'OK' : 'Failed', b.ok ? 'on' : 'err') },
        {
          label: '', render: (b) => UI.h('div', { class: 'table__actions' }, [
            UI.h('button', { class: 'btn btn--xs btn--ghost', text: 'Restore', onclick: () => UI.confirmDialog('Restore backup?', 'Server structure will be reverted to ' + b.at + '.', () => UI.toast('Restore started', 'ok')) }),
            UI.h('button', { class: 'btn btn--xs btn--ghost', text: '⬇', onclick: () => UI.toast('Downloading ' + b.at + '.json', 'ok') }),
          ]),
        },
      ], c.backups),
      foot: [
        UI.h('button', {
          class: 'btn btn--soft',
          onclick: () => {
            const now = new Date();
            c.backups.unshift({
              id: 'b' + Date.now(),
              at: now.toISOString().slice(0, 16).replace('T', ' '),
              members: c.totalBackedUp, roles: 61, channels: 38, size: c.size, ok: true,
            });
            c.lastBackup = now.toISOString().slice(0, 16).replace('T', ' ');
            set({ backups: c.backups, lastBackup: c.lastBackup });
            UI.toast('Backup created', 'ok');
            Router.render();
          },
        }, '\u{1F504} Backup now'),
        UI.h('span', { class: 'tiny dim', text: 'Every ' + c.interval + ' hours' }),
      ],
    }));

    return UI.h('div', { class: 'split' }, [left, right]);
  },
};

/* ============================================================
   BOOSTER PERKS
   ============================================================ */
Pages.boosterperks = {
  render: function () {
    const c = Store.merged('boosterperks');
    const set = (patch) => { Store.setCfg('boosterperks', patch); Router.render(); };

    const left = UI.h('div', { class: 'stack' }, [
      UI.card({
        title: '\u{2B50} Booster Perks',
        sub: 'Give your boosters something special',
        actions: [UI.moduleToggle('boosterperks', () => Router.render())],
        body: [
          UI.toggleRow('Enable booster perks', 'Apply the perks below', c.enabled, v => { set({ enabled: v }); }),
          UI.h('hr'),
          UI.h('div', { class: 'grid grid--2' }, [
            UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Booster Role' }), UI.rolePicker(c.role, v => set({ role: v }))]),
            UI.h('div', {}, [UI.toggleRow('Welcome DM', 'Thank boosters when they boost', c.welcomeDM, v => set({ welcomeDM: v }))]),
          ]),
        ],
      }),
      UI.card({
        title: '\u{1F381} Active Perks',
        sub: c.perks.filter(p => p.enabled).length + ' of ' + c.perks.length + ' enabled',
        body: c.perks.map(p =>
          UI.toggleRow(p.name, p.desc, p.enabled, v => { p.enabled = v; set({ perks: c.perks }); })
        ),
      }),
      UI.card({
        title: '\u{1F465} Current Boosters',
        sub: DB.server.boostCount + ' boosts · Tier ' + DB.server.boostTier,
        body: UI.h('div', { class: 'stack-sm' }, DB.members.filter(m => m.boosting).map(m =>
          UI.h('div', { class: 'row' }, [
            UI.avatar(m.name, '#c0392b', 'sm'),
            UI.h('div', { class: 'grow' }, [
              UI.h('div', { class: 'small bold', text: m.display }),
              UI.h('div', { class: 'tiny dim', text: 'Boosting since ' + UI.relDate(m.joined) }),
            ]),
            UI.pill('Booster', 'pink'),
          ])
        )),
      }),
    ]);

    const right = UI.h('div', { class: 'stack' }, [
      UI.card({
        title: '\u{1F4C8} Boost Stats',
        body: [
          UI.h('div', { class: 'grid grid--3' }, [
            UI.stat('Boosts', DB.server.boostCount, { tone: 'pink' }),
            UI.stat('Tier', DB.server.boostTier, { tone: 'brand' }),
            UI.stat('Perks', c.perks.filter(p => p.enabled).length, { tone: 'green' }),
          ]),
          UI.h('div', { class: 'mt-16' }, UI.alert('info', 'Tier 3 gives <b>2 server boosts</b> and a <b>+70% member limit</b>.')),
        ],
      }),
      UI.card({
        title: '\u{1F5A5} Booster Welcome DM',
        body: UI.messageBox(UI.botName(), 'Just now', '',
          UI.embedPreview({
            color: '#c0392b', title: '\u{1F389} Thanks for boosting!',
            desc: 'Thank you for boosting **' + DB.server.name + '**!\n\nYou get:\n' +
              c.perks.filter(p => p.enabled).map(p => '\u2705 ' + p.name).join('\n') +
              '\n\nKeep boosting to stay in the list!',
          })),
      }),
    ]);

    if (!c.enabled) right.appendChild(UI.h('div', {}, UI.alert('warn', 'Booster perks are <b>disabled</b>. Boosters get nothing extra.')));

    return UI.h('div', { class: 'split' }, [left, right]);
  },
};
