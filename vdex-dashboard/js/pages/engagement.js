/* ============================================================
   VDEX COP — pages/engagement.js
   Leveling · Counting · Reaction Roles · Custom Roles · Giveaways
   ============================================================ */

/* ============================================================
   LEVELING
   ============================================================ */
Pages.leveling = {
  render: function () {
    const c = Store.merged('leveling');
    const set = (patch) => { Store.setCfg('leveling', patch); };

    const left = UI.h('div', { class: 'stack' });

    left.appendChild(UI.card({
      title: '\u{2B50} Leveling System',
      sub: 'Reward active members with XP and roles',
      actions: [UI.moduleToggle('leveling', () => Router.render())],
      body: [
        UI.toggleRow('Enable leveling', 'Members earn XP for activity', c.enabled, v => { set({ enabled: v }); Router.render(); }),
        UI.h('hr'),
        UI.h('div', { class: 'grid grid--2' }, [
          UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Announcement Channel' }), UI.channelPicker(c.channel, v => set({ channel: v }))]),
          UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Leaderboard Channel' }), UI.channelPicker(c.leaderboardChannel, v => set({ leaderboardChannel: v }))]),
          UI.field('XP per message', c.xpPerMessage, v => set({ xpPerMessage: v }), { hint: 'Random range, e.g. 1-6' }),
          UI.field('XP per active minute', c.xpPerMinute, v => set({ xpPerMinute: v }), { type: 'number' }),
          UI.field('Minimum message length', c.minMessageLength, v => set({ minMessageLength: v }), { type: 'number', hint: 'Shorter messages give no XP — stops +1 farming' }),
          UI.field('Cooldown between XP (seconds)', c.cooldown, v => set({ cooldown: v }), { type: 'number' }),
        ]),
        UI.h('div', { class: 'mt-16' }, [
          UI.toggleRow('Announce level-ups', 'Post a message when someone levels up', c.announceLevelUps, v => set({ announceLevelUps: v })),
        ]),
      ],
      foot: [UI.saveBtn(() => {})],
    }));

    /* level rewards */
    left.appendChild(UI.card({
      title: '\u{1F451} Level Rewards',
      sub: 'Automatic role assignment at set levels',
      body: c.roleRewards.map((r, i) =>
        UI.h('div', { class: 'setting' }, [
          UI.h('div', { class: 'setting__meta' }, [
            UI.h('div', { class: 'setting__label' }, [
              UI.h('span', { class: 'pill pill--brand', text: 'Level ' + r.level }),
            ]),
          ]),
          UI.h('div', { class: 'setting__control row gap-8' }, [
            UI.h('div', { style: 'width:190px' }, UI.rolePicker(r.role, v => { r.role = v; set({ roleRewards: c.roleRewards }); })),
            UI.switchBox(r.on, v => { r.on = v; set({ roleRewards: c.roleRewards }); }),
            UI.h('button', {
              class: 'icon-btn icon-btn--sm', text: '✕',
              onclick: () => { c.roleRewards.splice(i, 1); set({ roleRewards: c.roleRewards }); Router.render(); },
            }),
          ]),
        ])
      ),
      actions: [UI.h('button', {
        class: 'btn btn--sm btn--soft',
        onclick: () => {
          c.roleRewards.push({ level: 50, role: 'r7', on: true });
          set({ roleRewards: c.roleRewards }); Router.render();
        },
      }, '＋ Add reward')],
    }));

    /* no-xp channels */
    left.appendChild(UI.card({
      title: '\u{1F6E5} No-XP Channels',
      sub: 'XP is not earned here',
      body: [
        UI.h('div', { class: 'chips' }, (c.noXpChannels || []).map(id =>
          UI.h('span', { class: 'chip' }, [
            '# ' + DB.chName(id),
            UI.h('span', {
              class: 'chip__x', text: '✕',
              onclick: () => { c.noXpChannels.splice(c.noXpChannels.indexOf(id), 1); set({ noXpChannels: c.noXpChannels }); Router.render(); },
            }),
          ])
        )),
        UI.h('select', {
          class: 'select mt-12',
          onchange: (e) => {
            if (e.target.value) { c.noXpChannels.push(e.target.value); set({ noXpChannels: c.noXpChannels }); e.target.value = ''; Router.render(); }
          },
        }, [UI.h('option', { value: '', text: '＋ Exclude a channel…' })].concat(
          DB.channels.map(ch => UI.h('option', { value: ch.id, text: '# ' + ch.name })))),
      ],
    }));

    const right = UI.h('div', { class: 'stack' });

    right.appendChild(UI.card({
      title: '\u{1F3C6} Leaderboard',
      sub: 'Top members this season',
      body: UI.h('div', { class: 'stack-sm' }, DB.members.slice(0, 8).map((m, i) =>
        UI.h('div', { class: 'row' }, [
          UI.h('div', {
            class: 'mono small bold',
            style: { width: '22px', textAlign: 'center', color: i < 3 ? 'var(--amber)' : 'var(--text-3)' },
            text: '#' + (i + 1),
          }),
          UI.avatar(m.name, m.color, 'sm'),
          UI.h('div', { class: 'grow' }, [
            UI.h('div', { class: 'small bold', text: m.display }),
            UI.h('div', { class: 'tiny dim', text: m.messages + ' messages · ' + m.xp.toLocaleString() + ' XP' }),
          ]),
          UI.pill('Lv ' + m.level, 'brand'),
        ])
      )),
    }));

    right.appendChild(UI.card({
      title: '\u{1F4CA} XP Curve',
      sub: 'XP required per level',
      body: UI.h('div', { class: 'stack-sm' }, c.levels.map(l =>
        UI.h('div', { class: 'row justify-b' }, [
          UI.h('span', { class: 'small bold', text: 'Level ' + l.lvl }),
          UI.h('span', { class: 'small dim mono', text: l.xp.toLocaleString() + ' XP' }),
        ])
      )),
    }));

    return UI.h('div', { class: 'split' }, [left, right]);
  },
};

