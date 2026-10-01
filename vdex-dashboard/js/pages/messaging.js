/* ============================================================
   VDEX COP — pages/messaging.js
   Welcome · Farewell · Embed Builder · Sticky Messages
   Autoresponder · Join DM
   ============================================================ */

/* Dashboard se seedha Discord par ASLI test bhejne wala button —
   Welcome (channel/embed) aur Join DM (asli DM) sab yahi use karte. */
function modTestBtn(key, label) {
  return UI.h('button', {
    class: 'btn btn--ok',
    onclick: async (e) => {
      const b = e.currentTarget;
      const old = b.textContent;
      b.disabled = true;
      b.textContent = '\u2026';
      try {
        const r = await API.testModule(key);
        UI.toast(UI.esc(r.result || 'sent'), 'ok', 9000);
      } catch (err) {
        UI.toast('Test fail: ' + UI.esc(err.message), 'err', 9000);
      } finally {
        b.disabled = false;
        b.textContent = old;
      }
    },
  }, label);
}

/* ============================================================
   WELCOME
   ============================================================ */
Pages.welcome = {
  render: function () {
    const c = Store.merged('welcome');
    /* set karo aur turant right-side preview redraw — taaki URL/type karte
       hi dikhe ki message kaisa ban raha hai. */
    const set = (patch) => {
      Store.setCfg('welcome', patch);
      drawPreview();
    };

    /* EmbedBuilder wala hi test button — Dashboard se seedha Discord par
       asla welcome embed (image/thumbnail ke saath) bhej ke dekh lo. */
    const testBtn = (k, l) => modTestBtn(k, l);

    const left = UI.h('div', { class: 'stack' });

    left.appendChild(UI.card({
      title: '\u{1F44B} Welcome Messages',
      sub: 'Greet every new member',
      actions: [UI.moduleToggle('welcome', () => Router.render())],
      body: [
        UI.toggleRow('Enable welcome', 'Post in the welcome channel on join', c.enabled, v => { set({ enabled: v }); Router.render(); }),
        UI.h('hr'),
        UI.h('div', { class: 'grid grid--2' }, [
          UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Welcome Channel' }), UI.channelPicker(c.channel, v => set({ channel: v }))]),
          UI.selectField('Message Type', c.type, [
            { value: 'card', label: 'Card — styled image' },
            { value: 'embed', label: 'Embed' },
            { value: 'plain', label: 'Plain text' },
            { value: 'dm', label: 'DM only' },
          ], v => { set({ type: v }); Router.render(); }),
        ]),
        UI.h('div', { class: 'mt-16' }, [
          UI.toggleRow('Also send a DM', 'Members get the message in their DMs too', c.dmOnJoin, v => set({ dmOnJoin: v })),
          UI.toggleRow('Show account age', 'Displays how old their account is', c.showAccountAge, v => set({ showAccountAge: v })),
          UI.toggleRow('Show invite source', 'Which invite brought them in', c.showInviteSource, v => set({ showInviteSource: v })),
          UI.toggleRow('Show member count', 'Current server size', c.showMemberCount, v => set({ showMemberCount: v })),
        ]),
      ],
    }));

    if (c.type === 'card' || c.type === 'embed') {
      left.appendChild(UI.card({
        title: c.type === 'card' ? '\u{1F3BC} Card Settings' : '\u{1F4DD} Message Content',
        body: [
          ...(c.type === 'card' ? [
            UI.field('Card Title', c.cardTitle, v => set({ cardTitle: v }), { max: 60, on: true }),
            UI.field('Card Subtitle', c.cardSub, v => set({ cardSub: v }), { max: 100, on: true, hint: 'Use {user} and {server} as placeholders.' }),
          ] : [
            UI.field('Welcome Message', c.message, v => set({ message: v }), { textarea: true, rows: 4, max: 1000, on: true, hint: 'Placeholders: {user} {username} {server} {count} {invite}' }),
          ]),
          UI.h('hr'),
          UI.h('div', { class: 'field' }, [
            UI.h('label', { class: 'label', text: 'Image & Thumbnail — EmbedBuilder wala same logic' }),
            UI.h('div', { class: 'tiny dim', text: 'Seedhi image URL (image/*) ya server message ka link do. DM wala link kaam nahi karta — wajah ke saath bata di jayegi.' }),
          ]),
          UI.h('div', { class: 'grid grid--2 mt-8' }, [
            UI.field('Image URL', c.image, v => set({ image: v }), {
              placeholder: 'https://… ya message link', on: true,
              hint: 'Bada image — embed me NEECHE full-width (Discord jaisa).',
            }),
            UI.field('Thumbnail URL', c.thumbnail, v => set({ thumbnail: v }), {
              placeholder: 'https://… ya message link', on: true,
              hint: 'Top-right chhota image. Message link do to bot uski pehli image utha lega.',
            }),
          ]),
        ],
        foot: [UI.saveBtn(() => {}), testBtn('welcome', '\u{1F4E4} Send test')],
      }));
    } else if (c.type === 'plain') {
      left.appendChild(UI.card({
        title: '\u{1F4DD} Message',
        body: UI.field('Welcome Message', c.message, v => set({ message: v }), { textarea: true, rows: 4, max: 1000, on: true, hint: 'Placeholders: {user} {username} {server} {count}' }),
        foot: [UI.saveBtn(() => {}), testBtn('welcome', '\u{1F4E4} Send test')],
      }));
    }

    const right = UI.h('div', { class: 'stack' });

    /* ---- Live preview: set() call hi isko dobara banata hai ---- */
    const previewBox = UI.h('div', { class: 'stack' });
    function drawPreview() {
      const cur = Store.merged('welcome');
      previewBox.innerHTML = '';
      /* EmbedBuilder wala hi Discord layout — thumbnail TOP-RIGHT chhota,
         bada image NEECHE full-width. Image/Thumbnail URL ka asar yahin
         turant dikhta hai (card aur embed dono me). */
      const media = { img: cur.image || '', thumbnail: cur.thumbnail || '' };
      const foot = DB.server.members.toLocaleString() + ' members';
      let inner;
      if (cur.type === 'card') {
        inner = UI.embedPreview(Object.assign({
          color: '#2ecc71',
          title: fill(cur.cardTitle, 'Sneha'),
          desc: fill(cur.cardSub, 'Sneha'),
          footer: 'Welcome to ' + DB.server.name,
        }, media));
      } else if (cur.type === 'embed') {
        inner = UI.embedPreview(Object.assign({
          color: '#2ecc71',
          desc: fill(cur.message, 'Sneha'),
          footer: foot,
        }, media));
      } else {
        inner = UI.embedPreview({
          color: '#2ecc71',
          desc: fill(cur.message, 'Sneha'),
          footer: foot,
        });
      }
      previewBox.appendChild(UI.messageBox(UI.botName(), 'Today at 16:44', '', inner));
    }
    drawPreview();

    right.appendChild(UI.card({
      title: '\u{1F5A5} Live Preview',
      sub: 'URL/likho — turant yahin ban jata hai',
      body: previewBox,
    }));

    right.appendChild(UI.card({
      title: '\u{1F4CE} Placeholders',
      body: UI.table([
        { label: 'Token', render: r => UI.h('code', { class: 'small text-brand', text: r[0] }) },
        { label: 'Replaces with', render: r => UI.h('span', { class: 'small muted', text: r[1] }) },
      ], [
        ['{user}', 'Full mention — @Sneha'],
        ['{username}', 'Name only — Sneha'],
        ['{server}', 'Server name — APEX CHEATS'],
        ['{count}', 'Member count — 4268'],
        ['{invite}', 'How they joined'],
        ['{accountage}', 'Account age in days'],
      ]),
    }));

    right.appendChild(UI.card({
      title: '\u{1F465} Recent Joins',
      body: UI.h('div', { class: 'stack-sm' }, DB.members.slice(4, 9).map(m =>
        UI.h('div', { class: 'row' }, [
          UI.avatar(m.name, m.color, 'sm'),
          UI.h('div', { class: 'grow' }, [
            UI.h('div', { class: 'small bold', text: m.display }),
            UI.h('div', { class: 'tiny dim', text: 'Joined ' + UI.relDate(m.joined) + ' · ' + m.role }),
          ]),
          UI.pill('Greeted', 'on'),
        ])
      )),
    }));

    return UI.h('div', { class: 'split' }, [left, right]);

    function fill(tpl, name) {
      return String(tpl || '')
        .replace(/\{user\}/g, '@' + name)
        .replace(/\{username\}/g, name)
        .replace(/\{server\}/g, DB.server.name)
        .replace(/\{count\}/g, DB.server.members.toLocaleString());
    }
  },
};

