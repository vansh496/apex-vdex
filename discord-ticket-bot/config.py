"""
Configuration for the APEX Discord Ticket Bot.

Sirf `.env` me bot ka token daalna hai — baaki sab `/setup` command
automatically is file ke defaults se handle hota hai.
"""

from __future__ import annotations

import os
from pathlib import Path

# --------------------------------------------------------------------------
# Paths
# --------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
TRANSCRIPT_DIR = DATA_DIR / "transcripts"
STATE_FILE = DATA_DIR / "tickets.json"
LOG_FILE = DATA_DIR / "bot.log"
ENV_FILE = BASE_DIR / ".env"

for _folder in (DATA_DIR, TRANSCRIPT_DIR):
    _folder.mkdir(parents=True, exist_ok=True)


# --------------------------------------------------------------------------
# .env loader (no external dependency)
# --------------------------------------------------------------------------
def load_env() -> None:
    if not ENV_FILE.exists():
        return
    for raw in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(key, value)


load_env()


# --------------------------------------------------------------------------
# Bot credentials
# --------------------------------------------------------------------------
TOKEN: str = os.getenv("DISCORD_TOKEN", "").strip()
OWNER_ID: int = int(os.getenv("OWNER_ID", "0") or 0)


def _app_id_from_token(token: str) -> str:
    """Token ka pehla segment base64(app_id) hota hai — Discord ko chahiye
    **decimal** application id.  (OAuth `client_id` snowflake hona chahiye.)"""
    head = token.partition(".")[0]
    if not head:
        return ""
    try:
        import base64

        padded = head + "=" * (-len(head) % 4)
        return base64.urlsafe_b64decode(padded.encode()).decode("ascii", "ignore").strip()
    except Exception:  # noqa: BLE001
        return ""


# Discord OAuth ke liye DECIMAL application id.  Base64 daal doge to
# "client_id ... is not a snowflake" / "Invalid Form Body" aayega.
CLIENT_ID: str = os.getenv("CLIENT_ID", "").strip() or _app_id_from_token(TOKEN)
CLIENT_SECRET: str = os.getenv("CLIENT_SECRET", "").strip()

if CLIENT_ID and not CLIENT_ID.isdigit():
    print(
        f"⚠️  CLIENT_ID galat hai ({CLIENT_ID!r}) — decimal application id "
        f"chahiye (jaise 1546153129043562506). OAuth fail hoga."
    )

# Ek hi server me commands sync karo (1-2 min me) — khali = global sync (1 ghanta+)
_guild_env = os.getenv("GUILD_ID", "").strip()
GUILD_ID: int = int(_guild_env) if _guild_env.isdigit() else 0

# --------------------------------------------------------------------------
# Behaviour defaults  (guild me `/setup` inko override kar sakta hai)
# --------------------------------------------------------------------------
MAX_OPEN_TICKETS: int = int(os.getenv("MAX_OPEN_TICKETS", "3") or 3)
COUNTER_PAD: int = 4
MAX_TICKET_NAME_LEN: int = 100
CLOSE_CONFIRM_TIMEOUT: float = 60.0

DM_ON_OPEN: bool = True
DM_ON_CLOSE: bool = True
DM_ON_CLAIM: bool = True
SAVE_TRANSCRIPT: bool = True

LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO").upper()


def _flag(name: str, default: str) -> bool:
    """true/1/yes → True (case-insensitive)."""
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


# --------------------------------------------------------------------------
# Privileged intents — Developer Portal me manually enable karne padte hain
#   Developer Portal > Bot > Privileged Gateway Intents
#
#   MESSAGE CONTENT : transcripts ke liye ZAROORI hai. Agar off rahega to
#                     transcript me message ka text khali aayega.
#                     Discord yeh consent/user agreement leke deta hai.
#
#   SERVER MEMBERS  : is bot ko zaroorat NAHI hai — bot interaction payload
#                     se hi roles le leta hai. Off rakhne se ek chhota hurdle kam.
# --------------------------------------------------------------------------
INTENT_MEMBERS: bool = _flag("INTENT_MEMBERS", "false")
INTENT_MESSAGE_CONTENT: bool = _flag("INTENT_MESSAGE_CONTENT", "true")

