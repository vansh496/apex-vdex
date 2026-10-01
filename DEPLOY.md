# Render Deploy — bot + dashboard online (3 step)

> Sab kuch **ek hi service** me chalega: `https://<app>.onrender.com` par
> dashboard bhi aur bot bhi (Discord gateway se).

---

## Step 1 — GitHub repo (ek baar)

1. <https://github.com/new> → naam (private rakho) → **Create repository**
2. Repo page par **uploading an existing file** kholo, aur is folder
   (`Desktop\New folder (3)`) se **sirf ye4 drag karo**:
   - `discord-ticket-bot/`
   - `vdex-dashboard/`
   - `render.yaml`
   - `.gitignore`
   - (`DEPLOY.md` optional)
3. **`apex-auth/` aur `New folder (10)/` MAT bharna.** Commit message → `Commit changes`.

## Step 2 — Render Blueprint (ek baar)

1. <https://render.com> → Sign up (GitHub se) → **New +** → **Blueprint**
2. Repo select → `render.yaml` khud pick ho jayega → **Apply**
3. Deploy shuru — pehla deploy `DASHBOARD_KEY` khud generate karega.
4. **Service → Environment** me ye bharo, phir **Manual Deploy → Clear build cache & deploy**:
   | Key | Value |
   |---|---|
   | `DISCORD_TOKEN` | Developer Portal → Bot → Token |
   | `BASE_URL` | `https://<app>.onrender.com` (deploy ke baad mila URL) |
   | `CLIENT_ID` / `CLIENT_SECRET` | Developer Portal → OAuth2 (login ke liye) |

## Step 3 — Discord + connect (ek baar)

1. Developer Portal → **OAuth2 → Redirects** me ADD + Save:
   `https://<app>.onrender.com/auth/callback`
2. Browser me kholo: `https://<app>.onrender.com` → connect page par
   **Guild ID** + **Dashboard key** (Render → Environment → `DASHBOARD_KEY`)
3. Ab wahi purana dashboard — Ticket Setup → Re-run Setup → Re-send Panel. Done ✅

---

## ⚠️ Note (zaroor padho)

- **Free plan:**15 min koi traffic na aaye to service **so jayegi** (bot offline).
  Fix: <https://uptimerobot.com> free me har5 min ping karo →
  `https://<app>.onrender.com/api/health` → bot hamesha awake.
- **Data:** har git push = redeploy → `data/` wapas **repo wale commit** par aa jayega.
 (push se pehle `discord-ticket-bot/data/tickets.json` commit kar do, warna config reset)
- `DASHBOARD_KEY` bina connect page par key field khud dikh jata hai — wahi key daalna.