/* ============================================================
   COUNTING
   ============================================================ */
Pages.counting = {
  render: function () {
    const c = Store.merged('counting');
    const set = (patch) => { Store.setCfg('counting', patch); Router.render(); };
    let count = c.current;

    const counterBox = UI.h('div', { class: 'center', style: 'padding:20px 0' });
    const logBox = UI.h('div', { class: 'stack-sm', style: 'max-height:280px;overflow-y:auto' });
    const log = [];

    function drawCounter() {
      counterBox.innerHTML = '';
      counterBox.appendChild(UI.h('div', { class: 'mono', style: { fontSize: '46px', fontWeight: '800', color: 'var(--brand-400)', lineHeight: '1.1' }, text: String(count) }));
      counterBox.appendChild(UI.h('div', { class: 'tiny dim', text: 'current count' }));
    }

    function pushLog(name, ok) {
      log.unshift({ name, ok, n: count });
      if (log.length > 12) log.pop();
      logBox.innerHTML = '';
      log.forEach(l => {
        logBox.appendChild(UI.h('div', { class: 'row' }, [
          UI.h('span', { class: 'mono small bold', style: { width: '58px', color: l.ok ? 'var(--green)' : 'var(--red)' }, text: l.ok ? '✓ ' + l.n : '✕' }),
          UI.h('span', { class: 'small muted', text: l.name }),
          UI.h('span', { class: 'tiny dim', style: 'margin-left:auto', text: l.ok ? 'counted' : 'wrong number' }),
        ]));
      });
    }

    drawCounter();
    pushLog('Gerton', true);
    pushLog('Reece', true);
    pushLog('Sneha', false);

    const left = UI.h('div', { class: 'stack' });

    left.appendChild(UI.card({
      title: '\u{1F522} Counting Channel',
      sub: 'Members count 1, 2, 3… with no mistakes',
      actions: [UI.moduleToggle('counting', () => Router.render())],
      body: [
        UI.toggleRow('Enable counting', 'Runs the number game', c.enabled, v => { set({ enabled: v }); }),
        UI.h('hr'),
        UI.h('div', { class: 'grid grid--2' }, [
          UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Counting Channel' }), UI.channelPicker(c.channel, v => set({ channel: v }))]),
          UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Leaderboard Channel' }), UI.channelPicker(c.leaderboardChannel, v => set({ leaderboardChannel: v }))]),
          UI.field('Starting Number', c.startAt, v => set({ startAt: v }), { type: 'number' }),
          UI.field('Leaderboard Size', c.topLimit, v => set({ topLimit: v }), { type: 'number' }),
        ]),
        UI.h('div', { class: 'mt-16' }, [
          UI.toggleRow('Reset on mistake', 'A wrong number restarts the count', c.resetOnError, v => set({ resetOnError: v })),
          UI.toggleRow('Delete wrong message', 'Auto-delete incorrect numbers', c.deleteWrong, v => set({ deleteWrong: v })),
          UI.toggleRow('No double counting', 'Same person cannot count twice in a row', c.noDoubleCount, v => set({ noDoubleCount: v })),
          UI.toggleRow('Leaderboard', 'Post the top counters', c.leaderboardEnabled, v => set({ leaderboardEnabled: v })),
        ]),
      ],
      foot: [UI.saveBtn(() => {})],
    }));

    const right = UI.h('div', { class: 'stack' });

    right.appendChild(UI.card({
      title: '\u{1F3AF} Live Count',
      sub: 'Simulate a member counting',
      body: [
        counterBox,
        UI.h('div', { class: 'row gap-8', style: 'justify-content:center;margin-top:14px' }, [
          UI.h('button', { class: 'btn btn--ok', onclick: () => { count++; drawCounter(); pushLog('You', true); } }, '\u2713 Correct (+1)'),
          UI.h('button', { class: 'btn btn--ghost', onclick: () => { count += 3; drawCounter(); pushLog('You', true); } }, '+3 jump'),
          UI.h('button', { class: 'btn btn--danger', onclick: () => { pushLog('You', false); if (c.resetOnError) { count = c.startAt; drawCounter(); } } }, '\u274C Mistake'),
          UI.h('button', { class: 'btn btn--ghost', onclick: () => { count = c.startAt; drawCounter(); UI.toast('Counter reset', 'ok'); } }, '\u{1F504} Reset'),
        ]),
        UI.h('hr'),
        UI.h('div', { class: 'label mb-8', text: 'Recent attempts' }),
        logBox,
      ],
    }));

    right.appendChild(UI.card({
      title: '\u{1F3C6} Top Counters',
      body: UI.h('div', { class: 'stack-sm' }, DB.members.slice(0, 6).map((m, i) =>
        UI.h('div', { class: 'row' }, [
          UI.h('span', { class: 'mono small bold dim', style: 'width:22px;text-align:center', text: '#' + (i + 1) }),
          UI.avatar(m.name, m.color, 'sm'),
          UI.h('span', { class: 'small grow', text: m.display }),
          UI.h('span', { class: 'mono small text-brand', text: (1042 + (m.messages * 3)).toLocaleString() }),
        ])
      )),
    }));

    return UI.h('div', { class: 'split' }, [left, right]);
  },
};