/* ============================================================
   FAREWELL
   ============================================================ */
Pages.farewell = {
  render: function () {
    const c = Store.merged('farewell');
    /* set → turant right-side preview redraw (URL/likhte hi dikh jata hai) */
    const set = (patch) => {
      Store.setCfg('farewell', patch);
      drawPreview();
    };

    const left = UI.h('div', { class: 'stack' }, [
      UI.card({
        title: '\u{1F44B} Farewell Messages',
        sub: 'Say goodbye when someone leaves',
        actions: [UI.moduleToggle('farewell', () => Router.render())],
        body: [
          UI.toggleRow('Enable farewell', 'Post when a member leaves the server', c.enabled, v => { set({ enabled: v }); Router.render(); }),
          UI.h('hr'),
          UI.h('div', { class: 'grid grid--2' }, [
            UI.h('div', { class: 'field' }, [UI.h('label', { class: 'label', text: 'Farewell Channel' }), UI.channelPicker(c.channel, v => set({ channel: v }))]),
            UI.selectField('Message Type', c.type, [
              { value: 'embed', label: 'Embed' },
              { value: 'plain', label: 'Plain text' },
              { value: 'card', label: 'Card' },
            ], v => { set({ type: v }); Router.render(); }),
          ]),
          UI.field('Farewell Message', c.message, v => set({ message: v }), {
            textarea: true, rows: 3, max: 1000, on: true,
            hint: 'Placeholders: {user} {username} {server} {count}',
          }),
          UI.h('div', { class: 'mt-16' }, [
            UI.toggleRow('Send a goodbye DM', 'DM the member before they go', c.dmOnLeave, v => set({ dmOnLeave: v })),
            UI.toggleRow('Show member count', 'New total after they leave', c.showMemberCount, v => set({ showMemberCount: v })),
            UI.toggleRow('Show time left', 'How long they were a member', c.showTimeLeft, v => set({ showTimeLeft: v })),
          ]),
        ],
        foot: [UI.saveBtn(() => {})],
      }),
      UI.card({
        title: '\u{1F5EB} Recent Departures',
        sub: 'Last 7 days',
        body: UI.h('div', { class: 'stack-sm' }, [
          dep('TempUser#8821', '1 day', 'left on their own'),
          dep('Spammer99#4410', '2 days', 'kicked by Moderator'),
          dep('Guest#2210', '4 days', 'left on their own'),
          dep('xXScammerXx#9931', '2 hours', 'banned by Owner'),
          dep('Newbie#7781', '6 days', 'left on their own'),
        ]),
      }),
    ]);

    const right = UI.h('div', { class: 'stack' });

    /* ---- live preview: set() isi ko dobara banata hai ---- */
    const previewBox = UI.h('div');
    function drawPreview() {
      const cur = Store.merged('farewell');
      previewBox.innerHTML = '';
      previewBox.appendChild(UI.messageBox(UI.botName(), 'Today at 16:44', '',
        UI.embedPreview({
          color: '#ff4757',
          desc: String(cur.message || '')
            .replace(/\{user\}/g, '@TempUser')
            .replace(/\{username\}/g, 'TempUser')
            .replace(/\{server\}/g, DB.server.name)
            .replace(/\{count\}/g, '4,267'),
        })));
    }
    drawPreview();

    right.appendChild(UI.card({
      title: '\u{1F5A5} Preview',
      sub: 'Likho — turant yahin ban jata hai',
      body: previewBox,
    }));
    right.appendChild(UI.card({
      title: '\u{1F4CE} Placeholders',
      body: UI.h('div', { class: 'chips' }, ['{user}', '{username}', '{server}', '{count}', '{time}'].map(t =>
        UI.h('button', { class: 'chip', onclick: () => UI.copy(t, t + ' copied') }, t))),
    }));

    if (!c.enabled) {
      right.appendChild(UI.h('div', {}, UI.alert('info', 'Farewell messages are <b>disabled</b>. Nobody is being told goodbye right now.')));
    }

    return UI.h('div', { class: 'split' }, [left, right]);

    function dep(tag, when, how) {
      return UI.h('div', { class: 'row' }, [
        UI.avatar(tag.split('#')[0], '#6b7488', 'sm'),
        UI.h('div', { class: 'grow' }, [
          UI.h('div', { class: 'small bold', text: tag }),
          UI.h('div', { class: 'tiny dim', text: when + ' ago · ' + how }),
        ]),
      ]);
    }
  },
};