# --------------------------------------------------------------------------
# Web dashboard (Discord OAuth + REST API) — bot ke saath hi chalta hai
# --------------------------------------------------------------------------
WEB_ENABLED: bool = _flag("WEB_ENABLED", "true")
WEB_PORT: int = int(os.getenv("WEB_PORT") or os.getenv("PORT") or "8900" or 8900)  # Render PORT
BASE_URL: str = os.getenv("BASE_URL", f"http://localhost:{WEB_PORT}").rstrip("/")

# Redirect URI — Developer Portal > OAuth2 > Redirects me EXACT same likhna hoga
OAUTH_REDIRECT: str = os.getenv("OAUTH_REDIRECT", f"{BASE_URL}/auth/callback")

# Dashboard folder (sibling directory)
_dashboard_env = os.getenv("DASHBOARD_DIR", "").strip()
DASHBOARD_DIR: Path = Path(_dashboard_env) if _dashboard_env else BASE_DIR.parent / "vdex-dashboard"

# Optional: connect page par ek key maango (khali = koi key nahi).
# Agar aap dashboard LAN/Internet par share kar rahe ho to ye zaroor set karo.
DASHBOARD_KEY: str = os.getenv("DASHBOARD_KEY", "").strip()

# --------------------------------------------------------------------------
# Ticket types — `/setup` inke liye categories banata hai
#   key        : internal id (channel prefix + storage key)
#   label      : button / embed ka naam
#   emoji      : button emoji
#   short      : channel name prefix
#   color      : embed accent color
#   category   : Discord category ka naam
#   subject_*  : modal ka pehla field
#   details_*  : modal ka doosra field
# --------------------------------------------------------------------------
TICKET_TYPES: dict[str, dict] = {
    "support": {
        "label": "General Support",
        "emoji": "\U0001F527",
        "short": "support",
        "color": 0x3498DB,
        "category": "Tickets \N{BULLET} Support",
        "description": "Koi bhi sawaal, problem ya help request.",
        "subject_label": "Subject",
        "subject_placeholder": "Short me batao kya problem hai",
        "details_label": "Details",
        "details_placeholder": "Poori detail likho — jaise error message, kya karne ki koshish ki, etc.",
    },
    "report": {
        "label": "Report User",
        "emoji": "\U0001F6A8",
        "short": "report",
        "color": 0xE74C3C,
        "category": "Tickets \N{BULLET} Reports",
        "description": "Kisi user ka report — proof / screenshot ke saath.",
        "subject_label": "Kis user ka report?",
        "subject_placeholder": "username ya user ID",
        "details_label": "Kya hua?",
        "details_placeholder": "Kya kiya usne, kab hua, aur koi proof ka link/screenshot ID",
    },
    "purchase": {
        "label": "Purchase / Billing",
        "emoji": "\U0001F4B3",
        "short": "buy",
        "color": 0x2ECC71,
        "category": "Tickets \N{BULLET} Purchases",
        "description": "Product kharidna, price, payment ya invoice ke baare me.",
        "subject_label": "Kya kharidna hai?",
        "subject_placeholder": "Product / plan ka naam",
        "details_label": "Order details",
        "details_placeholder": "Plan, payment method (UPI / Crypto), aur koi specific sawaal",
    },
    "other": {
        "label": "Other",
        "emoji": "\U0001F4AC",
        "short": "other",
        "color": 0x9B59B6,
        "category": "Tickets \N{BULLET} Other",
        "description": "Kuch aur — partnership, feedback, ya jo fit na ho.",
        "subject_label": "Subject",
        "subject_placeholder": "Topic",
        "details_label": "Details",
        "details_placeholder": "Apni baat poore detail me likho",
    },
}

# --------------------------------------------------------------------------
# Permission presets
# --------------------------------------------------------------------------
STAFF_PERMISSION_FIELDS = dict(
    view_channel=True,
    send_messages=True,
    read_message_history=True,
    manage_channels=True,
    manage_messages=True,
    manage_roles=True,
    move_members=True,
    attach_files=True,
    embed_links=True,
    create_public_threads=True,
    create_private_threads=True,
)

USER_PERMISSION_FIELDS = dict(
    view_channel=True,
    send_messages=True,
    read_message_history=True,
    attach_files=True,
    embed_links=True,
    add_reactions=True,
    use_external_emojis=True,
)
