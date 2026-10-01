# VDEX COP — Discord Bot Dashboard

Discord bot ka poora control panel — **24 modules**, dark UI, live Discord embed preview,
per-module settings, aur analytics charts.

**Pure HTML / CSS / JS.** Koi build step nahi, koi npm nahi, koi framework nahi.
`index.html` double-click karo — bas.

---

## 🚀 Chalane ke tarike

### Sabse aasan — file kholo

```
index.html
```

Browser me open ho jayegi. (Kuch features `file://` pe limited ho sakte hain —
local server behtar hai, niche dekho.)

### Recommended — local server

```bat
python serve.py
```

Phir browser me kholo: **http://localhost:8900**

`serve.py` ek chhota static server hai jo `no-store` header bhejta hai, isliye
code edit karte hi page refresh karo aur naya result dikhega (browser cache nahi pakadta).

### Node ho to

```bat
npx serve .
```

---

## 🧭 Structure

```
vdex-dashboard/
├─ index.html            # app shell — sidebar, topbar, content, modal, toasts
├─ serve.py              # local dev server (no-cache)
├─ css/
│  ├─ base.css           # design tokens, reset, typography, animations
│  ├─ layout.css         # sidebar, topbar, grids, responsive
│  └─ components.css     # buttons, cards, toggles, tables, modals, embeds
└─ js/
   ├─ data.js            # ⭐ saara mock data (server, channels, roles, members, config)
   ├─ store.js           # localStorage persistence + module on/off state
   ├─ ui.js              # DOM helpers, toast, modal, charts, embed preview
   ├─ router.js          # hash router + sidebar + module search
   ├─ app.js             # bootstrap, keyboard shortcuts
   └─ pages/
      ├─ core.js         # Overview · Customization · Verification · Server Mgmt
      ├─ moderation.js   # Anti-Nuke · Automod · Scam · Audit Logging
      ├─ messaging.js    # Welcome · Farewell · Embed Builder · Sticky · Autoresponder · Join DM
      ├─ engagement.js   # Leveling · Counting · Reaction Roles · Custom Roles · Giveaways
      ├─ utility.js      # Invites · Tracking · Member Backup · Booster Perks
      └─ tickets.js      # Tickets config + live ticket list
```

---

## 📦 24 Modules

### Core
| Module | Kya karta hai |
|--------|---------------|
| **Overview** | Server stats, member growth graph, module grid, security status, recent activity |
| **Customization** | Server name/description/banner, system channels, splash, module master switches |
| **Verification** | Captcha/button/question gate, account-age rules, kick-on-fail, live preview |
| **Server Management** | Server profile, invite table, moderation snapshot, audit history, danger zone |

### Moderation
| Module | Kya karta hai |
|--------|---------------|
| **Anti-Nuke** | Per-action thresholds (channel/role/webhook/ban), punishment, recent blocks |
| **Automod** | Filter rules — keywords, regex, invites, caps, mass-mention, external links |
| **Scam Protection** | Phishing, fake nitro, impersonation, fake giveaway detection + quarantine |
| **Audit Logging** | Event toggles, ignored channels, filterable history, CSV export |

### Engagement
| Module | Kya karta hai |
|--------|---------------|
| **Welcome** | Card / embed / plain greet, DM, placeholders, live preview |
| **Farewell** | Goodbye messages, leave log, member count |
| **Leveling** | XP rates, cooldowns, role rewards, no-XP channels, leaderboard, XP curve |
| **Counting** | Live counter simulator, mistake log, top counters |
| **Reaction Roles** | Emoji groups, exclusive groups, max-roles limit, preview |
| **Custom Roles** | Button / select / reaction roles, single-select, colour |
| **Giveaways** | Active drops with countdown, edit/end, past winners |

### Messaging
| Module | Kya karta hai |
|--------|---------------|
| **Embed Builder** | Full embed editor + **live Discord preview** + JSON output + test render |
| **Sticky Messages** | Per-channel sticky messages with `{user}` mention |
| **Autoresponder** | Keyword/wildcard/regex triggers, rate limit, **live test box** |
| **Join DM** | Delayed DM to new members with retry, rules link, delivery stats |

### Tickets
| Module | Kya karta hai |
|--------|---------------|
| **Tickets** | Category config (label/prefix/colour), transcript toggle, panel preview, **live open-ticket table with claim/close** |

### Analytics
| Module | Kya karta hai |
|--------|---------------|
| **Invites** | Invite performance, conversion %, suspicious joins |
| **Tracking** | 30-day growth graph, active-hours bars, join-source donut, retention |
| **Member Backup** | Auto-backup settings, token validity, backup history, restore/download |
| **Booster Perks** | Perk toggles, booster list, boost stats, thank-you DM preview |