/* ============================================================
   REACTION ROLES
   ============================================================ */
Pages.reactionroles = {
  render: function () {
    const c = Store.merged('reactionroles');
    const set = (patch) => { Store.setCfg('reactionroles', patch); Router.render(); };

    const left = UI.h('div', { class: 'stack' });

    left.appendChild(UI.card({
      title: '\u{1F3FB} Reaction Roles',
      sub: 'Members pick their roles by clicking emoji',
      actions: [UI.moduleToggle('reactionroles', () => Router.render())],
      body: [
        UI.toggleRow('Enable reaction roles', 'Show the reaction menu', c.enabled, v => { set({ enabled: v }); }),
        UI.h('hr'),
        UI.h('div', { class: 'grid grid--2' }, [
          UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Menu Channel' }), UI.channelPicker(c.channel, v => set({ channel: v }))]),
          UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Verify Role' }), UI.rolePicker(c.verifyRole, v => set({ verifyRole: v })), ]),
        ]),
        UI.h('div', { class: 'mt-16' }, [
          UI.toggleRow('Max roles per member', 'Limit how many they can pick', c.maxRoles > 1, v => set({ maxRoles: v ? 3 : 0 })),
          UI.toggleRow('Exclusive groups', 'Only one role per group allowed', c.exclusiveGroups, v => set({ exclusiveGroups: v })),
        ]),
      ],
    }));

    /* groups */
    c.groups.forEach((g, gi) => {
      left.appendChild(UI.card({
        title: g.name,
        sub: g.desc,
        actions: [
          UI.switchBox(g.on, v => { g.on = v; set({ groups: c.groups }); }),
          UI.h('button', {
            class: 'icon-btn icon-btn--sm', text: '✕',
            onclick: () => { c.groups.splice(gi, 1); set({ groups: c.groups }); Router.render(); },
          }),
        ],
        body: UI.h('div', { class: 'stack-sm' }, g.options.map((o, oi) =>
          UI.h('div', { class: 'setting', style: 'padding:10px 0' }, [
            UI.h('div', { style: 'width:30px;text-align:center;font-size:19px', text: o.emoji }),
            UI.h('div', { class: 'setting__meta' }, [
              UI.h('div', { class: 'setting__label', text: o.name }),
            ]),
            UI.h('div', { class: 'setting__control row gap-8' }, [
              UI.h('div', { style: 'width:160px' }, UI.rolePicker(o.role, v => { o.role = v; set({ groups: c.groups }); })),
              UI.switchBox(o.on !== false, v => { o.on = v; set({ groups: c.groups }); }),
              UI.h('button', {
                class: 'icon-btn icon-btn--sm', text: '✕',
                onclick: () => { g.options.splice(oi, 1); set({ groups: c.groups }); Router.render(); },
              }),
            ]),
          ])
        )),
        foot: [
          UI.h('button', {
            class: 'btn btn--sm btn--soft',
            onclick: () => {
              g.options.push({ id: 'o' + Date.now(), emoji: '\u{1F4E1}', name: 'New Role', role: 'r14', on: true });
              set({ groups: c.groups }); Router.render();
            },
          }, '＋ Add role'),
          UI.h('span', { class: 'tiny dim', text: g.options.length + ' roles in this group' }),
        ],
      }));
    });

    const right = UI.h('div', { class: 'stack' });

    right.appendChild(UI.card({
      title: '＋ Add group',
      body: UI.h('button', {
        class: 'btn btn--soft w-full',
        onclick: () => {
          c.groups.push({ id: 'g' + Date.now(), name: 'New Group', desc: 'Pick your options', on: true, options: [] });
          set({ groups: c.groups }); Router.render();
        },
      }, '＋ Create a new group'),
    }));

    right.appendChild(UI.card({
      title: '\u{1F5A5} Preview',
      sub: 'What members see in #' + DB.chName(c.channel),
      body: UI.messageBox(UI.botName(), 'Today at 16:44',
        'React with an emoji below to get your roles. You can remove them the same way.',
        UI.embedPreview({
          color: '#7c5cff', title: '\u{1F3FB} Pick your roles',
          desc: c.groups.filter(g => g.on).map(g =>
            g.name + '\n' + g.options.filter(o => o.on !== false).map(o => o.emoji + ' ' + o.name).join('    ')
          ).join('\n\n'),
          footer: 'Max ' + (c.maxRoles || 'no') + ' roles per member',
        })),
    }));

    return UI.h('div', { class: 'split' }, [left, right]);
  },
};