/* ============================================================
   EMBED BUILDER
   ============================================================ */
Pages.embedbuilder = {
  render: function () {
    const c = Store.merged('embedbuilder');
    const set = (patch) => { Store.setCfg('embedbuilder', patch); draw(); };

    const left = UI.h('div', { class: 'stack' });

    /* Colour LIVE — teeno raste (native picker, hex TYPE/PASTE, swatch)
       preview ko turant update karte hain. Insurance: draw() ke alawa accent
       line ko wahi jagah bhi set kar dete hain — kuch bhi skip ho to bhi
       colour wali line rang jayegi. */
    const HEX_RE = /^#[0-9a-f]{6}$/i;
    const colorInput = UI.h('input', {
      type: 'color',
      value: HEX_RE.test(c.color || '') ? c.color : '#7c5cff',
      oninput: (e) => setColor(e.target.value),
      onchange: (e) => setColor(e.target.value),
    });
    const hexInput = UI.h('input', {
      class: 'input mono',
      style: { width: '104px', textAlign: 'center', padding: '6px 6px' },
      value: c.color || '',
      maxlength: 7,
      spellcheck: false,
      'aria-label': 'Embed colour hex (jaise #2ecc71)',
      oninput: (e) => {
        let v = e.target.value.trim();
        if (/^[0-9a-f]{6}$/i.test(v)) { v = '#' + v; e.target.value = v; }
        if (HEX_RE.test(v)) setColor(v, true);
      },
      onchange: (e) => {
        const v = e.target.value.trim();
        const norm = HEX_RE.test(v) ? v : (HEX_RE.test('#' + v) ? '#' + v : null);
        if (norm) setColor(norm, true);
        else e.target.value = Store.merged('embedbuilder').color || '';  // galat value → wapas
      },
    });
    function setColor(v, fromHex) {
      const hex = v.charAt(0) === '#' ? v : '#' + v;
      if (!HEX_RE.test(hex)) return;
      set({ color: hex });                       // → draw() se preview rebuild
      if (colorInput.value !== hex) colorInput.value = hex;
      if (fromHex) {
        if (hexInput.value.charAt(0) !== '#') hexInput.value = hex;   // auto '#'
      } else if (hexInput.value !== hex) {
        hexInput.value = hex;
      }
      const emb = preview.querySelector('.embed');   // insurance — line turant
      if (emb) emb.style.setProperty('--embed-color', hex);
    }

    left.appendChild(UI.card({
      title: '\u{1F4E1} Embed Builder',
      sub: 'Design a rich embed with a live preview',
      actions: [UI.moduleToggle('embedbuilder', () => Router.render())],
      body: [
        UI.h('div', { class: 'field' }, [
          UI.h('label', { class: 'label', text: 'Target Channel' }),
          UI.channelPicker(c.targetChannel, v => set({ targetChannel: v })),
        ]),
        UI.h('hr'),
        UI.field('Author', c.author, v => set({ author: v }), { max: 256, on: true }),
        UI.field('Title', c.title, v => set({ title: v }), { max: 256, on: true }),
        UI.field('Description', c.description, v => set({ description: v }), {
          textarea: true, rows: 4, max: 4096, on: true,
          hint: 'Emoji: normal wale (😀🎉) seedha paste karo. Custom / Nitro emoji ke liye Discord me '
            + '\\:naam: likh kar bhejo — wo <a:naam:123> (animated) ya <:naam:123> (static) me badal jayega, '
            + 'wahi code yahan paste karo. Preview me asli emoji dikhega, Discord par bhi render hoga. '
            + 'Markdown bhi chalta hai: **bold**, *italic*, __under__, ~~strike~~, `code`, # heading.',
        }),
        UI.h('div', { class: 'field mt-16' }, [
          UI.h('label', { class: 'label', text: 'Colour' }),
          UI.h('div', { class: 'color-field' }, [
            colorInput,
            hexInput,
            UI.h('div', { class: 'row gap-6' }, ['#7c5cff', '#2ecc71', '#e74c3c', '#ffa502', '#2e9bff'].map(hex =>
              UI.h('button', {
                style: { width: '18px', height: '18px', borderRadius: '4px', background: hex, border: '1px solid var(--line-2)' },
                onclick: () => setColor(hex),
              })
            )),
          ]),
        ]),
        UI.h('div', { class: 'grid grid--2 mt-16' }, [
          UI.field('Image URL', c.image, v => set({ image: v }), {
            placeholder: 'https://…', on: true,
            hint: 'Seedhi image URL (https://…/pic.png) ya server ke message ka link — bot dono samajhta hai. DM wala link kaam nahi karta.',
          }),
          UI.field('Thumbnail URL', c.thumbnail, v => set({ thumbnail: v }), {
            placeholder: 'https://…', on: true,
            hint: 'Waise hi — image URL ya message link (image/* honi chahiye).',
          }),
        ]),
        UI.field('Footer', c.footer, v => set({ footer: v }), { max: 2048, on: true }),
      ],
    }));

    /* fields editor */
    const fieldBox = UI.h('div', { class: 'stack-sm' });
    function drawFields() {
      fieldBox.innerHTML = '';
      c.fields.forEach((f, i) => {
        fieldBox.appendChild(UI.h('div', { class: 'setting', style: 'align-items:flex-start;border:1px solid var(--line);border-radius:10px;padding:12px' }, [
          UI.h('div', { class: 'grow' }, [
            UI.field('Name', f.name, v => { f.name = v; set({ fields: c.fields }); }, { max: 256, on: true }),
            UI.field('Value', f.value, v => { f.value = v; set({ fields: c.fields }); }, { textarea: true, rows: 2, max: 1024, on: true }),
            UI.toggleRow('Inline', 'Show side by side', f.inline, v => { f.inline = v; set({ fields: c.fields }); draw(); }),
          ]),
          UI.h('button', {
            class: 'icon-btn icon-btn--sm', text: '✕',
            onclick: () => { c.fields.splice(i, 1); set({ fields: c.fields }); drawFields(); draw(); },
          }),
        ]));
      });
      if (!c.fields.length) {
        fieldBox.appendChild(UI.h('div', { class: 'hint center', style: 'padding:16px', text: 'No fields yet.' }));
      }
    }
    drawFields();

    left.appendChild(UI.card({
      title: '\u{1F4CB} Fields',
      sub: c.fields.length + ' field(s) — max 10',
      actions: [UI.h('button', {
        class: 'btn btn--sm btn--soft',
        onclick: () => {
          if (c.fields.length >= 10) return UI.toast('Maximum 10 fields', 'err');
          c.fields.push({ id: 'ebf' + Date.now(), name: 'Field ' + (c.fields.length + 1), value: 'Value', inline: false });
          set({ fields: c.fields }); drawFields();
        },
      }, '＋ Add field')],
      body: fieldBox,
      foot: [UI.saveBtn(() => {})],
    }));

    /* live preview */
    const preview = UI.h('div', { class: 'stack' });
    function draw(override) {
      /* Taaza config lo — render ka purana snapshot nahi (warna preview
         me old values reh jaati thi). */
      const cur = Object.assign(Store.merged('embedbuilder'), override || {});
      preview.innerHTML = '';
      const targetOk = (DB.channels || []).some(ch => String(ch.id) === String(cur.targetChannel));
      preview.appendChild(UI.card({
        title: '\u{1F5A5} Live Discord Preview',
        sub: targetOk ? '# ' + DB.chName(cur.targetChannel) : 'channel delete ho chuka \u2014 naya chuno',
        actions: [UI.pill('Realtime', 'on')],
        body: UI.h('div', { class: 'stack' }, [
          targetOk
            ? null
            : UI.alert('warn', 'Saved <b>Target Channel</b> delete ho chuka hai \u2014 left side channel naya chuno, warna send fail hoga.'),
          UI.messageBox(cur.author || 'BOT', 'Today at 16:44', '',
            UI.embedPreview({
              color: cur.color, author: cur.author, title: cur.title, desc: cur.description,
              img: cur.image, thumbnail: cur.thumbnail, footer: cur.footer, fields: cur.fields,
            })),
        ]),
      }));

      preview.appendChild(UI.card({
        title: '\u{1F4CB} JSON Output',
        sub: 'Ready to paste into a webhook',
        body: [
          UI.h('pre', {
            class: 'mono tiny',
            style: {
              background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: '8px',
              padding: '12px', overflowX: 'auto', maxHeight: '240px', color: 'var(--text-2)', margin: 0,
            },
            text: JSON.stringify({
              username: cur.author, embeds: [{
                author: { name: cur.author }, title: cur.title, description: cur.description,
                color: parseInt((cur.color || '#7c5cff').replace('#', ''), 16),
                image: cur.image ? { url: cur.image } : undefined,
                thumbnail: cur.thumbnail ? { url: cur.thumbnail } : undefined,
                footer: { text: cur.footer },
                fields: cur.fields,
              }],
            }, null, 2),
          }),
          UI.h('div', { class: 'row gap-8 mt-12' }, [
            UI.h('button', {
              class: 'btn btn--ok',
              onclick: async (e) => {
                const b = e.currentTarget;
                const old = b.textContent;
                b.disabled = true;
                b.textContent = '\u2026';
                try {
                  const r = await API.testModule('embedbuilder');
                  UI.toast(UI.esc(r.result || 'sent'), 'ok', 7000);
                } catch (err) {
                  UI.toast('Send fail: ' + UI.esc(err.message), 'err', 7000);
                } finally {
                  b.disabled = false;
                  b.textContent = old;
                }
              },
            }, '\u{1F4E4} Send to channel'),
            UI.h('button', {
              class: 'btn btn--ghost',
              onclick: () => UI.copy(JSON.stringify({ embeds: [{ title: cur.title, description: cur.description }] }), 'Embed JSON copied'),
            }, '\u{1F4CB} Copy JSON'),
            UI.h('button', {
              class: 'btn btn--ghost',
              onclick: () => {
                draw({ title: 'Test' });
                setTimeout(() => draw(), 1400);
              },
            }, '\u{1F9EA} Test render'),
          ]),
        ],
      }));
    }
    draw();

    return UI.h('div', { class: 'split' }, [left, preview]);
  },
};

