/* ============================================================
   VDEX COP — ui.js
   Chhota helper library: DOM builders, toast, modal, charts.
   ============================================================ */

window.UI = (function () {
  'use strict';

  /* =========================================================
     DOM helpers
     ========================================================= */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(k => {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.keys(v).forEach(d => { el.dataset[d] = v[d]; });
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    append(el, children);
    return el;
  }

  function append(el, children) {
    if (children === null || children === undefined || children === false) return;
    if (Array.isArray(children)) { children.forEach(c => append(el, c)); return; }
    el.appendChild(children instanceof Node ? children : document.createTextNode(String(children)));
  }

  const esc = (s) => String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* =========================================================
     Toasts
     ========================================================= */
  function toast(msg, kind = 'info', ms = 3000) {
    const root = $('#toasts');
    if (!root) return;
    const icons = { info: '\u{1F4CB}', ok: '\u2705', err: '\u274C', warn: '\u26A0\uFE0F' };
    const el = h('div', { class: `toast toast--${kind}` }, [
      h('span', { class: 'toast__ico', text: icons[kind] || icons.info }),
      h('div', { class: 'toast__msg', html: msg }),
    ]);
    root.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 220);
    }, ms);
  }

  /* =========================================================
     Modal
     ========================================================= */
  let modalCloser = null;

  function modal(opts) {
    const root = $('#modalRoot');
    const title = $('#modalTitle');
    const body = $('#modalBody');
    const foot = $('#modalFoot');
    if (!root) return;

    title.textContent = opts.title || '';
    body.innerHTML = '';
    append(body, opts.body);
    foot.innerHTML = '';
    append(foot, opts.actions || []);

    const modalEl = root.querySelector('.modal');
    modalEl.classList.toggle('modal--wide', !!opts.wide);
    root.hidden = false;
    document.body.style.overflow = 'hidden';

    const close = () => {
      if (root.hidden) return;
      root.hidden = true;
      document.body.style.overflow = '';
      $$('[data-close]', root).forEach(b => b.removeEventListener('click', close));
      const then = modalCloser;
      modalCloser = null;
      if (then && then !== close) then();
    };
    modalCloser = close;

    $$('[data-close]', root).forEach(b => b.addEventListener('click', close));
    if (opts.onClose) { const prev = modalCloser; modalCloser = () => { close(); opts.onClose(); prev && prev(); }; }

    const first = body.querySelector('input,select,textarea,button');
    if (first) setTimeout(() => first.focus(), 60);
  }

  function confirmDialog(title, msg, onYes, yesLabel = 'Confirm', danger = true) {
    modal({
      title,
      body: h('p', { class: 'muted', text: msg }),
      actions: [
        h('button', { class: 'btn btn--ghost', 'data-close': true, text: 'Cancel' }),
        h('button', {
          class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`,
          text: yesLabel,
          onclick: () => { modalCloser && modalCloser(); onYes && onYes(); },
        }),
      ],
    });
  }

  /* =========================================================
     Building blocks
     ========================================================= */

  /** page header */
  function pageHead(mod, actions) {
    const m = typeof mod === 'string' ? DB.modByKey(mod) : mod;
    return h('div', { class: 'page-head' }, [
      h('div', { class: 'page-head__top' }, [
        h('div', {}, [
          h('div', { class: 'page-head__title' }, [
            h('div', { class: 'page-head__ico', text: m.icon || '\u{1F4CA}' }),
            h('div', {}, [
              h('h1', { text: m.name || 'Page' }),
              m.desc ? h('div', { class: 'page-head__desc', text: m.desc }) : null,
            ]),
          ]),
        ]),
        actions ? h('div', { class: 'page-head__actions' }, actions) : null,
      ]),
    ]);
  }

  /* title ke shuru ka emoji chip me chala jaye — apex-auth jaisa icon chip
     (har card ko alag se icon dena padta nahi) */
  const EMOJI_HEAD_RE = /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0F|\u200D\p{Extended_Pictographic})*/u;

  /** card wrapper */
  function card(opts) {
    const c = h('div', { class: 'card' + (opts.pad ? ' card--pad' : '') + (opts.hover ? ' card--hover' : '') });
    if (opts.title || opts.actions) {
      let icon = opts.icon || '';
      let title = opts.title || '';
      if (!icon && title) {
        const m = title.match(EMOJI_HEAD_RE);
        if (m) { icon = m[0]; title = title.slice(m[0].length).trim(); }
      }
      c.appendChild(h('div', { class: 'card__head' }, [
        h('div', { class: 'card__head-main' }, [
          icon ? h('div', { class: 'card__chip', text: icon }) : null,
          h('div', { class: 'card__head-txt' }, [
            h('h3', { text: title || opts.title || '' }),
            opts.sub ? h('p', { text: opts.sub }) : null,
          ]),
        ]),
        opts.actions ? h('div', { class: 'row' }, opts.actions) : null,
      ]));
    }
    if (opts.body !== undefined) c.appendChild(h('div', { class: 'card__body' }, opts.body));
    if (opts.foot) c.appendChild(h('div', { class: 'card__foot' }, opts.foot));
    return c;
  }

  /** stat tile */
  function stat(label, value, opts = {}) {
    return h('div', { class: 'stat' + (opts.tone ? ' stat--' + opts.tone : '') }, [
      opts.icon ? h('div', { class: 'stat__ico', text: opts.icon }) : null,
      h('div', { class: 'stat__label', text: label }),
      h('div', { class: 'stat__value', text: String(value) }),
      opts.sub ? h('div', { class: 'stat__sub', html: opts.sub }) : null,
    ]);
  }

  /** toggle switch */
  function toggleRow(label, desc, checked, onChange) {
    const input = h('input', { type: 'checkbox', checked: !!checked });
    input.addEventListener('change', () => onChange(input.checked));
    return h('div', { class: 'setting' }, [
      h('div', { class: 'setting__meta' }, [
        h('div', { class: 'setting__label', text: label }),
        desc ? h('div', { class: 'setting__desc', text: desc }) : null,
      ]),
      h('div', { class: 'setting__control' }, [
        h('label', { class: 'switch' }, [input, h('span', { class: 'switch__track' })]),
      ]),
    ]);
  }

  /** inline switch (no label row) */
  function switchBox(checked, onChange) {
    const input = h('input', { type: 'checkbox', checked: !!checked });
    input.addEventListener('change', () => onChange(input.checked));
    return h('label', { class: 'switch' }, [input, h('span', { class: 'switch__track' })]);
  }

  /** text field */
  function field(label, value, onChange, opts = {}) {
    const input = opts.textarea
      ? h('textarea', { class: 'textarea', placeholder: opts.placeholder || '', rows: opts.rows || 4, maxlength: opts.max })
      : h('input', { class: 'input', type: opts.type || 'text', placeholder: opts.placeholder || '', maxlength: opts.max });
    input.value = value === null || value === undefined ? '' : value;
    const ev = opts.on ? 'input' : 'change';
    input.addEventListener(ev, () => onChange(input.value));

    const wrap = h('div', { class: 'field' }, [
      h('label', { class: 'label', text: label }),
      input,
    ]);

    if (opts.max) {
      const counter = h('div', { class: 'counter', text: `${input.value.length} / ${opts.max}` });
      input.addEventListener('input', () => {
        counter.textContent = `${input.value.length} / ${opts.max}`;
        counter.classList.toggle('is-over', input.value.length > opts.max);
      });
      wrap.appendChild(counter);
    }
    if (opts.hint) wrap.appendChild(h('div', { class: 'hint', text: opts.hint }));
    return wrap;
  }

  /** select field */
  function selectField(label, value, options, onChange, opts = {}) {
    const sel = h('select', { class: 'select' },
      options.map(o => h('option', { value: o.value, text: o.label })));
    sel.value = value === null || value === undefined ? '' : String(value);
    sel.addEventListener('change', () => onChange(sel.value));
    return h('div', { class: 'field' }, [
      label ? h('label', { class: 'label', text: label }) : null,
      sel,
      opts.hint ? h('div', { class: 'hint', text: opts.hint }) : null,
    ]);
  }

  /** channel picker */
  /**
   * channel picker
   * opts.textOnly = sirf message-post ho sakein aise channels (voice/category
   * bahar) — warna panel kabhi post hi nahi hota.
   */
  function channelPicker(value, onChange, opts) {
    opts = opts || {};
    const isMsg = c => c.type === 'text' || c.type === 'news';
    const list = opts.textOnly ? DB.channels.filter(isMsg) : DB.channels;
    const prefix = c => (c.type === 'voice' ? '\uD83D\uDD0A ' : c.type === 'category' ? '\uD83D\uDCC1 ' : '# ') + c.name;
    const all = [{ value: '', label: '— Not set —' }].concat(
      list.map(c => ({ value: c.id, label: prefix(c) }))
    );
    const sel = h('select', { class: 'select' }, all.map(o => h('option', { value: o.value, text: o.label })));
    /* Saved channel delete ho chuka ho to select chup-chaap khaali na dikhe —
       warna user sochta hai channel set hai aur bhejne par fail hota hai. */
    if (value && !all.some(o => String(o.value) === String(value))) {
      const ch = DB.channels.find(c => String(c.id) === String(value));
      sel.appendChild(h('option', { value: String(value),
        text: ch && !isMsg(ch)
          ? '\u26A0\uFE0F ' + (ch.type === 'voice' ? 'voice' : ch.type) +
            ' channel \u2014 yahan message nahi jaata, TEXT channel chuno'
          : '\u26A0\uFE0F delete ho chuka channel \u2014 naya chuno' }));
    }
    sel.value = value || '';
    sel.addEventListener('change', () => onChange(sel.value));
    return sel;
  }

  /** role picker */
  function rolePicker(value, onChange, allowNone = true) {
    const opts = (allowNone ? [{ value: '', label: '— None —' }] : [])
      .concat(DB.roles.map(r => ({ value: r.id, label: r.name })));
    const sel = h('select', { class: 'select' }, opts.map(o => h('option', { value: o.value, text: o.label })));
    sel.value = value || '';
    sel.addEventListener('change', () => onChange(sel.value));
    return sel;
  }

  /** module on/off switch in a card head */
  function moduleToggle(key, onDone) {
    return h('div', { class: 'row gap-8' }, [
      h('span', { class: 'tiny dim nowrap', text: Store.isOn(key) ? 'Enabled' : 'Disabled' }),
      switchBox(Store.isOn(key), (v) => {
        Store.setOn(key, v);
        toast(`<b>${esc(DB.modByKey(key).name)}</b> ${v ? 'enabled' : 'disabled'}`, v ? 'ok' : 'info');
        onDone && onDone(v);
      }),
      /* 🧪 — config nahi, ASLI Discord par test (bhejta/panel banata hai) */
      h('button', {
        class: 'btn btn--sm btn--soft',
        title: 'Discord par asli test karo',
        onclick: async (e) => {
          const b = e.currentTarget;
          const old = b.textContent;
          b.disabled = true;
          b.textContent = '…';
          try {
            const r = await API.testModule(key);
            toast(esc(r.result || 'OK'), 'ok', 7000);
          } catch (err) {
            toast('Test fail: ' + esc(err.message), 'err', 7000);
          } finally {
            b.disabled = false;
            b.textContent = old;
          }
        },
      }, '\u{1F9EA} Test'),
    ]);
  }

  /** save button — toast tabhi "Saved" jab onSave sach me safal ho */
  function saveBtn(onSave) {
    return h('button', {
      class: 'btn btn--primary',
      onclick: (e) => {
        const b = e.currentTarget;
        const old = b.textContent;
        b.innerHTML = '<span class="spinner"></span> Saving…';
        Promise.resolve()
          .then(() => onSave())
          .then(() => {
            b.textContent = old;
            toast('<b>Saved!</b> Changes applied to the server.', 'ok');
          })
          .catch((err) => {
            b.textContent = old;
            toast(esc((err && err.message) || 'Save fail ho gaya'), 'err');
          });
      },
    }, '\u{1F4BE} Save changes');
  }

  /** pill */
  function pill(text, kind) {
    return h('span', { class: 'pill' + (kind ? ' pill--' + kind : '') }, [
      kind ? h('span', { class: 'pill__dot' }) : null,
      text,
    ]);
  }

  /** empty state */
  function empty(icon, title, desc, action) {
    return h('div', { class: 'empty' }, [
      h('div', { class: 'empty__ico', text: icon }),
      h('div', { class: 'empty__title', text: title }),
      desc ? h('div', { class: 'empty__desc', text: desc }) : null,
      action || null,
    ]);
  }

  /** alert — text me HTML (jaise <b>) render hota hai, literal tag nahi */
  function alert(kind, text, icon) {
    const icons = { info: '\u2139\uFE0F', ok: '\u2705', warn: '\u26A0\uFE0F', err: '\u274C' };
    return h('div', { class: 'alert alert--' + kind }, [
      h('span', { class: 'alert__ico', text: icon || icons[kind] }),
      h('div', { html: String(text) }),
    ]);
  }

  /** avatar circle */
  function avatar(name, color, size) {
    const ini = String(name || '?').replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || '?';
    return h('div', {
      class: 'avatar' + (size ? ' avatar--' + size : ''),
      style: { background: color || 'var(--surface-3)' },
      text: ini,
    });
  }

  /** chips input */
  function chips(values, onChange) {
    const list = h('div', { class: 'chips' });
    const input = h('input', { class: 'input', placeholder: 'Type and press Enter…', style: 'margin-top:8px' });

    function render() {
      list.innerHTML = '';
      values.forEach((v, i) => {
        list.appendChild(h('span', { class: 'chip' }, [
          v,
          h('span', {
            class: 'chip__x', text: '✕',
            onclick: () => { values.splice(i, 1); render(); onChange(values); },
          }),
        ]));
      });
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = input.value.trim();
        if (v && !values.includes(v)) { values.push(v); render(); onChange(values); }
        input.value = '';
      }
    });

    render();
    return h('div', {}, [list, input]);
  }

  /* =========================================================
     Discord embed preview
     ========================================================= */

  /* Custom emoji (Nitro wale bhi) -> asli <img>. Discord ka syntax:
     `<:naam:123>` (static) aur `<a:naam:123>` (animated). */
  function emojiNode(code) {
    const m = /^<a?:([\w-]+):(\d{5,})>$/.exec(code);
    if (!m) return document.createTextNode(code);
    const animated = code.slice(0, 3) === '<a:';   /* '<a:' = animated */
    return h('img', {
      class: 'emoji',
      src: 'https://cdn.discordapp.com/emojis/' + m[2] + (animated ? '.gif' : '.png') + '?size=48',
      alt: ':' + m[1] + ':',
      title: ':' + m[1] + ': (custom emoji)',
      onerror: function () { this.replaceWith(document.createTextNode(code)); },
    });
  }

  /* Ek line ka inline markdown: **bold** *italic* __u__ ~~s~~ `code`
     + custom emoji + @everyone/@here + links (Discord embed jaisa). */
  function inlineMd(text) {
    const out = [];
    const re = /\*\*([^*\n]+)\*\*|__([^_\n]+)__|~~([^~\n]+)~~|`([^`\n]+)`|\*([^*\n]+)\*|_([^_\n]+)_|<a?:[\w-]+:\d+>|@everyone|@here|https?:\/\/[^\s<>]+/g;
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) out.push(text.slice(last, m.index));
      const t = m[0];
      if (t.slice(0, 2) === '**') out.push(h('strong', {}, [m[1]]));
      else if (t.slice(0, 2) === '__') out.push(h('u', {}, [m[2]]));
      else if (t.slice(0, 2) === '~~') out.push(h('s', {}, [m[3]]));
      else if (t.charAt(0) === '`') out.push(h('code', {}, [m[4]]));
      else if (t.charAt(0) === '*') out.push(h('em', {}, [m[5]]));
      else if (t.charAt(0) === '_') out.push(h('em', {}, [m[6]]));
      else if (t.charAt(0) === '<') out.push(emojiNode(t));
      else if (t.charAt(0) === '@') out.push(h('span', { class: 'md-mention' }, [t]));
      else out.push(h('a', { href: t, target: '_blank', rel: 'noopener noreferrer' }, [t]));
      last = re.lastIndex;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }

  /* Poora text (multi-line) — line breaks waise hi rehte hain, headings
     (# ## ###) aur quotes (>) ko style dete hain. */
  function richBlock(text) {
    const out = [];
    const lines = String(text).split('\n');
    lines.forEach((line, i) => {
      const head = /^(#{1,3})[ \t]+(.*)$/.exec(line);
      if (head) out.push(h('span', { class: 'md-h md-h' + head[1].length }, inlineMd(head[2])));
      else if (line.slice(0, 1) === '>') out.push(h('span', { class: 'md-quote' }, inlineMd(line.replace(/^>\s?/, ''))));
      else out.push.apply(out, inlineMd(line));
      if (i < lines.length - 1) out.push('\n');
    });
    return out;
  }

  function embedPreview(emb) {
    const color = emb.color && emb.color !== 'none' ? emb.color : '#4f545c';
    const wrap = h('div', {
      class: 'embed' + (emb.thumbnail ? ' has-thumb' : ''),
      style: { borderLeftColor: color },
    });
    /* Colour wali line isi variable se rangti hai (Object.assign custom
       property set nahi kar pata — isliye setProperty alag se). Colour na
       diya ho to CSS fallback se brand purple rehta hai. */
    if (emb.color && emb.color !== 'none') {
      wrap.style.setProperty('--embed-color', color);
    }

    /* Thumbnail — Discord jaisa: TOP-RIGHT me chhota (absolute). */
    if (emb.thumbnail) {
      wrap.appendChild(h('img', {
        class: 'embed__thumb', src: emb.thumbnail, alt: 'thumbnail',
        onerror: function () {
          this.replaceWith(imgFail('thumbnail URL se image load nahi hui \u2014 seedhi image URL chahiye.'));
        },
      }));
    }

    const body = h('div', { class: 'embed__body' });
    wrap.appendChild(body);

    if (emb.author) {
      body.appendChild(h('div', { class: 'embed__author' }, [
        h('div', { class: 'embed__author-icon', style: { background: 'var(--brand)' } }),
        h('span', { class: 'embed__author-name' }, inlineMd(String(emb.author))),
      ]));
    }
    if (emb.title) body.appendChild(h('div', { class: 'embed__title' }, inlineMd(String(emb.title))));
    if (emb.desc) body.appendChild(h('div', { class: 'embed__desc' }, richBlock(String(emb.desc))));

    if (emb.fields && emb.fields.length) {
      const fw = h('div', { class: 'embed__fields' });
      const inline = emb.fields.filter(f => f.inline);
      const block = emb.fields.filter(f => !f.inline);
      inline.forEach(f => {
        fw.appendChild(h('div', {}, [
          h('div', { class: 'embed__field-name' }, inlineMd(String(f.name || ''))),
          h('div', { class: 'embed__field-val' }, richBlock(String(f.value || ''))),
        ]));
      });
      if (inline.length > 1) fw.style.gridTemplateColumns = `repeat(${Math.min(inline.length, 3)}, 1fr)`;
      block.forEach(f => {
        fw.appendChild(h('div', {}, [
          h('div', { class: 'embed__field-name' }, inlineMd(String(f.name || ''))),
          h('div', { class: 'embed__field-val' }, richBlock(String(f.value || ''))),
        ]));
      });
      body.appendChild(fw);
    }

    /* Bada image — Discord jaisa: NEECHE full-width (fields ke baad, footer se pehle). */
    if (emb.img) {
      body.appendChild(h('img', { class: 'embed__img', src: emb.img, alt: 'embed image',
        onerror: function () {
          this.replaceWith(imgFail('image load nahi hui \u2014 seedhi image URL (https://\u2026/pic.png) ya '
            + 'server ke message ka link chahiye. DM wala link kaam nahi karta.'));
        } }));
    }

    if (emb.footer) {
      body.appendChild(h('div', { class: 'embed__foot' }, [
        h('span', {}, inlineMd(String(emb.footer))),
      ]));
    }
    return wrap;
  }

  /** image fail hone par chup-chaap gayab hone ke bajaye saaf batao */
  function imgFail(msg) {
    return h('div', {
      class: 'hint',
      style: {
        padding: '8px 10px', border: '1px dashed var(--line-2)', borderRadius: '6px',
        background: 'rgba(231,76,60,.08)', color: '#e74c3c',
      },
    }, ['\u26A0\uFE0F ' + msg]);
  }

  /** Bot ka naam — user ne dashboard (Customization → Bot Identity) me set
      kiya ho to wo, warna backend se aaya asli Discord naam. Sirf preview. */
  function botName() {
    try {
      const custom = (window.Store && Store.merged)
        ? String((Store.merged('customization') || {}).botName || '').trim() : '';
      if (custom) return custom;
      const s = (window.API && API.state) ? API.state() : null;
      if (s && s.bot_name) return String(s.bot_name);
    } catch (e) { /* preview ke liye farak nahi padta */ }
    return 'VDEX COP';
  }

  /** fake Discord message with embed */
  function messageBox(author, timeStr, content, embedNode) {
    return h('div', { class: 'msg' }, [
      h('div', { class: 'avatar', style: { background: 'var(--brand)' }, text: String(author).slice(0, 2).toUpperCase() }),
      h('div', { class: 'msg__body' }, [
        h('div', { class: 'msg__head' }, [
          h('span', { class: 'msg__author', text: author }),
          h('span', { class: 'msg__bot', text: 'BOT' }),
          h('span', { class: 'msg__time', text: timeStr }),
        ]),
        content ? h('div', { class: 'msg__text', text: content }) : null,
        embedNode || null,
      ]),
    ]);
  }

  /* =========================================================
     Charts (pure SVG/CSS, no library)
     ========================================================= */
  function sparkline(values, opts = {}) {
    const w = opts.w || 640, hh = opts.h || 120, pad = 4;
    const max = Math.max(...values), min = Math.min(...values);
    const span = (max - min) || 1;
    const step = (w - pad * 2) / (values.length - 1 || 1);
    const pts = values.map((v, i) => [pad + i * step, hh - pad - ((v - min) / span) * (hh - pad * 2)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = line + ` L${(w - pad).toFixed(1)} ${hh - pad} L${pad} ${hh - pad} Z`;
    const gid = 'g' + Math.random().toString(36).slice(2, 8);

    const svg = `<svg viewBox="0 0 ${w} ${hh}" preserveAspectRatio="none" style="width:100%;height:${hh}px;display:block">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${opts.color || '#7c5cff'}" stop-opacity=".35"/>
        <stop offset="100%" stop-color="${opts.color || '#7c5cff'}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#${gid})"/>
      <path d="${line}" fill="none" stroke="${opts.color || '#7c5cff'}" stroke-width="2"
            stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    </svg>`;

    const box = h('div', { html: svg });
    if (opts.labels) {
      const lr = h('div', { class: 'row justify-b tiny dim', style: 'margin-top:6px' },
        [h('span', { text: opts.labels[0] }), h('span', { text: opts.labels[1] })]);
      return h('div', {}, [box, lr]);
    }
    return box;
  }

  function bars(items, opts = {}) {
    const max = Math.max(...items.map(i => i.value)) || 1;
    return h('div', { class: 'stack-sm' }, items.map(i =>
      h('div', {}, [
        h('div', { class: 'row justify-b', style: 'margin-bottom:5px' }, [
          h('span', { class: 'small', text: i.label }),
          h('span', { class: 'small dim', text: String(i.value) + (opts.suffix || '') }),
        ]),
        h('div', { class: 'meter' + (i.tone ? ' meter--' + i.tone : '') },
          h('div', { class: 'meter__fill', style: { width: Math.max(2, (i.value / max) * 100) + '%' } })),
      ])
    ));
  }

  function donut(segments, opts = {}) {
    const size = opts.size || 150;
    const thick = opts.thick || 16;
    const r = (size - thick) / 2;
    const c = 2 * Math.PI * r;
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;

    // har segment ka dash-offset accumulate hota hai
    let acc = 0;
    const inner = segments.map(s => {
      const frac = s.value / total;
      const seg = {
        dash: `${(frac * c).toFixed(2)} ${c.toFixed(2)}`,
        off: (-acc * c).toFixed(2),
        color: s.color,
      };
      acc += frac;
      return seg;
    });

    const svg = `<svg viewBox="0 0 ${size} ${size}" style="width:${size}px;height:${size}px">
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="${thick}"/>
      ${inner.map(s => `<circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${thick}" stroke-dasharray="${s.dash}" stroke-dashoffset="${s.off}" transform="rotate(-90 ${size/2} ${size/2})"/>`).join('')}
      ${opts.center ? `<text x="${size/2}" y="${size/2 + 2}" text-anchor="middle" fill="var(--text)" font-size="20" font-weight="700">${esc(opts.center)}</text>
      <text x="${size/2}" y="${size/2 + 20}" text-anchor="middle" fill="var(--text-3)" font-size="10.5">${esc(opts.centerSub || '')}</text>` : ''}
    </svg>`;

    return h('div', { html: `<div style="position:relative;width:${size}px;height:${size}px">${svg}</div>` });
  }

  /* =========================================================
     Misc
     ========================================================= */
  function copy(text, label = 'Copied to clipboard') {
    const done = () => toast(`<b>${esc(label)}</b>`, 'ok', 1800);
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallback());
    } else fallback();
    function fallback() {
      const ta = h('textarea', { style: 'position:fixed;opacity:0' });
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed', 'err'); }
      ta.remove();
    }
  }

  function ago(ts) {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return 'ended';
    const m = s / 60;
    if (m < 60) return Math.floor(m) + 'm left';
    const hh = m / 60;
    if (hh < 24) return Math.floor(hh) + 'h left';
    return Math.floor(hh / 24) + 'd left';
  }

  function timeLeft(ts) {
    const s = Math.max(0, (ts - Date.now()) / 1000);
    if (s <= 0) return 'Ended';
    const d = Math.floor(s / 86400);
    const hh = Math.floor((s % 86400) / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = Math.floor(s % 60);
    return (d ? d + 'd ' : '') + (d || hh ? String(hh % 24).padStart(2, '0') + ':' : '') +
           String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  }

  function relDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function table(cols, rows) {
    return h('div', { class: 'table-wrap' }, [
      h('div', { class: 'table-scroll' }, [
        h('table', { class: 'table' }, [
          h('thead', {}, h('tr', {}, cols.map(c => h('th', { text: c.label })))),
          h('tbody', {}, rows.length
            ? rows.map(r => h('tr', {}, cols.map(c => h('td', {}, c.render(r)))))
            : [h('tr', {}, h('td', { colspan: cols.length },
                h('div', { class: 'center dim', style: 'padding:22px', text: 'Nothing here yet.' })))])
        ])
      ])
    ]);
  }

  return {
    $, $$, h, append, esc,
    toast, modal, confirmDialog,
    pageHead, card, stat, toggleRow, switchBox, field, selectField,
    channelPicker, rolePicker, moduleToggle, saveBtn, pill, empty, alert,
    avatar, chips, embedPreview, messageBox, botName, sparkline, bars, donut,
    copy, ago, timeLeft, relDate, table,
  };
})();