/* ============================================================
   CUSTOM ROLES
   ============================================================ */
Pages.customroles = {
  render: function () {
    const c = Store.merged('customroles');
    const set = (patch) => { Store.setCfg('customroles', patch); Router.render(); };

    const left = UI.h('div', { class: 'stack' });

    left.appendChild(UI.card({
      title: '\u2699 Custom Roles',
      sub: 'Self-assign roles with buttons or a dropdown',
      actions: [UI.moduleToggle('customroles', () => Router.render())],
      body: [
        UI.toggleRow('Enable custom roles', 'Members can pick their own', c.enabled, v => { set({ enabled: v }); }),
        UI.h('hr'),
        UI.h('div', { class: 'grid grid--2' }, [
          UI.selectField('UI Type', c.type, [
            { value: 'button', label: 'Buttons — one per role' },
            { value: 'select', label: 'Dropdown menu' },
            { value: 'reaction', label: 'Reactions' },
          ], v => { set({ type: v }); Router.render(); }),
          UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Message Channel' }), UI.channelPicker(c.channel, v => set({ channel: v }))]),
        ]),
        UI.h('div', { class: 'mt-16' }, [
          UI.toggleRow('Single select', 'Members can only hold one role at a time', c.singleSelect, v => set({ singleSelect: v })),
        ]),
        UI.h('div', { class: 'field mt-16' }, [
          UI.h('label', { class: 'label', text: 'Button Colour' }),
          UI.h('div', { class: 'color-field' }, [
            UI.h('input', { type: 'color', value: c.color, oninput: (e) => set({ color: e.target.value }) }),
            UI.h('span', { class: 'mono small', text: c.color }),
          ]),
        ]),
      ],
      foot: [UI.saveBtn(() => {})],
    }));

    left.appendChild(UI.card({
      title: '\u{1F3AD} Available Roles',
      sub: c.roles.filter(r => r.on).length + ' of ' + c.roles.length + ' active',
      body: UI.h('div', { class: 'stack-sm' }, c.roles.map((r, i) => {
        const role = DB.roles.find(x => x.id === r.role) || {};
        return UI.h('div', { class: 'setting', style: 'padding:11px 0' }, [
          UI.h('div', {
            style: { width: '18px', height: '18px', borderRadius: '50%', background: role.color || '#99a1b3', flex: '0 0 18px' },
          }),
          UI.h('div', { class: 'setting__meta' }, [
            UI.h('div', { class: 'setting__label', text: r.label }),
            UI.h('div', { class: 'setting__desc', text: (role.name || '') + ' · ' + (role.members || 0) + ' members' }),
          ]),
          UI.h('div', { class: 'setting__control row gap-8' }, [
            UI.h('div', { style: 'width:150px' }, UI.rolePicker(r.role, v => { r.role = v; set({ roles: c.roles }); })),
            UI.switchBox(r.on, v => { r.on = v; set({ roles: c.roles }); }),
            UI.h('button', {
              class: 'icon-btn icon-btn--sm', text: '✕',
              onclick: () => { c.roles.splice(i, 1); set({ roles: c.roles }); Router.render(); },
            }),
          ]),
        ]);
      })),
      actions: [UI.h('button', {
        class: 'btn btn--sm btn--soft',
        onclick: () => {
          c.roles.push({ id: 'cr' + Date.now(), role: 'r14', on: true, label: 'New Role' });
          set({ roles: c.roles }); Router.render();
        },
      }, '＋ Add role')],
    }));

    const right = UI.h('div', { class: 'stack' });

    right.appendChild(UI.card({
      title: '\u{1F5A5} Preview',
      sub: 'In #' + DB.chName(c.channel),
      body: UI.h('div', { class: 'stack' }, [
        UI.messageBox(UI.botName(), 'Today at 16:44', 'Click a role to get it. Click again to remove.',
          UI.embedPreview({ color: c.color, title: '\u2699 Choose your roles', desc: c.roles.filter(r => r.on).map(r => '\u{1F4E1} ' + r.label).join('\n') })),
        UI.h('div', { class: 'row gap-8 wrap' }, c.roles.filter(r => r.on).map(r => {
          const role = DB.roles.find(x => x.id === r.role) || {};
          return UI.h('button', {
            class: 'btn btn--ghost btn--sm',
            style: { borderColor: (role.color || '#99a1b3') + '66' },
            onclick: () => UI.toast('Member would receive <b>' + role.name + '</b>', 'ok'),
          }, '\u{1F4E1} ' + r.label);
        })),
      ]),
    }));

    return UI.h('div', { class: 'split' }, [left, right]);
  },
};