/* ============================================================
   STICKY MESSAGES
   ============================================================ */
Pages.stickymessages = {
  render: function () {
    const c = Store.merged('stickymessages');
    /* Structural change (toggle/add/delete) → poora render. Sirf TEXT typing
       par targeted drawPreview() — warna har keystroke par page rebuild hota
       hai aur input ka focus/caret chala jaata hai (preview "live" nahi lagta). */
    const set = (patch) => { Store.setCfg('stickymessages', patch); Router.render(); };
    const save = (patch) => { Store.setCfg('stickymessages', patch); };

    /* ---- asli Discord channels (API state se) ----------------------
       Sticky ko bhejne ke liye REAL channel id chahiye. Pehle ye page
       `c1`, `c5` jaise demo id deta tha, jise bot resolve nahi kar
       pata tha — isliye unhe naam ke hisaab se asli id me badal dete
       hain (ek hi baar, save bhi ho jaata hai). */
    const realChannels = () => {
      try {
        const st = (window.API && API.isReady && API.state()) || null;
        return ((st && st.channels) || []).filter(ch => ch.type === 'text' || ch.type === 'news');
      } catch (e) { return []; }
    };

    const realIdFor = (val) => {
      if (!val) return '';
      if (/^\d{10,}$/.test(String(val))) return String(val);
      const want = String(DB.chName(val)).toLowerCase();
      const hit = realChannels().find(ch => String(ch.name).toLowerCase() === want);
      return hit ? hit.id : '';
    };

    const chName = (val) => {
      const hit = realChannels().find(ch => ch.id === String(val));
      return hit ? hit.name : DB.chName(val);
    };

    /* mock id -> real id (sirf tab save jab kuch badla ho) */
    const before = (c.messages || []).map(m => m.channel).join('|') + '#' + c.dest;
    c.messages = (c.messages || []).map(m => {
      const real = realIdFor(m.channel);
      return real && real !== m.channel ? Object.assign({}, m, { channel: real }) : m;
    });
    const destReal = realIdFor(c.dest);
    if (destReal && destReal !== c.dest) c.dest = destReal;
    const after = (c.messages || []).map(m => m.channel).join('|') + '#' + c.dest;
    if (before !== after && realChannels().length) {
      Store.setCfg('stickymessages', { messages: c.messages, dest: c.dest });
    }

    /* ---- Live preview: typing / channel change par sirf ye box redraw ---- */
    const previewBox = UI.h('div', { class: 'stack-sm' });
    function drawPreview() {
      previewBox.innerHTML = '';
      const active = c.messages.filter(m => m.on);
      if (!active.length) {
        previewBox.appendChild(UI.h('div', {
          class: 'small muted',
          text: 'Koi active sticky nahi — "New sticky" banao ya upar toggle on karo.',
        }));
        return;
      }
      active.forEach(m => {
        previewBox.appendChild(UI.h('div', {
          class: 'tiny dim', style: 'margin-top:6px',
          text: m.channel ? '\u{1F4E2} #' + chName(m.channel)
                          : '\u26A0\uFE0F channel nahi chuna',
        }));
        if (!String(m.content || '').trim()) {
          previewBox.appendChild(UI.h('div', {
            class: 'small muted',
            text: '\u270D\uFE0F Ye sticky ka message abhi khaali hai — left side me type karo, yahan turant dikhega.',
          }));
          return;
        }
        previewBox.appendChild(UI.messageBox(
          UI.botName(), 'Today at 16:44',
          String(m.content || '').replace(/\{user\}/g, '@Sneha'), null));
      });
    }

    function channelSelect(m) {
      const chans = realChannels();
      const cur = String(m.channel || '');
      if (!chans.length) {
        return UI.h('span', { class: 'mono', text: '#' + DB.chName(m.channel) });
      }
      const sel = UI.h('select', { class: 'input', style: 'max-width:220px;padding:7px 10px;font-size:12.5px' });
      if (!chans.some(ch => ch.id === cur)) {
        sel.appendChild(UI.h('option', { value: '', text: '— channel chuno —' }));
      }
      chans.forEach(ch => sel.appendChild(UI.h('option', { value: ch.id, text: '# ' + ch.name })));
      sel.value = cur && chans.some(ch => ch.id === cur) ? cur : '';
      sel.addEventListener('change', () => {
        if (!sel.value) return;
        m.channel = sel.value;
        save({ messages: c.messages });
        drawPreview();   // live — preview ka channel label turant badal jaye
      });
      return sel;
    }

    const left = UI.h('div', { class: 'stack' });

    left.appendChild(UI.card({
      title: '\u{1F9F0} Sticky Messages',
      sub: 'A permanent message that re-posts on restart',
      actions: [UI.moduleToggle('stickymessages', () => Router.render())],
      body: [
        UI.toggleRow('Enable sticky messages', 'Bot re-posts them if deleted', c.enabled, v => { set({ enabled: v }); }),
        UI.toggleRow('Re-create on restart', 'Re-post when the bot starts', c.persistOnRestart, v => set({ persistOnRestart: v })),
        UI.toggleRow('Delete when disabled', 'Remove all stickies on disable', c.create, v => set({ create: v })),
      ],
    }));

    left.appendChild(UI.card({
      title: '\u{1F4CB} Configured Messages',
      sub: c.messages.filter(m => m.on).length + ' of ' + c.messages.length + ' active',
      actions: [UI.h('button', { class: 'btn btn--sm btn--soft', onclick: () => addSticky() }, '＋ New sticky')],
      body: UI.h('div', { class: 'stack-sm' }, c.messages.map((m, i) =>
        UI.h('div', { class: 'setting', style: 'align-items:flex-start;border:1px solid var(--line);border-radius:10px;padding:13px' }, [
          UI.h('div', { class: 'setting__meta' }, [
            UI.h('div', { class: 'setting__label' }, [
              channelSelect(m),
            ]),
            UI.field('Message', m.content, v => { m.content = v; save({ messages: c.messages }); drawPreview(); }, { textarea: true, rows: 2, max: 2000, on: true, hint: 'Use {user} for a mention — type karte hi neeche preview live update hota hai.' }),
            UI.h('div', { class: 'tiny dim mt-4', text: 'Created ' + m.time }),
          ]),
          UI.h('div', { class: 'setting__control stack-sm', style: 'align-items:flex-end' }, [
            UI.switchBox(m.on, v => { m.on = v; set({ messages: c.messages }); }),
            UI.h('button', {
              class: 'icon-btn icon-btn--sm', text: '✕',
              onclick: () => { c.messages.splice(i, 1); set({ messages: c.messages }); },
            }),
          ]),
        ])
      )),
    }));

    const right = UI.h('div', { class: 'stack' });

    right.appendChild(UI.card({
      title: '\u{1F5A5} Preview',
      sub: 'Live \u2014 type karo, turant dikhega',
      body: previewBox,
    }));
    drawPreview();

    right.appendChild(UI.card({
      title: '\u{1F4A1} How it works',
      body: UI.h('div', { class: 'stack-sm' }, [
        UI.h('div', { class: 'small muted', text: '1. A sticky message is a normal message the bot posts once.' }),
        UI.h('div', { class: 'small muted', text: '2. If a moderator deletes it, the bot re-posts within 2 seconds.' }),
        UI.h('div', { class: 'small muted', text: '3. On bot restart it comes back automatically.' }),
        UI.h('div', { class: 'small muted', text: '4. {user} gets replaced with whoever is reading it at the time.' }),
      ]),
    }));

    return UI.h('div', { class: 'split' }, [left, right]);

    function addSticky() {
      c.messages.push({
        id: 'sm' + Date.now(), channel: c.dest, content: 'New sticky message — {user}',
        on: true, time: new Date().toISOString().slice(0, 16).replace('T', ' '),
      });
      set({ messages: c.messages });
    }
  },
};