---

## ⌨️ Keyboard shortcuts

| Key | Action |
|-----|--------|
| `/` | Module search kholo |
| `g` → `o` | Overview pe jao |
| `?` | Shortcuts help |
| `Esc` | Modal band karo / input se niklo |

---

## 💾 Data kahan hai?

Sab kuch **mock data** hai — `js/data.js` me. Real backend nahi hai.

| Kya | Kahan |
|-----|-------|
| Default data (server, channels, roles, members, module config) | `js/data.js` |
| User ki changes (toggle values, form input, added rows) | Browser `localStorage` → key `vdex.dashboard.v1` |
| Server ke andar koi storage | ❌ kuch nahi |

### Changes reset karna hai?

- Browser console: `localStorage.removeItem('vdex.dashboard.v1')` → phir refresh
- Ya **Server Management → Danger Zone → Reset all settings**

---

## 🔌 Real backend jodna hai?

Sirf **3 files** badalni hain:

1. **`js/data.js`** — `DB.config` ki jagah API se aayi data rakho
   ```js
   const res = await fetch('/api/modules/automod', { credentials: 'include' });
   DB.config.automod = await res.json();
   ```
2. **`js/store.js`** — `localStorage` ki jagah `fetch(..., { method: 'POST' })`
3. **Auth** — Discord OAuth (button component) → `/api/auth/discord` → session cookie

`ui.js` aur `pages/*.js` bilkul nahi badlne padenge — sab components already
reusable hain. Yehi is architecture ka point hai.

---

## 🎨 Design system

Sab kuch CSS variables se control hota hai — `css/base.css` ke `:root` block me:

```css
--brand:  #7c5cff;   /* purple accent      */
--bg:     #0b0d13;   /* page background    */
--surface:#141824;   /* cards              */
--green:  #2ecc71;   /* success / ON       */
--red:    #ff4757;   /* danger  / OFF      */
--amber:  #ffa502;   /* warning            */
```

Brand colour badalna hai to sirf `--brand` change karo — poori site update ho jayegi.

---

## 🧩 Component library (`ui.js`)

Sab pages in helpers se bane hain — naya module banane me 5 minute lagenge:

| Helper | Kaam |
|--------|------|
| `UI.h(tag, attrs, children)` | Tiny DOM builder |
| `UI.card({title, sub, body, foot, actions})` | Card wrapper |
| `UI.stat(label, value, {icon, tone, sub})` | Stat tile |
| `UI.toggleRow(label, desc, checked, onChange)` | Label + switch row |
| `UI.field(...)` / `UI.selectField(...)` | Input, textarea (with char counter), select |
| `UI.channelPicker` / `UI.rolePicker` | Discord channel/role dropdowns |
| `UI.table(cols, rows)` | Data table with empty state |
| `UI.embedPreview(emb)` | **Discord embed ka exact preview** |
| `UI.messageBox(author, time, content, embed)` | Bot message + embed |
| `UI.sparkline` / `UI.bars` / `UI.donut` | Pure SVG charts (no library) |
| `UI.modal` / `UI.confirmDialog` | Dialogs |
| `UI.toast(msg, kind)` | Notifications |
| `UI.saveBtn(onSave)` | Save button with spinner + toast |

### Naya module add karna hai?

1. `js/data.js` me `modules` array me ek entry daalo (aur `config` me defaults)
2. `js/pages/<koi>.js` me `Pages.<key> = { render() { return UI.h('div', {class:'split'}, [left, right]); } }`
3. Bas — sidebar, search, routing sab automatic ho jayega

---

## 🧪 Testing

Browser console me:

```js
// saare modules render karo
DB.modules.forEach(m => { location.hash = '#/'+m.key; Router.render(); });

// kisi module ki config dekho
Store.merged('automod')

// sab kuch reset
localStorage.clear(); location.reload();
```

---

## ⚡ Browser support

Chrome / Edge / Firefox / Safari — sab latest versions. Pure CSS + vanilla JS,
koi polyfill nahi chahiye. Responsive hai (mobile pe sidebar slide hota hai).

---

## ❓ Troubleshooting

| Problem | Solution |
|---------|----------|
| Page kholte hi blank | `F12` → Console dekho. Agar `404` hai to `serve.py` use karo |
| Edit karo par change nahi dikhta | `serve.py` use karo (cache bust karta hai), ya `Ctrl+F5` dabao |
| Module ka page khaali | `js/pages/` me us module ka `Pages.<key>` defined hai ya nahi check karo |
| Settings save nahi ho rahe | Private/incognito window me localStorage band hota hai |
| Charts nahi dikh rahe | `ui.js` me `sparkline`/`bars`/`donut` load hui ya nahi console dekho |
