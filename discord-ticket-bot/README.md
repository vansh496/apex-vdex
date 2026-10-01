# APEX — Discord Ticket Bot

Discord ke liye complete **ticket system** — button se ticket banao, staff claim kare,
close karne par poora chat transcript HTML file me save ho jaaye.

Python 3.10+ · `discord.py` · SQLite nahi (plain JSON storage).

---

## ⚡ Quick start (Windows)

```bat
start.bat
```

`start.bat` khud Python check karega, `discord.py` install karega aur bot chala dega.

### Manual

```bat
pip install -r requirements.txt
copy .env.example .env      :: Windows
python bot.py
```

### `.env` me ye daalo

```ini
DISCORD_TOKEN=apka-bot-token
```

> **Token kahan se:** Discord **Developer Portal** → apna application → **Bot** →
> **Reset Token** → copy. Link: https://discord.com/developers/applications

---

## 🚀 Server me set up (ek baar)

Bot online hone ke baad apne Discord server me:

```
/setup   staff_role:@Support
```

Ye automatically bana deta hai:

| Kya | Kahan |
|-----|-------|
| Ticket categories | `Tickets • Support`, `• Reports`, `• Purchases`, `• Other` |
| `#create-ticket` | panel channel (buttons + dropdown) |
| `#ticket-logs` | har open/close ka record (private) |

Phir `#create-ticket` me jaakar ticket open karo. 🎉

---

## 🎫 Ticket types

| Button | Channel | Form fields |
|--------|---------|-------------|
| 🛠 General Support | `support-0001` | Subject + Details |
| 🚨 Report User | `report-0001` | Kis user + Kya hua (proof) |
| 💳 Purchase / Billing | `buy-0001` | Kya kharidna + Order details |
| 💬 Other | `other-0001` | Subject + Details |

Config: `config.py` → `TICKET_TYPES` (label, emoji, color, category, form prompts).

---

## 🛠 Features

| Feature | Kaise |
|---------|-------|
| **Button + dropdown** se ticket | Panel me button dabao → modal form bharo → channel ready |
| **Private channel** | Sirf opener + staff dekh sakte hain (auto permission overwrite) |
| **Claim / Unclaim** | Staff button dabaye — topic me naam chala jaata hai |
| **Close + Transcript** | Close → confirm → poora chat HTML file me save → channel delete |
| **Add User** | Staff modal se kisi ko ticket me add karo |
| **Ticket limit** | Per-user max open tickets (default 3), `/setup` se change |
| **Auto counter** | Har type ka alag counter: `support-0001`, `report-0002`… |
| **Log channel** | `#ticket-logs` me har open/close/claim ka entry |
| **DM notify** | Ticket bante hi, claim hone par, aur close hone par user ko DM |
| **Crash-safe** | State `data/tickets.json` me atomic write — restart ke baad bhi tickets safe |

---

## 🛠 Commands

| Command | Kya karta hai |
|---------|---------------|
| `/setup` | Poora system setup (categories, panel, logs) |
| `/panel` | Panel message dobara bhejo |
| `/tickets` | Abhi ke open tickets ki list (staff) |
| `/claim` / `/unclaim` | Ticket claim / release karo |
| `/close` | Ticket close + transcript |
| `/new type:…` | Bina button ke ticket kholo |
| `/addstaff` / `/removestaff` | Multiple staff roles manage karo |
| `/stats` | Open / closed / unclaimed counts |

---

## 🗂 Structure

```
discord-ticket-bot/
├─ bot.py             # main — views, modals, commands, ticket flow
├─ config.py          # token, ticket types, permissions, defaults
├─ storage.py         # JSON persistence (thread-safe, atomic)
├─ transcripts.py     # HTML transcript generator
├─ requirements.txt
├─ .env.example
├─ start.bat          # one-click launcher
└─ data/              # auto-create
   ├─ tickets.json    # state
   ├─ bot.log         # logs
   └─ transcripts/    # <guild_id>/<type>-<number>-<time>.html
```

---

## ❓ Troubleshooting

| Problem | Solution |
|---------|----------|
| `Bot token missing!` | `.env` banao, `DISCORD_TOKEN=...` paste karo |
| `LoginFailure` | Token galat — Developer Portal se naya copy karo |
| `/setup` nahi dikha | Bot ko **Use Application Commands** permission do, `/panel` bhejo |
| Button kaam nahi kar raha | Bot ke paas `Manage Channels` + `Manage Roles` chahiye |
| Transcript nahi bana | Bot ke paas transcript channel me **Attach Files** chahiye |
| Commands 1-2 ghante me aaye | Global sync slow hota hai — `.env` me `GUILD_ID=<apna server id>` daalo |

---

## 🔐 Bot permissions (invite)

`Manage Channels` · `Manage Roles` · `Manage Messages` · `Read Message History` ·
`Send Messages` · `Embed Links` · `Attach Files` · `Use Application Commands`

> Bot ko apne se upar rakho — tab puri server me top position milegi.