/* ============================================================
   AUTORESPONDER
   ============================================================ */
Pages.autoresponder = {
  render: function () {
    const c = Store.merged('autoresponder');
    const set = (patch) => { Store.setCfg('autoresponder', patch); Router.render(); };

    const left = UI.h('div', { class: 'stack' });

    left.appendChild(UI.card({
      title: '\u{1F4AC} Autoresponder',
      sub: 'Automatic replies for trigger phrases',
      actions: [UI.moduleToggle('autoresponder', () => Router.render())],
      body: [
        UI.toggleRow('Enable autoresponder', 'Replies when a trigger is matched', c.enabled, v => { set({ enabled: v }); }),
        UI.h('hr'),
        UI.selectField('Match Type', c.type, [
          { value: 'keyword', label: 'Keyword — exact word match' },
          { value: 'wildcard', label: 'Wildcard — * works as any character' },
          { value: 'regex', label: 'Regex — advanced' },
          { value: 'contains', label: 'Contains — anywhere in message' },
        ], v => set({ type: v })),
        UI.h('div', { class: 'mt-16' }, [
          UI.toggleRow('Wildcards', 'Allow * and ? wildcards in phrases', c.useWildcard, v => set({ useWildcard: v })),
          UI.toggleRow('Case sensitive', 'Match capitalisation exactly', c.matchCase, v => set({ matchCase: v })),
          UI.toggleRow('DM on match', 'Also send the reply as a DM', c.dmOnMatch, v => set({ dmOnMatch: v })),
        ]),
        UI.field('Rate Limit (seconds)', c.rateLimit, v => set({ rateLimit: v }), { type: 'number', hint: 'Minimum gap between replies per user — stops loops.' }),
      ],
    }));

    left.appendChild(UI.card({
      title: '\u{1F50D} Triggers',
      sub: c.triggers.filter(t => t.on).length + ' of ' + c.triggers.length + ' active',
      actions: [UI.h('button', { class: 'btn btn--sm btn--soft', onclick: () => addTrigger() }, '＋ New trigger')],
      body: UI.table([
        { label: 'Trigger', render: t => UI.h('span', { class: 'mono small bold', text: t.phrase }) },
        { label: 'Response', render: t => UI.h('span', { class: 'small muted truncate', style: 'max-width:280px;display:inline-block', text: t.resp }) },
        { label: 'Hits', render: t => UI.h('span', { class: 'small dim', text: t.hits }) },
        { label: 'On', render: t => UI.switchBox(t.on, v => { t.on = v; set({ triggers: c.triggers }); }) },
        {
          label: '', render: (t) => {
            const idx = c.triggers.indexOf(t);
            return UI.h('div', { class: 'table__actions' }, [
              UI.h('button', { class: 'btn btn--xs btn--ghost', text: 'Edit', onclick: () => editTrigger(t) }),
              UI.h('button', { class: 'btn btn--xs btn--danger', text: '✕', onclick: () => { c.triggers.splice(idx, 1); set({ triggers: c.triggers }); } }),
            ]);
          }
        },
      ], c.triggers),
    }));

    const right = UI.h('div', { class: 'stack' });

    const previewBox = UI.h('div', {});
    previewBox.appendChild(UI.h('div', { class: 'hint center', style: 'padding:20px', text: 'Start typing…' }));

    right.appendChild(UI.card({
      title: '\u{1F4CA} Popularity',
      sub: 'Most used triggers',
      body: UI.bars(c.triggers.slice().sort((a, b) => b.hits - a.hits).map(t => ({
        label: t.phrase, value: t.hits, tone: t.hits > 70 ? 'green' : '',
      }))),
    }));

    right.appendChild(UI.card({
      title: '\u{1F5A5} Live Preview',
      sub: 'Type something to test',
      body: [
        UI.h('input', {
          class: 'input', placeholder: 'Type a message to test triggers…',
          oninput: (e) => {
            const val = e.target.value.toLowerCase();
            const hit = c.triggers.filter(t => t.on).find(t =>
              c.type === 'contains' ? val.includes(t.phrase.toLowerCase())
                : val.split(/\s+/).some(w => w === t.phrase.toLowerCase().replace(/\*/g, ''))
            );
            previewBox.innerHTML = '';
            if (!val.trim()) { previewBox.appendChild(UI.h('div', { class: 'hint center', style: 'padding:20px', text: 'Start typing…' })); return; }
            previewBox.appendChild(UI.messageBox(e.target.value || 'You', 'Just now', val, null));
            if (hit) {
              previewBox.appendChild(UI.messageBox(UI.botName(), 'Just now', hit.resp,
                UI.embedPreview({ color: '#7c5cff', desc: 'Trigger: ' + hit.phrase })));
            } else {
              previewBox.appendChild(UI.h('div', { class: 'hint center', style: 'padding:12px', text: 'No trigger matched.' }));
            }
          },
        }),
        UI.h('div', { class: 'mt-12' }, previewBox),
      ],
    }));

    if (!c.enabled) right.appendChild(UI.h('div', {}, UI.alert('info', 'Autoresponder is <b>disabled</b> — no automatic replies are being sent.')));

    return UI.h('div', { class: 'split' }, [left, right]);

    function addTrigger() {
      c.triggers.push({ id: 'at' + Date.now(), phrase: 'newphrase', resp: 'Thanks for asking!', on: true, hits: 0 });
      set({ triggers: c.triggers });
    }

    function editTrigger(t) {
      UI.modal({
        title: 'Edit trigger',
        body: UI.h('div', { class: 'stack' }, [
          UI.field('Trigger phrase', t.phrase, v => t.phrase = v, { hint: 'Use * for wildcards, e.g. how do i get * key' }),
          UI.field('Response', t.resp, v => t.resp = v, { textarea: true, rows: 4, max: 2000 }),
          UI.toggleRow('Enabled', 'This trigger is active', t.on, v => t.on = v),
        ]),
        actions: [
          UI.h('button', { class: 'btn btn--ghost', 'data-close': true, text: 'Cancel' }),
          UI.h('button', {
            class: 'btn btn--primary', text: 'Save',
            onclick: () => {
              set({ triggers: c.triggers });
              document.querySelector('#modalRoot').hidden = true;
              document.body.style.overflow = '';
              Router.render();
              UI.toast('Trigger saved', 'ok');
            },
          }),
        ],
      });
    }
  },
};