/* ============================================================
   GIVEAWAYS
   ============================================================ */
Pages.giveaways = {
  render: function () {
    const c = Store.merged('giveaways');
    const set = (patch) => { Store.setCfg('giveaways', patch); Router.render(); };

    const left = UI.h('div', { class: 'stack' });

    left.appendChild(UI.card({
      title: '\u{1F3C6} Giveaway Settings',
      sub: 'Automate community drops',
      actions: [UI.moduleToggle('giveaways', () => Router.render())],
      body: [
        UI.toggleRow('Enable giveaways', 'Post and run giveaway embeds', c.enabled, v => { set({ enabled: v }); }),
        UI.h('hr'),
        UI.h('div', { class: 'grid grid--2' }, [
          UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Announcement Channel' }), UI.channelPicker(c.channel, v => set({ channel: v }))]),
          UI.field('Minimum Level', c.requireLevel, v => set({ requireLevel: v }), { type: 'number', hint: '0 = everyone can enter' }),
          UI.field('Minimum Account Age (days)', c.minAccountAge, v => set({ minAccountAge: v }), { type: 'number' }),
          UI.field('Minimum Server Members', c.minMembers, v => set({ minMembers: v }), { type: 'number' }),
        ]),
        UI.h('div', { class: 'field mt-16' }, [
          UI.h('label', { class: 'label', text: 'Required Role' }),
          UI.rolePicker(c.requireRole, v => set({ requireRole: v })),
        ]),
      ],
    }));

    /* active giveaways */
    left.appendChild(UI.card({
      title: '\u{1F3AF} Active Giveaways',
      sub: c.active.length + ' running',
      actions: [UI.h('button', { class: 'btn btn--sm btn--soft', onclick: () => newGiveaway() }, '＋ New giveaway')],
      body: UI.h('div', { class: 'stack-sm' }, c.active.map((g, i) => {
        const pct = Math.min(100, Math.round((g.entries / (g.entries + 120)) * 100));
        return UI.h('div', {
          class: 'setting',
          style: 'align-items:flex-start;border:1px solid var(--line);border-radius:10px;padding:14px',
        }, [
          UI.h('div', { class: 'setting__meta' }, [
            UI.h('div', { class: 'setting__label', text: g.prize }),
            UI.h('div', { class: 'setting__desc', text: g.entries + ' entries · ' + g.winners + ' winner(s)' + (g.requiredRole ? ' · requires ' + DB.roleName(g.requiredRole) : '') }),
            UI.h('div', { class: 'meter mt-8' }, UI.h('div', { class: 'meter__fill', style: { width: pct + '%' } })),
            UI.h('div', { class: 'tiny dim mt-4 mono', text: 'Ends in ' + UI.timeLeft(g.ends) }),
          ]),
          UI.h('div', { class: 'setting__control row gap-6' }, [
            UI.h('button', { class: 'btn btn--xs btn--ok', text: 'End now', onclick: () => UI.confirmDialog('End giveaway?', g.prize + ' will be drawn now.', () => UI.toast('Winner drawn: ' + DB.members[0].display, 'ok')) }),
            UI.h('button', { class: 'btn btn--xs btn--ghost', text: 'Edit', onclick: () => editGiveaway(g) }),
            UI.h('button', { class: 'icon-btn icon-btn--sm', text: '✕', onclick: () => { c.active.splice(i, 1); set({ active: c.active }); Router.render(); } }),
          ]),
        ]);
      })),
    }));

    const right = UI.h('div', { class: 'stack' });

    right.appendChild(UI.card({
      title: '\u{1F5A5} Live Countdown',
      sub: c.active[0] ? c.active[0].prize : 'No active giveaway',
      body: c.active[0] ? UI.h('div', { class: 'stack' }, [
        UI.messageBox(UI.botName(), 'Today at 16:44', '',
          UI.embedPreview({
            color: '#e84393', title: '\u{1F389} GIVEAWAY',
            desc: c.active[0].prize + '\n\nClick the 🎉 below to enter!\n\n**Hosted by** VDEX COP',
            fields: [{ name: 'Ends', value: UI.timeLeft(c.active[0].ends), inline: true }, { name: 'Winners', value: String(c.active[0].winners), inline: true }],
            footer: c.active[0].entries + ' people have entered',
          })),
        UI.h('div', { class: 'center' },
          UI.h('button', { class: 'btn btn--ok', onclick: () => UI.toast('You entered! Good luck.', 'ok') }, '\u{1F389} Enter giveaway')),
      ]) : UI.h('div', { class: 'hint center', style: 'padding:24px', text: 'No giveaway running right now.' }),
    }));

    right.appendChild(UI.card({
      title: '\u{1F4DC} Past Winners',
      sub: 'Recent history',
      body: UI.h('div', { class: 'stack-sm' }, c.history.map(h2 =>
        UI.h('div', { class: 'row' }, [
          UI.avatar(h2.winner, '#e84393', 'sm'),
          UI.h('div', { class: 'grow' }, [
            UI.h('div', { class: 'small bold', text: h2.prize }),
            UI.h('div', { class: 'tiny dim', text: 'Won by ' + h2.winner + ' · ' + UI.relDate(h2.date) + ' · ' + h2.entries + ' entries' }),
          ]),
          UI.pill('Done', 'on'),
        ])
      )),
    }));

    return UI.h('div', { class: 'split' }, [left, right]);

    function newGiveaway() {
      c.active.unshift({
        id: 'gw' + Date.now(), prize: 'New Giveaway', ends: Date.now() + 86400000,
        entries: 0, winners: 1, requiredRole: c.requireRole,
      });
      set({ active: c.active });
      UI.toast('Giveaway created', 'ok');
    }

    function editGiveaway(g) {
      UI.modal({
        title: 'Edit giveaway',
        body: UI.h('div', { class: 'stack' }, [
          UI.field('Prize', g.prize, v => g.prize = v, { max: 100 }),
          UI.field('Winners', g.winners, v => g.winners = v, { type: 'number' }),
          UI.field('Ends in (hours)', Math.max(1, Math.round((g.ends - Date.now()) / 3600000)), v => g.ends = Date.now() + v * 3600000, { type: 'number' }),
          UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Required Role' }), UI.rolePicker(g.requiredRole, v => g.requiredRole = v)]),
        ]),
        actions: [
          UI.h('button', { class: 'btn btn--ghost', 'data-close': true, text: 'Cancel' }),
          UI.h('button', {
            class: 'btn btn--primary', text: 'Save',
            onclick: () => {
              set({ active: c.active });
              document.querySelector('#modalRoot').hidden = true;
              document.body.style.overflow = '';
              Router.render(); UI.toast('Giveaway updated', 'ok');
            },
          }),
        ],
      });
    }
  },
};
