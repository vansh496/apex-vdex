"""
Web dashboard server — bot ke saath ek process me chalta hai.

    Discord OAuth login  →  sirf server staff
    REST API             →  saare 24 modules + live tickets
    Static files         →  vdex-dashboard/ folder

Ye sirf HTTP layer hai. Business logic `bot.py` me hai; web.py usse
callbacks ke through baat karta hai (taaki circular import na ho).
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import secrets
import time
import urllib.parse
from typing import Any

import aiohttp
from aiohttp import web

import discord

import config
from storage import store

log = logging.getLogger("web")

# Discord permission bits
_ADMIN = 0x8
_MANAGE_CHANNELS = 0x10
_MANAGE_GUILD = 0x20
_CAN_MANAGE = _ADMIN | _MANAGE_CHANNELS | _MANAGE_GUILD

SESSION_TTL = 60 * 60 * 24 * 7  # 7 din

_sessions: dict[str, dict[str, Any]] = {}
_member_cache: dict[str, tuple[float, list[dict]]] = {}
_counts_cache: dict[str, tuple[float, dict[str, int]]] = {}

_rest_headers = {"User-Agent": "ApexTicketBot/1.0 (dashboard)"}

# bot ke end se aane wale callbacks (bot.py set karta hai)
_callbacks: dict[str, Any] = {}

MESSAGES: dict[str, str] = {
    "not_logged_in": "Login required — /auth/login par jaao.",
    "no_guild": "Server id dijiye (query `?guild=<id>` ya JSON body me).",
    "forbidden": "Aapke paas is server par manage permission nahi hai.",
    "bot_not_in": "Ye bot is server me nahi hai.",
}


# ==========================================================================
# Helpers
# ==========================================================================
def _json_response(payload: Any, status: int = 200) -> web.Response:
    return web.json_response(payload, status=status)


def _err(message: str, status: int) -> web.Response:
    return web.json_response({"error": message}, status=status)


def _session(request: web.Request) -> dict[str, Any] | None:
    sid = request.cookies.get("sid")
    sess = _sessions.get(sid) if sid else None
    if not sess:
        return None
    if time.time() - sess.get("at", 0) > SESSION_TTL:
        _sessions.pop(sid, None)
        return None
    return sess


def _can_manage(guild_obj: dict[str, Any]) -> bool:
    if guild_obj.get("owner"):
        return True
    try:
        perms = int(guild_obj.get("permissions") or 0)
    except (TypeError, ValueError):
        return False
    return bool(perms & _CAN_MANAGE)


def _require_guild(request: web.Request, *, body: dict | None = None) -> tuple[dict, Any]:
    """Session + permission + bot-in-guild check.  (session, discord.Guild)"""
    sess = _session(request)
    if not sess:
        raise web.HTTPUnauthorized(text=MESSAGES["not_logged_in"])

    if body is None:
        body = {}
    gid = str(
        body.get("guild")
        or request.query.get("guild")
        or request.match_info.get("guild")
        or ""
    )
    if not gid:
        raise web.HTTPBadRequest(text=MESSAGES["no_guild"])

    g = next((x for x in sess["guilds"] if str(x["id"]) == gid), None)
    if g is None or not _can_manage(g):
        raise web.HTTPForbidden(text=MESSAGES["forbidden"])

    bot = request.app["bot"]
    guild = bot.get_guild(int(gid))
    if guild is None:
        raise web.HTTPNotFound(text=MESSAGES["bot_not_in"])
    return sess, guild


# ==========================================================================
# Auth
# ==========================================================================
async def auth_login(request: web.Request) -> web.Response:
    if not config.CLIENT_SECRET:
        return _err(
            "CLIENT_SECRET set nahi hai — .env me CLIENT_ID aur CLIENT_SECRET daalo.",
            500,
        )

    # CSRF guard: state ko cookie me rakho, callback par match karo.
    # NOTE: `permissions` sirf `scope=bot` ke saath bhejna chahiye —
    # identify/guilds scope ke saath bhejne par Discord
    # "Invalid Form Body" (error 50035) deta hai.
    state = secrets.token_urlsafe(24)
    params = {
        "client_id": config.CLIENT_ID,
        "response_type": "code",
        "scope": "identify guilds",
        "redirect_uri": config.OAUTH_REDIRECT,
        "state": state,
    }
    resp = web.Response(status=302)
    resp.headers["Location"] = (
        "https://discord.com/oauth2/authorize?" + urllib.parse.urlencode(params)
    )
    resp.set_cookie("oauth_state", state, httponly=True, samesite="Lax", max_age=600)
    return resp


async def auth_callback(request: web.Request) -> web.Response:
    code = request.query.get("code")
    err = request.query.get("error")
    if err:
        return _err(f"Discord ne mana kar diya: {err}", 400)
    if not code:
        return _err("code nahi mila", 400)

    # state verify (CSRF)
    got = request.query.get("state") or ""
    want = request.cookies.get("oauth_state") or ""
    if not want or got != want:
        return _err("State mismatch — link purana/invalid hai, dobara login karo.", 400)

    data = {
        "client_id": config.CLIENT_ID,
        "client_secret": config.CLIENT_SECRET,
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": config.OAUTH_REDIRECT,
    }

    async with aiohttp.ClientSession(headers=_rest_headers) as s:
        async with s.post(
            "https://discord.com/api/oauth2/token",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        ) as resp:
            if resp.status != 200:
                text = await resp.text()
                log.error("token exchange %s: %s", resp.status, text)
                return _err(
                    "Token exchange fail — CLIENT_ID/CLIENT_SECRET/Redirect URI check karo.",
                    500,
                )
            tok = await resp.json()

        headers = {"Authorization": f"Bearer {tok['access_token']}"}
        async with s.get("https://discord.com/api/users/@me", headers=headers) as r:
            me = await r.json()
        async with s.get(
            "https://discord.com/api/users/@me/guilds", headers=headers
        ) as r:
            guilds = await r.json()

    sid = secrets.token_urlsafe(32)
    _sessions[sid] = {"user": me, "guilds": guilds, "at": time.time()}
    log.info("dashboard login: %s (%s)", me.get("username"), me.get("id"))

    resp = web.Response(status=302, headers={"Location": "/"})
    resp.set_cookie("sid", sid, httponly=True, samesite="Lax", max_age=SESSION_TTL)
    resp.del_cookie("oauth_state")
    return resp


async def auth_logout(request: web.Request) -> web.Response:
    sid = request.cookies.get("sid")
    if sid:
        _sessions.pop(sid, None)
    resp = _json_response({"ok": True})
    resp.del_cookie("sid")
    return resp


# ==========================================================================
# Link-based connect  (Discord OAuth ki jagah — ek line me server jodo)
# ==========================================================================
INVITE_RE = re.compile(
    r"(?:https?://)?(?:www\.)?discord(?:app)?\.com/(?:invite|j)/([A-Za-z0-9-]+)"
    r"|(?:https?://)?discord\.gg/([A-Za-z0-9-]+)",
    re.IGNORECASE,
)
CODE_RE = re.compile(r"^[A-Za-z0-9-]{2,40}$")


def _bot_guilds(bot: Any) -> list[dict[str, Any]]:
    """Bot ke saare servers — session ka `guilds` ise hi use karta hai."""
    out: list[dict[str, Any]] = []
    for g in bot.guilds:
        out.append(
            {
                "id": str(g.id),
                "name": g.name,
                "icon": (g.icon.key if g.icon else None),
                "owner": True,          # link-flow me koi user-identity nahi hai
                "permissions": str(_ADMIN),  # _can_manage() chalu rahe
                "member_count": g.member_count,
            }
        )
    out.sort(key=lambda x: (x["name"] or "").lower())
    return out


async def _resolve_invite(text: str) -> str | None:
    """Invite link / invite code / seedha server ID  →  guild id."""
    t = (text or "").strip()
    if not t:
        return None
    if t.isdigit():
        return t
    m = INVITE_RE.search(t)
    if m:
        code = m.group(1) or m.group(2)
    elif CODE_RE.match(t):
        code = t
    else:
        return None
    try:
        async with aiohttp.ClientSession(headers=_rest_headers) as s:
            async with s.get(f"https://discord.com/api/invites/{code}") as r:
                if r.status != 200:
                    return None
                data = await r.json()
    except (aiohttp.ClientError, OSError) as exc:
        log.warning("invite resolve fail: %s", exc)
        return None
    gid = str(((data.get("guild") or {}).get("id")) or "")
    return gid or None


def _bot_invite_url(bot: Any) -> str:
    perms = 380927077456  # ticket bot ke liye saare permissions
    return (
        "https://discord.com/oauth2/authorize?client_id="
        f"{bot.user.id if bot.user else config.CLIENT_ID}"
        f"&scope=bot+applications.commands&permissions={perms}"
    )


async def auth_connect(request: web.Request) -> web.Response:
    body = await request.json()
    if config.DASHBOARD_KEY:
        if str(body.get("key") or "") != config.DASHBOARD_KEY:
            return _err("Galat DASHBOARD_KEY", 403)

    bot = request.app["bot"]
    raw = str(body.get("input") or "")
    gid = await _resolve_invite(raw)
    if not gid:
        return _err(
            "Invite link / server ID samajh nahi aaya. "
            "Jaise: https://discord.gg/abc123  ya  1554407195037401200",
            400,
        )

    guild = bot.get_guild(int(gid))
    if guild is None:
        return _err(
            "Ye bot us server me nahi hai — pehle invite karo: " + _bot_invite_url(bot),
            404,
        )

    guilds = _bot_guilds(bot)
    # selected server list me sabse upar, taaki dashboard wahi dikhaaye
    guilds.sort(key=lambda x: 0 if x["id"] == str(gid) else 1)

    sid = secrets.token_urlsafe(32)
    _sessions[sid] = {
        "user": {"id": "local", "username": "Local Admin", "avatar": None},
        "guilds": guilds,
        "at": time.time(),
    }
    log.info("dashboard connected: %s (%s)", guild.name, gid)

    resp = _json_response({"ok": True, "guild": {"id": gid, "name": guild.name}})
    resp.set_cookie("sid", sid, httponly=True, samesite="Lax", max_age=SESSION_TTL)
    return resp


async def api_bot_guilds(request: web.Request) -> web.Response:
    """Connect page ko dikhane ke liye — bot kis-kis server me hai."""
    bot = request.app["bot"]
    items = [
        {
            "id": g["id"],
            "name": g["name"],
            "icon": g["icon"],
            "members": g["member_count"],
        }
        for g in _bot_guilds(bot)
    ]
    return _json_response(
        {
            "guilds": items,
            "invite": _bot_invite_url(bot),
            "key_required": bool(config.DASHBOARD_KEY),
            "oauth": {
                "configured": bool(config.CLIENT_SECRET),
                "client_id": config.CLIENT_ID,
                "redirect": config.OAUTH_REDIRECT,
                "login": "/auth/login",
            },
        }
    )


async def api_me(request: web.Request) -> web.Response:
    sess = _session(request)
    if not sess:
        return _json_response({"logged_in": False, "user": None, "guilds": []})
    bot = request.app["bot"]
    manageable = []
    for g in sess["guilds"]:
        if not _can_manage(g):
            continue
        if bot.get_guild(int(g["id"])) is None:
            continue
        gg = bot.get_guild(int(g["id"]))
        manageable.append(
            {
                "id": str(g["id"]),
                "name": g["name"],
                "icon": g.get("icon"),
                "owner": bool(g.get("owner")),
                "bot_in": True,
                "member_count": gg.member_count,
            }
        )
    return _json_response(
        {
            "logged_in": True,
            "user": {
                "id": sess["user"].get("id"),
                "username": sess["user"].get("username"),
                "discriminator": sess["user"].get("discriminator"),
                "avatar": sess["user"].get("avatar"),
            },
            "guilds": manageable,
        }
    )


# ==========================================================================
# Real server data
# ==========================================================================
async def _guild_members(guild) -> list[dict]:
    """Members — raw REST se (guild.fetch_members members intent maangta hai,
    isliye seedha `GET /guilds/{id}/members` use karte hain). 5 min cache."""
    key = str(guild.id)
    cached = _member_cache.get(key)
    if cached and time.time() - cached[0] < 300:
        return cached[1]

    role_map = {str(r.id): r for r in guild.roles}
    items: list[dict] = []
    try:
        payload = await guild._state.http.get_members(guild.id, 1000, None)
    except Exception as exc:  # noqa: BLE001
        log.warning("get_members(%s) failed: %s", guild.id, exc)
        payload = []

    for m in payload or []:
        user = m.get("user") or {}
        uid = user.get("id")
        if not uid:
            continue
        held = [role_map.get(str(r)) for r in (m.get("roles") or [])]
        held = [r for r in held if r is not None]
        top = max(held, key=lambda r: r.position) if held else None

        username = user.get("username") or "unknown"
        disc = str(user.get("discriminator") or "0")
        tag = username if disc in ("0", "") else f"{username}#{disc}"

        items.append(
            {
                "id": str(uid),
                "tag": tag,
                "name": username,
                "display": m.get("nick") or user.get("global_name") or username,
                "color": (str(top.color) if top and top.color.value else "#99a1b3"),
                "role": (top.name if top else "@everyone"),
                "roleId": str(top.id) if top else "",
                "joined": (m.get("joined_at") or "")[:10],
                "boosting": bool(m.get("premium_since")),
                "bot": bool(user.get("bot")),
                # presence intent ke bina status nahi milta → api.js backfill karta hai
                "avatar": user.get("avatar") or "",
            }
        )

    items.sort(key=lambda x: x["joined"], reverse=True)
    _member_cache[key] = (time.time(), items)
    return items


async def _guild_counts(guild) -> dict[str, int]:
    """`with_counts` se exact presence/member numbers (60s cache)."""
    key = str(guild.id)
    cached = _counts_cache.get(key)
    if cached and time.time() - cached[0] < 60:
        return cached[1]
    out = {
        "online": 0,
        "member_count": int(guild.member_count or 0),
    }
    try:
        data = await guild._state.http.get_guild(guild.id, with_counts=True)
        out["online"] = int(data.get("approximate_presence_count") or 0)
        out["member_count"] = int(
            data.get("approximate_member_count") or guild.member_count or 0
        )
    except Exception as exc:  # noqa: BLE001
        log.debug("get_guild(with_counts) failed for %s: %s", guild.id, exc)
    _counts_cache[key] = (time.time(), out)
    return out


def _build_server(
    guild,
    counts: dict[str, int] | None = None,
    owner: str = "",
    latency_ms: int = 0,
) -> dict[str, Any]:
    counts = counts or {}
    icon = guild.icon.key if guild.icon else None
    if not owner:
        owner = str(guild.owner) if guild.owner else ""
    if not owner and guild.owner_id:
        owner = str(guild.owner_id)
    return {
        "id": str(guild.id),
        "name": guild.name,
        "icon": (guild.name or "?")[:1].upper(),
        "iconUrl": (f"https://cdn.discordapp.com/icons/{guild.id}/{icon}.png?size=64" if icon else ""),
        "ownerId": str(guild.owner_id),
        "owner": owner or "Unknown",
        "createdAt": guild.created_at.isoformat()[:10],
        "boostTier": guild.premium_tier,
        "boostCount": guild.premium_subscription_count or 0,
        "region": str(getattr(guild, "region", "") or "Automatic"),
        "verifyLevel": str(guild.verification_level),
        "locale": str(guild.preferred_locale),
        "memberCount": int(counts.get("member_count") or guild.member_count or 0),
        "online": int(counts.get("online") or 0),
        "channels": len(guild.channels),
        # dashboard `s.members` padhta hai (Overview ke stat card ke liye)
        "members": int(counts.get("member_count") or guild.member_count or 0),
        "roles": len(guild.roles),
        "emojis": len(guild.emojis),
        "webhooks": 0,
        "banned": 0,
        "mutes": 0,
        "warns": 0,
        "invite": "",
        "supportServer": "",
        "uptime": "—",
        "latency": int(latency_ms),
    }


def _build_channels(guild) -> tuple[list[dict], list[str]]:
    import discord as _d

    out: list[dict] = []
    cats: list[str] = []
    for c in guild.channels:
        if isinstance(c, _d.CategoryChannel):
            ctype = "category"
        elif isinstance(c, _d.VoiceChannel) or isinstance(c, _d.StageChannel):
            ctype = "voice"
        elif isinstance(c, _d.TextChannel):
            ctype = "news" if c.is_news() else "text"
        else:
            ctype = "text"
        cat = c.category.name if c.category else "Text Channels"
        if cat not in cats:
            cats.append(cat)
        out.append({"id": str(c.id), "name": c.name, "type": ctype, "cat": cat, "members": 0})
    return out, cats


def _build_roles(guild) -> list[dict]:
    import discord as _d

    out = []
    for r in reversed(guild.roles):
        if r.is_default():
            continue
        out.append(
            {
                "id": str(r.id),
                "name": r.name,
                "color": str(r.color) if r.color.value else "#99a1b3",
                "hoisted": bool(r.hoist),
                "mentionable": bool(r.mentionable),
                "staff": False,
                "members": 0,
                "position": r.position,
            }
        )
    return out


# ==========================================================================
# API — state
# ==========================================================================
async def api_state(request: web.Request) -> web.Response:
    sess, guild = _require_guild(request)
    bot = request.app["bot"]

    counts, members = await asyncio.gather(
        _guild_counts(guild), _guild_members(guild)
    )
    channels, categories = _build_channels(guild)
    roles = _build_roles(guild)

    # owner ka tag (guild.member cache me nahi hota) — chhoti si REST call
    owner_tag = ""
    if guild.owner_id:
        owner = guild.get_member(guild.owner_id)
        if owner is None:
            try:
                owner = await guild.fetch_member(guild.owner_id)
            except discord.HTTPException:
                owner = None
        owner_tag = str(owner) if owner else str(guild.owner_id)

    latency = int((getattr(bot, "latency", 0) or 0) * 1000)

    tickets = [
        dict(t, channel_id=str(t.get("channel_id")))
        for t in store.open_tickets(guild.id)
    ]

    gcfg = store.guild_config(guild.id)
    staff_ids = set(str(x) for x in (gcfg.get("staff_role_ids") or []))
    for r in roles:
        if r["id"] in staff_ids:
            r["staff"] = True

    snapshot = store.module_snapshot(guild.id)

    return _json_response(
        {
            "me": {
                "id": sess["user"].get("id"),
                "username": sess["user"].get("username"),
                "avatar": sess["user"].get("avatar"),
            },
            # bot ka asli naam — previews me fallback ke liye
            "bot_name": getattr(bot.user, "display_name", None) or str(bot.user or ""),
            "server": _build_server(guild, counts, owner_tag, latency),
            "channels": channels,
            "categories": categories,
            "roles": roles,
            "members": members,
            "tickets": tickets,
            "stats": store.stats(guild.id),
            "modules": snapshot,
            "setup": {
                "panel_channel_id": gcfg.get("panel_channel_id"),
                "log_channel_id": gcfg.get("log_channel_id"),
                "categories": gcfg.get("categories") or {},
                "max_open_tickets": gcfg.get("max_open_tickets") or config.MAX_OPEN_TICKETS,
                "staff_role_ids": gcfg.get("staff_role_ids") or [],
                "support_role_id": gcfg.get("support_role_id"),
                "is_setup": store.is_setup(guild.id),
            },
            "antinuke": _antinuke_payload(guild),
        }
    )


def _antinuke_payload(guild: Any) -> dict[str, Any]:
    """Instances + security incidents + lockdown state (dashboard ka right side)."""
    import features

    return {
        "instances": features.antinuke_instances(guild.id),
        "incidents": store.kv_get(f"nklog:{guild.id}") or [],
        "lockdown": store.kv_get(f"lockdown:{guild.id}") or {"on": False},
    }


# ==========================================================================
# API — Anti-Nuke instances (spec: har instance ka apna DB record)
# ==========================================================================
async def api_antinuke_instances(request: web.Request) -> web.Response:
    """Instance list save/create/update/delete — poora list ek saath aata hai."""
    body = await request.json()
    sess, guild = _require_guild(request, body=body)
    import features

    action = str(body.get("action") or "save")
    if action == "list":
        return _json_response({"instances": features.antinuke_instances(guild.id)})

    instances = body.get("instances")
    if not isinstance(instances, list):
        return _err("instances array bhejiye", 400)
    if len(instances) > 20:
        return _err("ek server me max 20 instances", 400)

    clean: list[dict[str, Any]] = []
    for i, item in enumerate(instances):
        if not isinstance(item, dict):
            return _err(f"instance #{i + 1} object hona chahiye", 400)
        rules = item.get("rules")
        if rules is not None and not isinstance(rules, list):
            return _err(f"instance #{i + 1}: rules array chahiye", 400)
        if isinstance(rules, list) and len(rules) > 40:
            return _err(f"instance #{i + 1}: max 40 rules", 400)
        item.setdefault("id", f"nk{int(discord.utils.utcnow().timestamp())}{i}")
        item.setdefault("name", f"Instance {i + 1}")
        item["guildId"] = str(guild.id)
        clean.append(item)

    saved = features.save_antinuke_instances(guild.id, clean)
    log.info("dashboard: antinuke instances saved (%d) guild=%s",
             len(saved), guild.id)
    return _json_response({"ok": True, "instances": saved})


async def api_antinuke_lockdown(request: web.Request) -> web.Response:
    """Lockdown on/off — dashboard ka emergency switch."""
    body = await request.json()
    sess, guild = _require_guild(request, body=body)
    import features

    try:
        if body.get("on"):
            result = await features._lockdown(guild, {}, "Dashboard se lockdown")
        else:
            result = await features.unlockdown(guild)
    except Exception as exc:  # noqa: BLE001
        log.exception("lockdown fail")
        return _err(f"lockdown fail: {exc}", 500)
    log.info("dashboard: lockdown %s guild=%s -> %s",
             "ON" if body.get("on") else "OFF", guild.id, result)
    return _json_response({"ok": True, "result": result,
                           "lockdown": store.kv_get(f"lockdown:{guild.id}") or {"on": False}})


# ==========================================================================
# API — modules
# ==========================================================================
STICKY_KEY = "stickymessages"
# in modules ke save par server/Discord par seedha asar lagta hai
PANEL_MODULES = {"verification", "reactionroles", "customroles", "giveaways", "tickets"}
SERVER_MODULES = {"customization", "servermgmt"}


async def _run_sticky(guild: Any, fn: Any) -> None:
    try:
        await fn(guild)
    except Exception:  # noqa: BLE001
        log.exception("sticky refresh fail (dashboard) guild=%s", getattr(guild, "id", "?"))


def _schedule_sticky(guild: Any, key: str) -> None:
    """Sticky config badli -> bot ko turant Discord ko sync karne bolo."""
    if key != STICKY_KEY:
        return
    fn = _callbacks.get("sticky")
    if fn is None:
        return
    asyncio.ensure_future(_run_sticky(guild, fn))


_module_jobs: dict[tuple[int, str], Any] = {}


async def _run_module(guild: Any, key: str, ident: tuple[int, str]) -> None:
    import features

    try:
        # typing karte waqt har keystroke par na chale — ek bounce window
        await asyncio.sleep(0.8)
    except asyncio.CancelledError:
        return  # nayi save aa gayi, usi ko chalne do
    _module_jobs.pop(ident, None)
    try:
        result = await features.apply_guild_settings(guild, key)
    except Exception:  # noqa: BLE001
        log.exception("module apply fail: %s", key)
        return
    if result:
        log.info("dashboard: %s apply -> %s", key, result)


def _schedule_module(guild: Any, key: str, *, apply: bool) -> None:
    if not apply:
        return
    # panel/server modules khud channel/role/guild likhte hain — apna hi
    # anti-nuke inhe attack na samjhe (features ka self-action window).
    if key in PANEL_MODULES or key in SERVER_MODULES:
        try:
            import features
            features.mark_self_action(int(getattr(guild, "id", 0)), 20)
        except Exception:  # noqa: BLE001
            pass
    ident = (int(getattr(guild, "id", 0)), key)
    old = _module_jobs.get(ident)
    if old is not None and not old.done():
        old.cancel()
    _module_jobs[ident] = asyncio.ensure_future(_run_module(guild, key, ident))


async def api_toggle(request: web.Request) -> web.Response:
    body = await request.json()
    sess, guild = _require_guild(request, body=body)
    key = request.match_info["key"]
    enabled = bool(body.get("enabled", True))
    store.set_module_enabled(guild.id, key, enabled)
    log.info("dashboard: %s -> %s in %s", key, enabled, guild.id)
    _schedule_sticky(guild, key)
    # toggle par sirf panels dobara jodne hote hain — server profile
    # (naam/wagarah) sirf config save par lagta hai.
    _schedule_module(guild, key, apply=key in PANEL_MODULES)
    return _json_response({"key": key, "enabled": enabled})


async def api_config(request: web.Request) -> web.Response:
    body = await request.json()
    sess, guild = _require_guild(request, body=body)
    key = request.match_info["key"]
    patch = body.get("cfg")
    if not isinstance(patch, dict):
        return _err("cfg object bhejiye", 400)
    saved = store.set_module_cfg(guild.id, key, patch)
    _schedule_sticky(guild, key)
    _schedule_module(guild, key, apply=bool(body.get("apply", True)))
    return _json_response({"key": key, "cfg": saved})


async def api_reset(request: web.Request) -> web.Response:
    body = await request.json()
    sess, guild = _require_guild(request, body=body)
    key = request.match_info["key"]
    store.reset_module(guild.id, key)
    _schedule_sticky(guild, key)
    return _json_response({"key": key, "reset": True})


async def api_test(request: web.Request) -> web.Response:
    """'🧪 Test on Discord' — har module ka asli Discord par asar."""
    body = await request.json()
    sess, guild = _require_guild(request, body=body)
    key = request.match_info["key"]
    import features

    try:
        result = await features.preview(guild, key)
    except Exception as exc:  # noqa: BLE001
        log.exception("test fail: %s", key)
        return _err(f"test fail: {exc}", 500)
    log.info("dashboard: test %s -> %s", key, result)
    return _json_response({"ok": True, "key": key, "result": result})


async def api_save_ids(request: web.Request) -> web.Response:
    """Server mapping — demo slots (c1, r5) ki asli Discord ids."""
    body = await request.json()
    sess, guild = _require_guild(request, body=body)
    channels = body.get("channels") or {}
    roles = body.get("roles") or {}
    if not isinstance(channels, dict) or not isinstance(roles, dict):
        return _err("channels/roles object chahiye", 400)
    store.reset_module(guild.id, "_ids")
    store.set_module_cfg(guild.id, "_ids", {"channels": channels, "roles": roles})
    log.info("dashboard: mapping saved (%d channels, %d roles)",
             len(channels), len(roles))
    return _json_response({"ok": True, "ids": {"channels": channels, "roles": roles}})


# ==========================================================================
# API — tickets (live control)
# ==========================================================================
async def api_ticket_action(request: web.Request) -> web.Response:
    body = await request.json()
    sess, guild = _require_guild(request, body=body)
    action = request.match_info.get("action")
    channel_id = int(body.get("channel") or 0)
    if not channel_id:
        return _err("channel id chahiye", 400)

    ticket = store.open_in_channel(channel_id)
    if not ticket:
        return _err("Ticket nahi mila (ho sakta hai band ho chuka ho)", 404)

    channel = guild.get_channel(channel_id)

    # Permission OAuth wale payload se check karo (member role cache ke bina
    # `member.guild_permissions` galat hota hai — members intent off rehta hai)
    oauth = next(
        (x for x in sess["guilds"] if str(x["id"]) == str(guild.id)), None
    )
    staff_ok = _can_manage(oauth) if oauth else False

    try:
        uid = int(sess["user"].get("id") or 0)
    except (TypeError, ValueError):
        uid = 0
    me = guild.get_member(uid) if uid else None
    if me is None and uid:
        try:
            # members intent off ho to REST se lao
            me = await guild.fetch_member(uid)
        except discord.HTTPException:
            me = None
    if me is None:
        # link-flow session me koi Discord identity nahi hoti — staff ho to
        # bot ki taraf se action karo
        if staff_ok and guild.me is not None:
            me = guild.me
        else:
            return _err("Aap is server me nahi dikh rahe — dobara login karo", 401)

    is_owner = str(ticket.get("user_id")) == str(me.id)
    if not (staff_ok or is_owner):
        return _err("Sirf staff ya ticket owner aisa kar sakta hai", 403)

    if action == "claim":
        if not store.claim(channel_id, me):
            return _err(f"Ticket pehle se claimed hai — {ticket.get('claimed_by_tag')}", 409)
        store.save()
        if channel:
            try:
                await channel.send(f"\N{HANDSHAKE} **{me}** ne ye ticket claim kiya.")
            except Exception:  # noqa: BLE001
                pass
        return _json_response({"action": action, "ok": True, "ticket": ticket})

    if action == "unclaim":
        store.unclaim(channel_id)
        store.save()
        if channel:
            try:
                await channel.send(f"\N{WAVING WHITE FLAG} {me} ne claim hata diya.")
            except Exception:  # noqa: BLE001
                pass
        return _json_response({"action": action, "ok": True, "ticket": ticket})

    if action == "close":
        if channel is None:
            return _err("Ticket channel nahi mila", 404)
        reason = body.get("reason")
        close_fn = _callbacks.get("close")
        if close_fn is None:
            return _err("Close handler set nahi hua", 500)
        await close_fn(guild, channel, ticket, me, reason)
        return _json_response({"action": action, "ok": True})

    return _err("Unknown action", 400)


# ==========================================================================
# API — ticket setup (dashboard se `/setup` jaisa)
# ==========================================================================
async def api_setup(request: web.Request) -> web.Response:
    """Categories + ticket-logs/create-ticket channels banao, panel bhejo."""
    body = await request.json()
    sess, guild = _require_guild(request, body=body)

    setup_fn = _callbacks.get("setup")
    if setup_fn is None:
        return _err("Setup handler set nahi hua", 500)

    try:
        staff_id = int(body.get("staff_role") or 0)
    except (TypeError, ValueError):
        staff_id = 0
    staff_role = guild.get_role(staff_id) if staff_id else None
    if staff_role is None:
        return _err("Staff role chuno (server ke roles me se)", 400)

    support_role = None
    if body.get("support_role"):
        try:
            support_role = guild.get_role(int(body.get("support_role")))
        except (TypeError, ValueError):
            support_role = None

    try:
        max_open = int(body.get("max_open") or 3)
    except (TypeError, ValueError):
        max_open = 3
    max_open = min(max(max_open, 1), 10)

    try:
        summary = await setup_fn(guild, staff_role, support_role, max_open)
    except discord.Forbidden:
        return _err("Bot ke paas channels/categories banane ki permission nahi hai", 403)
    except discord.HTTPException as exc:
        log.error("dashboard setup fail: %s", exc)
        return _err(f"Discord error: {exc}", 500)

    log.info("dashboard setup in %s by %s", guild.id, (sess["user"] or {}).get("username"))
    return _json_response({"ok": True, "setup": summary})


async def api_panel(request: web.Request) -> web.Response:
    """Panel message dobara bhejo."""
    body = await request.json()
    _sess, guild = _require_guild(request, body=body)

    panel_fn = _callbacks.get("panel")
    if panel_fn is None:
        return _err("Panel handler set nahi hua", 500)

    gcfg = store.guild_config(guild.id)
    pid = gcfg.get("panel_channel_id")
    channel = guild.get_channel(int(pid)) if pid else None
    if channel is None:
        return _err("Panel channel nahi mila — pehle Setup chalao", 400)
    try:
        msg = await panel_fn(channel)
    except discord.Forbidden:
        return _err("Bot ke paas panel bhejne ki permission nahi hai", 403)
    except discord.HTTPException as exc:
        log.error("dashboard panel fail: %s", exc)
        return _err(f"Discord error: {exc}", 500)
    return _json_response({"ok": True, "channel": str(channel.id), "message": str(msg.id)})


# ==========================================================================
# App
# ==========================================================================
async def _index(request: web.Request) -> web.Response:
    """Session nahi → connect page. Session hai → asli dashboard."""
    connect = config.DASHBOARD_DIR / "connect.html"
    if not _session(request) and connect.is_file():
        return web.FileResponse(connect)
    return web.FileResponse(config.DASHBOARD_DIR / "index.html")


@web.middleware
async def _no_store(request: web.Request, handler):
    """Dev me browser cache bahut dikkat deta hai — index, JS, CSS, API
    sab kabhi cache na ho. (Pehle sirf /api, /auth, / tha — /js/router.js
    purana serve hota raha tha aur naye code par JS error aata tha;
    index ka Content-Type FileResponse me late set hota hai isliye
    wo bhi miss ho raha tha.)"""
    resp = await handler(request)
    resp.headers["Cache-Control"] = "no-store, must-revalidate"
    return resp


async def _health(request: web.Request) -> web.Response:
    return _json_response({"ok": True, "bot": str(request.app["bot"].user)})


def create_app(bot: Any) -> web.Application:
    app = web.Application(middlewares=[_no_store])
    app["bot"] = bot

    app.router.add_get("/auth/login", auth_login)
    app.router.add_get("/auth/callback", auth_callback)
    app.router.add_post("/auth/connect", auth_connect)
    app.router.add_post("/auth/logout", auth_logout)
    app.router.add_get("/api/me", api_me)
    app.router.add_get("/api/bot-guilds", api_bot_guilds)
    app.router.add_get("/api/state", api_state)
    app.router.add_post("/api/modules/{key}/toggle", api_toggle)
    app.router.add_post("/api/modules/{key}/config", api_config)
    app.router.add_post("/api/modules/{key}/reset", api_reset)
    app.router.add_post("/api/modules/{key}/test", api_test)
    app.router.add_post("/api/ids", api_save_ids)
    app.router.add_post("/api/antinuke/instances", api_antinuke_instances)
    app.router.add_post("/api/antinuke/lockdown", api_antinuke_lockdown)
    app.router.add_post("/api/tickets/{action}", api_ticket_action)
    app.router.add_post("/api/setup", api_setup)
    app.router.add_post("/api/panel", api_panel)
    app.router.add_get("/api/health", _health)

    app.router.add_get("/", _index)
    if config.DASHBOARD_DIR.exists():
        for prefix, sub in (("/css/", "css"), ("/js/", "js"), ("/img/", "img"), ("/fonts/", "fonts")):
            path = config.DASHBOARD_DIR / sub
            if path.is_dir():
                app.router.add_static(prefix, path, show_index=False)
            else:
                log.debug("static dir skip (nahi mili): %s", path)
    else:
        log.warning("Dashboard folder nahi mila: %s", config.DASHBOARD_DIR)

    app["sessions"] = _sessions
    return app


async def start(bot: Any) -> None:
    """bot ke event loop par server start karta hai."""
    app = create_app(bot)
    runner = web.AppRunner(app, access_log=None)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", config.WEB_PORT)
    try:
        await site.start()
    except OSError as exc:
        log.error(
            "Web server port %s nahi khula (%s). `serve.py` band karo ya WEB_PORT badlo.",
            config.WEB_PORT,
            exc,
        )
        return
    bot._web_runner = runner  # type: ignore[attr-defined]
    log.info(
        "Dashboard: %s  (login: %s/auth/login)",
        config.BASE_URL,
        config.BASE_URL,
    )
    if not config.CLIENT_SECRET:
        log.warning(
            "CLIENT_SECRET khali hai — OAuth login kaam nahi karega. .env me CLIENT_ID/CLIENT_SECRET daalo."
        )


def set_callbacks(**kw: Any) -> None:
    _callbacks.update(kw)