/* ============================================================
   JOIN DM
   ============================================================ */
Pages.joindm = {
  render: function () {
    const c = Store.merged('joindm');
    const set = (patch) => { Store.setCfg('joindm', patch); drawPreview(); };

    const left = UI.h('div', { class: 'stack' }, [
      UI.card({
        title: '\u2709 Join DM',
        sub: 'Send rules to new members automatically',
        actions: [UI.moduleToggle('joindm', () => Router.render())],
        body: [
          UI.toggleRow('Enable Join DM', 'DMs every new member on join', c.enabled, v => { set({ enabled: v }); Router.render(); }),
          UI.h('hr'),
          UI.h('div', { class: 'grid grid--2' }, [
            UI.field('Delay before DM (seconds)', c.delay, v => set({ delay: v }), { type: 'number', hint: '0 = instant, 60 = after 1 minute' }),
            UI.field('Retry attempts', c.retry, v => set({ retry: v }), { type: 'number', hint: 'Most DMs need 2–3 tries' }),
          ]),
          UI.toggleRow('Include rules link', 'Append a link to your rules channel', c.includeRules, v => set({ includeRules: v })),
          UI.h('div', { class: 'field mt-16' }, [UI.h('label', { class: 'label', text: 'Rules Channel' }), UI.channelPicker(c.rulesChannel, v => set({ rulesChannel: v }))]),
        ],
        foot: [UI.saveBtn(() => {}), modTestBtn('joindm', '\u{1F4E8} Send DM test')],
      }),
      UI.card({
        title: '\u{1F4A7} DM Content',
        body: [
          UI.field('Title', c.title, v => set({ title: v }), { max: 256, on: true }),
          UI.field('Message', c.message, v => set({ message: v }), { textarea: true, rows: 5, max: 1000, on: true, hint: 'Placeholders: {user} {username} {server} {rules}' }),
        ],
      }),
    ]);

    const right = UI.h('div', { class: 'stack' });

    /* ---- live preview: set() isi ko dobara banata hai ---- */
    const previewBox = UI.h('div');
    function drawPreview() {
      const cur = Store.merged('joindm');
      previewBox.innerHTML = '';
      previewBox.appendChild(UI.messageBox(UI.botName(), 'Just now', '',
        UI.embedPreview({
          color: '#7c5cff', title: cur.title,
          desc: String(cur.message || '')
            .replace(/\{user\}/g, '@Sneha')
            .replace(/\{username\}/g, 'Sneha')
            .replace(/\{server\}/g, DB.server.name)
            .replace(/\{rules\}/g, cur.includeRules ? 'https://discord.gg/HKTNOW/rules' : '(no link)'),
          footer: 'You have ' + cur.delay + 's before this gets sent',
        })));
      retryBox.innerHTML = '';
      retryBox.appendChild(UI.alert('info', 'Users with DMs closed will fail. The bot retries <b>' + cur.retry + ' times</b> before giving up.'));
      retryBox.appendChild(UI.alert('info', 'Join par DM tabhi jayega jab <b>Server Members Intent</b> ON ho (abhi ON hai) — neeche <b>Send DM test</b> dabao, tumhare DM me asla message aa jayega.'));
    }

    right.appendChild(UI.card({
      title: '\u{1F5A5} DM Preview',
      sub: 'Likho — turant yahin ban jata hai',
      body: previewBox,
    }));
    const retryBox = UI.h('div', { class: 'mt-16' });
    right.appendChild(UI.card({
      title: '\u{1F4CA} DM Delivery',
      sub: 'Last 30 days',
      body: [
        UI.h('div', { class: 'grid grid--3' }, [
          UI.stat('Sent', 384, { tone: 'green' }),
          UI.stat('Delivered', 312, { tone: 'brand' }),
          UI.stat('Failed', 72, { tone: 'red' }),
        ]),
        retryBox,
      ],
    }));

    if (!c.enabled) right.appendChild(UI.h('div', {}, UI.alert('warn', 'Join DM is <b>off</b>. New members receive no rules message.')));

    drawPreview();
    return UI.h('div', { class: 'split' }, [left, right]);
  },
};
