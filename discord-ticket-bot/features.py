"""
APEX bot — non-ticket features
===============================

Dashboard ke 24 modules me se 22 yahan ASLI me chalte hain
(tickets aur sticky messages apni jagah hain: bot.py / storage.py).

Har feature ka dhandha ek hi hai:

  1. Config **live** padho (`store.module_cfg`) — memory me hai, file I/O
     nahi, isliye on_message jesi high-frequency jagah bhi safe hai.
  2. Demo ids (`c1`, `r5`) ko asli Discord id me **resolve** karo.
  3. Zaroori action karo aur (agar ho sake) `data/logs` wagarah me note.

Resolve ka order:
      real snowflake  ->  dashboard ki mapping (`_ids`)  ->  naam se dhoondho
Jis module ka resolve fail hota hai, wo chup-chaap skip hota hai (log me
warning) — galat jagah message bhejne se behtar hai.
"""

from __future__ import annotations

import asyncio
import aiohttp
import base64
import json
import logging
import random
import re
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import discord
from discord.ext import commands

import config
from storage import store

log = logging.getLogger("features")

# Persistent views ke liye bot reference (cog ke bahar ke functions chahiye)
_BOT: commands.Bot | None = None

# ==========================================================================
# Config helpers
# ==========================================================================
def cfg(guild_id: int | None, key: str) -> dict[str, Any]:
    return store.module_cfg(guild_id, key) or {}


def is_on(guild_id: int | None, key: str) -> bool:
    return store.module_enabled(guild_id, key, default=False)


# ==========================================================================
# Resolver — demo id -> asli id
# ==========================================================================
MOCK_CHANNELS: dict[str, str] = {
    "c1": "general",
    "c2": "welcome",
    "c3": "rules",
    "c4": "announcements",
    "c5": "showcase",
    "c6": "counting",
    "c7": "bot-updates",
    "c8": "tickets",
    "c9": "ticket-logs",
    "c10": "staff-chat",
    "c11": "staff-reports",
    "c12": "General Voice",
    "c13": "Gaming",
}

MOCK_ROLES: dict[str, str] = {
    "r1": "Owner",
    "r2": "Admin",
    "r3": "Moderator",
    "r4": "Support",
    "r5": "Helper",
    "r6": "Premium",
    "r7": "VIP",
    "r8": "Gamer",
    "r9": "Muted",
    "r10": "Banned",
    "r11": "Booster",
    "r12": "Level 20",
    "r13": "Level 10",
    "r14": "Contributor",
}

_MOCK_ID = re.compile(r"^(?:c|r)\d+$")


def _id_map(guild_id: int | None) -> dict[str, Any]:
    """Dashboard ki 'Server Mapping' — c1/r5 jesi slots ki asli ids."""
    return store.module_cfg(guild_id, "_ids") or {}


def resolve_channel(guild: discord.Guild, value: Any) -> discord.TextChannel | None:
    if guild is None:
        return None
    raw = str(value or "").strip()
    if not raw:
        return None

    if raw.isdigit():
        ch = guild.get_channel(int(raw))
        return ch if isinstance(ch, discord.TextChannel) else None

    mapped = str((_id_map(guild.id).get("channels") or {}).get(raw, "") or "")
    if mapped.isdigit():
        ch = guild.get_channel(int(mapped))
        if isinstance(ch, discord.TextChannel):
            return ch

    name = MOCK_CHANNELS.get(raw)
    if name:
        for ch in guild.text_channels:
            if ch.name.lower() == name.lower():
                return ch
    return None


def resolve_role(guild: discord.Guild, value: Any) -> discord.Role | None:
    if guild is None:
        return None
    raw = str(value or "").strip()
    if not raw:
        return None

    if raw.isdigit():
        return guild.get_role(int(raw))

    mapped = str((_id_map(guild.id).get("roles") or {}).get(raw, "") or "")
    if mapped.isdigit():
        role = guild.get_role(int(mapped))
        if role is not None:
            return role

    name = MOCK_ROLES.get(raw)
    if name:
        for role in guild.roles:
            if role.name.lower() == name.lower():
                return role
    return None


def resolve_many(guild: discord.Guild, values: Any, kind: str) -> list[str]:
    """List of ids (jaise noXpChannels) ko resolve karke real ids return."""
    out: list[str] = []
    for item in values or []:
        obj = resolve_channel(guild, item) if kind == "ch" else resolve_role(guild, item)
        if obj is not None:
            out.append(str(obj.id))
    return out


def _hex(value: Any, fallback: int = 0x7C5CFF) -> int:
    try:
        text = str(value or "").strip().lstrip("#")
        if len(text) == 3:
            text = "".join(ch * 2 for ch in text)
        return int(text, 16)
    except (TypeError, ValueError):
        return fallback


def fill(template: Any, *, member: discord.abc.User | None = None,
         guild: discord.Guild | None = None, count: int | None = None) -> str:
    """{user} {server} {count} jese placeholders bhar do."""
    text = str(template or "")
    members = count if count is not None else (guild.member_count if guild else 0)
    mapping = {
        "{user}": member.mention if member else "",
        "{username}": str(member.name) if member else "",
        "{userid}": str(member.id) if member else "",
        "{server}": guild.name if guild else "",
        "{servername}": guild.name if guild else "",
        "{count}": str(members),
        "{members}": str(members),
        "{date}": datetime.now(timezone.utc).strftime("%d %b %Y"),
    }
    for key, val in mapping.items():
        text = text.replace(key, val)
    return text


# ==========================================================================
# Channel helpers
# ==========================================================================
async def _safe_send(channel: Any, **kwargs: Any) -> discord.Message | None:
    try:
        return await channel.send(**kwargs)
    except discord.HTTPException as exc:
        log.warning("send fail in %s: %s | %s", getattr(channel, "id", "?"), exc,
                    getattr(exc, "text", "")[:300])
        return None


async def notify(guild: discord.Guild, module_key: str, title: str, body: str,
                 colour: int = 0xE74C3C, fallback_channel: Any = None) -> None:
    """Module ke apne logChannel me embed bhejo."""
    settings = cfg(guild.id, module_key)
    channel = resolve_channel(guild, settings.get("logChannel")) or fallback_channel
    if channel is None:
        return
    embed = discord.Embed(title=title, description=body, colour=colour,
                          timestamp=discord.utils.utcnow())
    await _safe_send(channel, embed=embed)


EVENT_COLOURS = {
    "e1": 0x95A5A6, "e2": 0x2ECC71, "e3": 0x3498DB, "e4": 0x9B59B6,
    "e5": 0x1ABC9C, "e6": 0xF39C12, "e7": 0xE74C3C, "e8": 0xE91E63,
}


async def audit(guild: discord.Guild, module_key: str, event_id: str,
                title: str, body: str) -> None:
    """Logging module ke events me embed — sirf tab jab wo ON ho."""
    if not is_on(guild.id, "logging"):
        return
    settings = cfg(guild.id, "logging")
    event = next((e for e in settings.get("events") or [] if e.get("id") == event_id), None)
    if not event or not event.get("on"):
        return
    channel = (resolve_channel(guild, event.get("target"))
               or resolve_channel(guild, settings.get("logChannel")))
    if channel is None:
        return
    embed = discord.Embed(title=title, description=body,
                          colour=EVENT_COLOURS.get(event_id, 0x7C5CFF),
                          timestamp=discord.utils.utcnow())
    embed.set_footer(text="APEX audit")
    await _safe_send(channel, embed=embed)


# ==========================================================================
# Persistent views — verification + role panels
# ==========================================================================
async def _grant_verify(interaction: discord.Interaction) -> None:
    """Verify karke role do — dono views (plain button + captcha) isi se guzarte hain."""
    guild = interaction.guild
    if guild is None or interaction.user is None or interaction.user.bot:
        return await interaction.response.send_message(
            "Ye button sirf server members ke liye hai.", ephemeral=True)

    settings = cfg(guild.id, "verification")
    role = (resolve_role(guild, settings.get("roleToAssign"))
            or resolve_role(guild, settings.get("autoRole")))
    if role is None:
        return await interaction.response.send_message(
            "⚠️ Verify role set nahi hai — dashboard se chuno.",
            ephemeral=True)

    member = guild.get_member(interaction.user.id)
    if member is None:
        return await interaction.response.send_message(
            "❌ Member nahi mila — dobara join karo.", ephemeral=True)

    # account-age gate
    try:
        min_days = int(settings.get("minAccountAge") or 0)
    except (TypeError, ValueError):
        min_days = 0
    if min_days and member.created_at is not None:
        age = (discord.utils.utcnow() - member.created_at).days
        if age < min_days:
            return await interaction.response.send_message(
                f"❌ Tumhara account abhi {age} din purana hai — "
                f"verify ke liye {min_days} din chahiye.", ephemeral=True)

    if role in member.roles:
        return await interaction.response.send_message(
            "✅ Tum pehle se verified ho!", ephemeral=True)

    try:
        await member.add_roles(role, reason="Dashboard verification")
    except discord.HTTPException:
        return await interaction.response.send_message(
            "❌ Role dene me dikkat aayi — bot ki position check karo.",
            ephemeral=True)

    await interaction.response.send_message(
        f"✅ Verified! {role.mention} mil gaya.", ephemeral=True)
    await audit(guild, "verification", "e2",
                "✅ Member verified",
                f"{interaction.user.mention} ne verify kiya aur {role.mention} liya.")


class VerifyView(discord.ui.View):
    """Simple 'Verify me' button — mode: button."""

    def __init__(self, label: str = "Verify me") -> None:
        super().__init__(timeout=None)
        button = discord.ui.Button(label=label, style=discord.ButtonStyle.success,
                                   custom_id="apex:verify", emoji="✅")
        button.callback = self._on_click
        self.add_item(button)

    async def _on_click(self, interaction: discord.Interaction) -> None:
        await _grant_verify(interaction)


class CaptchaView(discord.ui.View):
    """Math captcha — custom_id me a, b aur har option ka value likha hai.

    Isliye restart ke baad bhi sahi jawab pata chalta hai (koi state nahi).
    """

    def __init__(self, a: int, b: int, options: list[int]) -> None:
        super().__init__(timeout=None)
        for value in options:
            button = discord.ui.Button(
                label=str(value),
                style=discord.ButtonStyle.secondary,
                custom_id=f"apex:vc:{a}:{b}:{value}",
            )
            button.callback = self._make(value)
            self.add_item(button)

    @staticmethod
    def _make(value: int):
        async def _callback(interaction: discord.Interaction) -> None:
            guild = interaction.guild
            if guild is None:
                return
            a, b = _captcha_parts(interaction)
            if value != a + b:
                try:
                    await interaction.response.send_message(
                        "❌ Galat jawab — dobara try karo.", ephemeral=True)
                except discord.HTTPException:
                    pass
                return
            await _grant_verify(interaction)

        return _callback


def _captcha_parts(interaction: discord.Interaction) -> tuple[int, int]:
    """custom_id `apex:vc:<a>:<b>:<value>` se dono ank nikaalo."""
    try:
        _, _, a, b, _value = str(interaction.data.get("custom_id", "")).split(":")
        return int(a), int(b)
    except (ValueError, AttributeError):
        return 0, 0


def new_question() -> dict[str, Any]:
    """Ek naya math sawaal — teeno ank view me custom_id me chale jate hain."""
    a = random.randint(2, 9)
    b = random.randint(2, 9)
    correct = a + b
    options = [correct]
    while len(options) < 3:
        cand = correct + random.randint(1, 6) * random.choice([1, -1])
        if cand >= 0 and cand not in options:
            options.append(cand)
    random.shuffle(options)
    return {"a": a, "b": b, "options": options}


def view_for(question: dict[str, Any]) -> CaptchaView:
    return CaptchaView(int(question["a"]), int(question["b"]),
                       [int(v) for v in question.get("options") or []])


class RolePanelView(discord.ui.View):
    """Dono modules ek hi view se chalte hain — custom_id me farak hai."""

    def __init__(self, items: list[dict[str, str]]) -> None:
        super().__init__(timeout=None)
        for item in items[:25]:
            button = discord.ui.Button(
                label=item["label"][:80],
                custom_id=item["custom_id"],
                style=discord.ButtonStyle.secondary,
                emoji=item.get("emoji") or None,
            )
            button.callback = self._make(item["role"])
            self.add_item(button)

    @staticmethod
    def _make(role_id: str):
        async def _callback(interaction: discord.Interaction) -> None:
            guild = interaction.guild
            if guild is None or interaction.user is None or interaction.user.bot:
                return await interaction.response.send_message("Sirf members ke liye.",
                                                              ephemeral=True)
            module_key = interaction.data.get("custom_id", "").split(":")[1]
            settings = cfg(guild.id, module_key)
            pool: list[dict[str, Any]] = []
            if module_key == "reactionroles":
                for group in settings.get("groups") or []:
                    if group.get("on", True):
                        pool.extend(group.get("options") or [])
            else:
                pool = [r for r in settings.get("roles") or [] if r.get("on")]

            hit = next((r for r in pool if str(r.get("role")) == role_id), None)
            if hit is None:
                return await interaction.response.send_message(
                    "⚠️ Ye option abhi disabled hai.", ephemeral=True)

            role = resolve_role(guild, hit.get("role"))
            if role is None:
                return await interaction.response.send_message(
                    "⚠️ Ye role ab server me maujood nahi. Dashboard par "
                    "role dobara chuno.", ephemeral=True)

            member = guild.get_member(interaction.user.id)
            if member is None:
                return await interaction.response.send_message("❌ Member nahi mila.",
                                                              ephemeral=True)
            if role in member.roles:
                try:
                    await member.remove_roles(role, reason=f"{module_key} panel")
                except discord.HTTPException:
                    return await interaction.response.send_message("Role hata nahi paya.",
                                                                   ephemeral=True)
                return await interaction.response.send_message(
                    f"🔴 {role.mention} hata diya.", ephemeral=True)

            try:
                await member.add_roles(role, reason=f"{module_key} panel")
            except discord.HTTPException:
                return await interaction.response.send_message("Role nahi mil paya.",
                                                               ephemeral=True)
            await interaction.response.send_message(
                f"✅ {role.mention} mil gaya!", ephemeral=True)

        return _callback


# ==========================================================================
# Panel sync — verification / reactionroles / customroles / giveaways
# ==========================================================================
def _panels(guild_id: int) -> dict[str, Any]:
    return store.kv_get(f"panels:{guild_id}") or {}


def _set_panel(guild_id: int, key: str, value: Any) -> None:
    panels = _panels(guild_id)
    panels[key] = value
    store.kv_set(f"panels:{guild_id}", panels)


async def sync_guild(guild: discord.Guild) -> None:
    """Restart ke baad panels dobara jodta hai + giveaways schedule karta hai."""
    await _sync_verify(guild)
    await _sync_role_panels(guild)
    await _sync_giveaways(guild)
    await _cache_invites(guild)


def _is_captcha(settings: dict[str, Any]) -> bool:
    mode = str(settings.get("mode") or settings.get("challengeMethod") or "").lower()
    return mode in ("captcha", "math", "question")


async def _sync_verify(guild: discord.Guild) -> None:
    if not is_on(guild.id, "verification"):
        return
    settings = cfg(guild.id, "verification")

    label = str(settings.get("buttonLabel") or "Verify me")
    captcha = _is_captcha(settings)
    panels = _panels(guild.id)

    question = panels.get("verify_q") if captcha else None
    if captcha and not question:
        # sawaal ek baar banao aur panel state me rakho — restart ke baad
        # wahi sawaal dobara construct hoga, warna options badal jate
        question = new_question()
        _set_panel(guild.id, "verify_q", question)

    # 1) view PEHLE register karo — gate channel toot jaye/bad jaye tab bhi
    #    purane panel ke buttons chalte rahein. (Warna Discord sirf
    #    "This interaction failed" dikhata hai aur role kabhi milta nahi.)
    if _BOT is not None:
        try:
            _BOT.add_view(view_for(question) if (captcha and question)
                          else VerifyView(label))
        except Exception as exc:  # noqa: BLE001
            log.warning("verify view add fail: %s", exc)

    # 2) gate channel — sirf panel (re)post ke liye chahiye
    channel = resolve_channel(guild, settings.get("gateChannel"))
    if channel is None:
        raw = str(settings.get("gateChannel") or "").strip()
        bad: Any = None
        if raw.isdigit():
            try:
                bad = (guild.get_channel(int(raw))
                       or await guild.fetch_channel(int(raw)))
            except (discord.NotFound, discord.Forbidden, discord.HTTPException):
                bad = None
        if bad is not None:
            kind = type(bad).__name__.replace("Channel", "").replace("Thread", "thread").lower()
            log.warning(
                "verification: gateChannel '%s' %s channel hai — panel sirf TEXT "
                "channel me post hota hai. Dashboard se text channel chuno (guild=%s)",
                getattr(bad, "name", raw), kind, guild.id)
        else:
            log.warning("verification: gateChannel resolve nahi hua (guild=%s)",
                        guild.id)
        return

    if panels.get("verify_msg"):
        try:
            old = await channel.fetch_message(int(panels["verify_msg"]))
            if bool(panels.get("verify_mode")) == captcha:
                return  # zinda hai, mode bhi wahi
            # mode badal gaya (button <-> captcha) — purana panel hatao
            await old.delete()
            _set_panel(guild.id, "verify_msg", None)
        except (discord.NotFound, ValueError, discord.HTTPException):
            pass

    embed = discord.Embed(
        title="🔐 Verification",
        description=fill(settings.get("entryMessage"), guild=guild),
        colour=0x2ECC71,
    )
    if captcha and question:
        embed.add_field(name="Captcha",
                        value=f"**{question['a']} + {question['b']} = ?** — sahi option dabao",
                        inline=False)
        embed.set_footer(text="Sahi jawab doge to server unlock ho jayega")
        view: discord.ui.View = view_for(question)
    else:
        embed.set_footer(text=f"Neeche '{label}' dabao aur server unlock ho jayega")
        view = VerifyView(label)

    message = await _safe_send(channel, embed=embed, view=view)
    if message:
        _set_panel(guild.id, "verify_msg", message.id)
        _set_panel(guild.id, "verify_channel", channel.id)
        _set_panel(guild.id, "verify_mode", captcha)


async def _role_items(guild: discord.Guild, module_key: str) -> list[dict[str, str]]:
    settings = cfg(guild.id, module_key)
    items: list[dict[str, str]] = []
    if module_key == "reactionroles":
        for group in settings.get("groups") or []:
            if not group.get("on", True):
                continue
            for option in group.get("options") or []:
                if not resolve_role(guild, option.get("role")):
                    continue
                items.append({
                    "custom_id": f"apex:reactionroles:{option.get('id')}",
                    "label": str(option.get("name") or "Role")[:80],
                    "emoji": str(option.get("emoji") or "") or None,
                    "role": str(option.get("role")),
                })
    else:
        for entry in settings.get("roles") or []:
            if not entry.get("on"):
                continue
            if not resolve_role(guild, entry.get("role")):
                continue
            items.append({
                "custom_id": f"apex:customroles:{entry.get('id')}",
                "label": str(entry.get("label") or "Role")[:80],
                "emoji": None,
                "role": str(entry.get("role")),
            })
    return items


async def _sync_role_panels(guild: discord.Guild) -> None:
    for module_key, panel_key, title in (
        ("reactionroles", "rr_msg", "🔔 Reaction Roles"),
        ("customroles", "cr_msg", "🎭 Role Panel"),
    ):
        if not is_on(guild.id, module_key):
            continue
        settings = cfg(guild.id, module_key)
        channel = resolve_channel(guild, settings.get("channel"))
        items = await _role_items(guild, module_key)
        if channel is None or not items:
            continue

        if _BOT is not None:
            try:
                _BOT.add_view(RolePanelView(items))
            except Exception as exc:  # noqa: BLE001
                log.warning("%s view add fail: %s", module_key, exc)

        panels = _panels(guild.id)
        if panels.get(panel_key):
            try:
                await channel.fetch_message(int(panels[panel_key]))
                continue
            except (discord.NotFound, ValueError):
                pass

        embed = discord.Embed(
            title=title,
            description="Neeche button dabkar role lo / hata lo.",
            colour=0x3498DB,
        )
        message = await _safe_send(channel, embed=embed, view=RolePanelView(items))
        if message:
            _set_panel(guild.id, panel_key, message.id)
            _set_panel(guild.id, panel_key + "_channel", channel.id)


async def _cache_invites(guild: discord.Guild) -> None:
    if not is_on(guild.id, "invites"):
        return
    try:
        invites = await guild.invites()
    except discord.HTTPException:
        return
    store.kv_set(f"invites:{guild.id}", {i.code: i.uses or 0 for i in invites}, save=False)


async def _sync_giveaways(guild: discord.Guild) -> None:
    if not is_on(guild.id, "giveaways"):
        return
    settings = cfg(guild.id, "giveaways")
    channel = resolve_channel(guild, settings.get("channel"))
    if channel is None:
        return

    posted = store.kv_get(f"giveaways:{guild.id}") or {}
    for giveaway in settings.get("active") or []:
        gid = str(giveaway.get("id") or "")
        if not gid or gid in posted:
            continue
        embed = discord.Embed(
            title=f"🎉 {giveaway.get('prize') or 'Giveaway'}",
            description=(
                f"⏱️ Ends: <t:{int((giveaway.get('ends') or 0) / 1000)}:R>\n"
                f"🎯 Winners: **{giveaway.get('winners') or 1}**\n\n"
                "🔔 **✅ 🎉 react karo to enter!**"
            ),
            colour=0xE91E63,
        )
        embed.set_footer(text="Giveaway • APEX")
        message = await _safe_send(channel, embed=embed)
        if message is None:
            continue
        try:
            await message.add_reaction("🎉")
        except discord.HTTPException:
            pass
        posted[gid] = {"msg": message.id, "channel": channel.id}
        store.kv_set(f"giveaways:{guild.id}", posted, save=False)

        ends_at = float(giveaway.get("ends") or 0) / 1000
        if ends_at > 0:
            asyncio.ensure_future(_end_giveaway(guild, gid, ends_at))
    store.kv_set(f"giveaways:{guild.id}", posted)


async def _end_giveaway(guild: discord.Guild, gid: str, ends_at: float) -> None:
    delay = max(0.0, ends_at - datetime.now(timezone.utc).timestamp())
    if delay > 0:
        await asyncio.sleep(delay)

    settings = cfg(guild.id, "giveaways")
    giveaway = next((g for g in settings.get("active") or [] if str(g.get("id")) == gid), None)
    if giveaway is None:
        return
    channel_id = (store.kv_get(f"giveaways:{guild.id}") or {}).get(gid, {}).get("channel")
    channel = guild.get_channel(int(channel_id or 0))
    if not isinstance(channel, discord.TextChannel):
        return
    message = None
    try:
        message = await channel.fetch_message(
            int((store.kv_get(f"giveaways:{guild.id}") or {}).get(gid, {}).get("msg") or 0))
    except (discord.NotFound, ValueError, discord.HTTPException):
        pass

    winners_count = int(giveaway.get("winners") or 1)
    entrants = []
    if message is not None:
        for reaction in message.reactions:
            if str(reaction.emoji) == "🎉":
                async for user in reaction.users():
                    if not user.bot:
                        entrants.append(user)
                break

    if entrants:
        winners = random.sample(entrants, min(winners_count, len(entrants)))
        text = "🎉 **Winner(s):** " + ", ".join(w.mention for w in winners)
    else:
        text = "😔 Kisi ne enter nahi kiya — giveaway radd."

    if message is not None:
        embed = message.embeds[0] if message.embeds else discord.Embed()
        embed.title = f"🎉 {giveaway.get('prize')} — ENDED"
        embed.description = text
        embed.colour = 0x95A5A6
        try:
            await message.edit(embed=embed)
        except discord.HTTPException:
            pass
    else:
        await _safe_send(channel, content=text)

    active = [g for g in (settings.get("active") or []) if str(g.get("id")) != gid]
    history = list(settings.get("history") or [])
    history.insert(0, {
        "id": "gwh_" + gid,
        "prize": giveaway.get("prize"),
        "winner": (winners[0].name if entrants else "—"),
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "entries": len(entrants),
    })
    store.set_module_cfg(guild.id, "giveaways", {"active": active, "history": history[:20]})

    posted = store.kv_get(f"giveaways:{guild.id}") or {}
    posted.pop(gid, None)
    store.kv_set(f"giveaways:{guild.id}", posted)


# ==========================================================================
# Cog — saare event listeners
# ==========================================================================
class Features(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    # ------------------------------------------------------------------
    # JOIN / LEAVE — welcome, joindm, verification, invites, tracking
    # ------------------------------------------------------------------
    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member) -> None:
        guild = member.guild
        gid = guild.id

        # --- tracking counters
        if is_on(gid, "tracking"):
            counters = store.kv_get(f"tracking:{gid}") or {"joins": 0, "leaves": 0}
            counters["joins"] = int(counters.get("joins") or 0) + 1
            store.kv_set(f"tracking:{gid}", counters, save=False)
            store.set_module_cfg(gid, "tracking", {
                "totalJoins": counters["joins"],
                "totalLeaves": counters["leaves"],
                "netGrowth": counters["joins"] - counters["leaves"],
            })

        # --- invite source
        source = await _detect_inviter(guild, member)

        # --- welcome message
        if is_on(gid, "welcome"):
            settings = cfg(gid, "welcome")
            wtype = str(settings.get("type") or "card")
            extra = []
            if settings.get("showMemberCount"):
                extra.append(f"👥 Tu humare **{guild.member_count}** ve member hai.")
            if settings.get("showAccountAge") and member.created_at:
                days = (discord.utils.utcnow() - member.created_at).days
                extra.append(f"📁 Account {days} din purana.")
            if source and settings.get("showInviteSource"):
                extra.append(f"🔗 Aaoge: `{source}` se.")

            if wtype == "dm":
                # "DM only" — channel ki zaroorat hi nahi, seedha DM
                asyncio.ensure_future(_send_join_dm(member, settings))
            else:
                channel = resolve_channel(guild, settings.get("channel"))
                if channel is not None:
                    if wtype in ("card", "embed"):
                        # EmbedBuilder wala hi logic — image/thumbnail resolve +
                        # emoji sync (welcome_embed)
                        emb, enotes = await welcome_embed(guild, member, settings,
                                                          extras="\n".join(extra))
                        await _safe_send(channel, embed=emb)
                        if enotes:
                            log.info("welcome notes [%s]: %s", gid, " ; ".join(enotes))
                    else:
                        body = fill(settings.get("message"), member=member, guild=guild)
                        if extra:
                            body = body + "\n\n" + "\n".join(extra)
                        await _safe_send(channel, content=body)

            # "Also send a DM" toggle — sirf tab jab Join DM module band ho,
            # warna naye member ko DO DM chale jayenge
            if (settings.get("dmOnJoin") and wtype != "dm"
                    and not is_on(gid, "joindm")):
                asyncio.ensure_future(_send_join_dm(member, settings))

        # --- join DM
        if is_on(gid, "joindm"):
            asyncio.ensure_future(_send_join_dm(member, cfg(gid, "joindm")))

        # --- verification: gate message dobara bhejo agar band ho gaya
        if is_on(gid, "verification"):
            await _sync_verify(guild)

        # --- log
        await audit(guild, "membership", "e2", "🆕 Naya member",
                    f"{member.mention} join hua.\nAccount: <t:{int(member.created_at.timestamp())}:R>"
                    + (f"\nInvite: `{source}`" if source else ""))

        # --- anti-nuke: bot add (raid bots)
        if member.bot:
            await _antinuke_bump(guild, "Bot Add")

    @commands.Cog.listener()
    async def on_member_remove(self, member: discord.Member) -> None:
        guild = member.guild
        gid = guild.id

        if is_on(gid, "tracking"):
            counters = store.kv_get(f"tracking:{gid}") or {"joins": 0, "leaves": 0}
            counters["leaves"] = int(counters.get("leaves") or 0) + 1
            store.kv_set(f"tracking:{gid}", counters, save=False)
            store.set_module_cfg(gid, "tracking", {
                "totalJoins": counters["joins"],
                "totalLeaves": counters["leaves"],
                "netGrowth": counters["joins"] - counters["leaves"],
            })

        if is_on(gid, "farewell"):
            settings = cfg(gid, "farewell")
            channel = resolve_channel(guild, settings.get("channel"))
            if channel is not None:                await _safe_send(
                    channel,
                    content=fill(settings.get("message"), member=member, guild=guild,
                                 count=guild.member_count),
                )
            if settings.get("dmOnLeave"):
                try:
                    await member.send(fill(settings.get("message"), member=member, guild=guild))
                except discord.HTTPException:
                    pass

        await audit(guild, "membership", "e2", "🇪 Member gaya",
                    f"{member.name} leave kiya. Ab **{guild.member_count}** members.")

        # --- anti-nuke: ye asli "leave" tha ya kick? (audit se confirm)
        entry = await _latest_audit(guild, discord.AuditLogAction.kick)
        if (entry is not None and entry.target is not None
                and getattr(entry.target, "id", None) == member.id
                and (discord.utils.utcnow() - entry.created_at).total_seconds() <= 15):
            await _antinuke_bump(guild, "Mass Kick")

    # ------------------------------------------------------------------
    # MESSAGE — automod, scam, autoresponder, counting, leveling
    # ------------------------------------------------------------------
    @commands.Cog.listener()
    async def on_message(self, message: discord.Message) -> None:
        if message.guild is None or message.author is None:
            return
        guild = message.guild
        gid = guild.id
        author = message.author

        # Webhook ke messages ka `author.bot` true hota hai, lekin webhook
        # sirf staff (Manage Webhooks) bana sakte hain — to unhe bhi
        # moderate/XP do. Sirf asli bots chhodte hain.
        humanish = bool(message.webhook_id) or not bool(getattr(author, "bot", False))

        # panel/wicket buttons etc. — bot ke apne messages par moderation nahi
        if isinstance(author, discord.Member) and author.guild_permissions.manage_messages:
            return

        if message.content and humanish:
            # automod/scam agar message hata chuke hain to aage kuch mat karo
            if await _automod(guild, message) or await _scam_check(guild, message):
                return
            await _autorespond(guild, message)
            await _counting(guild, message)
            await _leveling(guild, message)

    @commands.Cog.listener()
    async def on_raw_message_delete(self, payload: discord.RawMessageDeleteEvent) -> None:
        """Message delete log.

        RAW use karte hain — `message_delete` sirf cached messages par aata
        hai, aur purane/cross-session messages cache me nahi hote (usi wajah
        se sticky ka repost bhi chhup jaata tha).
        """
        if payload.guild_id is None:
            return
        guild = self.bot.get_guild(payload.guild_id)
        if guild is None:
            return
        channel = guild.get_channel(payload.channel_id)
        where = channel.mention if isinstance(channel, discord.TextChannel) else str(payload.channel_id)

        message = payload.cached_message
        if message is None or message.author is None:
            await audit(guild, "messages", "e1",
                        "🗑️ Message delete",
                        f"`{where}` me message delete hua (id `{payload.message_id}` — "
                        f"cache me nahi tha, isliye author nahi mila).")
            return
        # bot ke apne messages (sticky repost, panel edit) par log mat karo
        if message.author.bot and not message.webhook_id:
            return
        await audit(guild, "messages", "e1",
                    "🗑️ Message delete",
                    f"**{message.author}** ka message `{where}` me delete hua.\n"
                    f"```{(message.content or '')[:800] or '(media/embed)'}```")

    @commands.Cog.listener()
    async def on_message_edit(self, before: discord.Message, after: discord.Message) -> None:
        if before.guild is None or before.author is None or before.author.bot:
            return
        if (before.content or "") == (after.content or ""):
            return
        await audit(before.guild, "messages", "e6", "✏️ Message edit",
                    f"**{before.author}** ne `{before.channel.mention}` me edit kiya.\n"
                    f"**Purana:** ```{(before.content or '')[:400]}```\n"
                    f"**Naya:** ```{(after.content or '')[:400]}```")

    # ------------------------------------------------------------------
    # LOGGING — roles, channels, voice, bans
    # ------------------------------------------------------------------
    @commands.Cog.listener()
    async def on_guild_channel_create(self, channel: discord.abc.GuildChannel) -> None:
        await _antinuke_bump(channel.guild, "Channel Create")
        await audit(channel.guild, "channels", "e4", "📡 Channel bana",
                    f"**#{channel.name}** bana ({type(channel).__name__})")

    @commands.Cog.listener()
    async def on_guild_channel_delete(self, channel: discord.abc.GuildChannel) -> None:
        await _antinuke_bump(channel.guild, "Channel Delete")
        await audit(channel.guild, "channels", "e4", "🗑️ Channel delete",
                    f"**#{channel.name}** delete hua")
        if _restore_wanted(channel.guild.id, "Channels"):
            note = await _restore_deleted_channel(channel.guild, channel)
            await audit(channel.guild, "channels", "e4", "♻️ Channel restore", note)

    @commands.Cog.listener()
    async def on_guild_role_create(self, role: discord.Role) -> None:
        await _antinuke_bump(role.guild, "Role Create")
        await audit(role.guild, "roles", "e3", "💫 Role bana", f"**{role.name}** bana")

    @commands.Cog.listener()
    async def on_guild_role_delete(self, role: discord.Role) -> None:
        await _antinuke_bump(role.guild, "Role Delete")
        await audit(role.guild, "roles", "e3", "🗑️ Role delete",
                    f"**{role.name}** delete hua")
        if _restore_wanted(role.guild.id, "Roles"):
            note = await _restore_deleted_role(role.guild, role)
            await audit(role.guild, "roles", "e3", "♻️ Role restore", note)

    @commands.Cog.listener()
    async def on_member_role_add(self, member: discord.Member, roles: list[discord.Role]) -> None:
        # Sirf khatarnak permissions wale role dene par count (reaction-role
        # jaise routine role dene par false ban nahi hona chahiye).
        dangerous = [r.name for r in roles
                     if any(getattr(r.permissions, f, False) for f in _DANGEROUS_PERM_FLAGS)]
        if dangerous:
            await _antinuke_bump(member.guild, "Permission Grant")
        names = ", ".join(r.mention for r in roles)
        extra = f" ⚠️ khatarnak: `{', '.join(dangerous)}`" if dangerous else ""
        await audit(member.guild, "roles", "e3", "➕ Role mila",
                    f"{member.mention} ko {names} mila{extra}")

    @commands.Cog.listener()
    async def on_guild_role_update(self, before: discord.Role, after: discord.Role) -> None:
        if before.permissions.value == after.permissions.value:
            return
        # Kisi role ko admin/permission de diya gaya (silent escalation)
        dangerous = _dangerous_added(before.permissions, after.permissions)
        if dangerous:
            await _antinuke_bump(after.guild, "Permission Grant")
        added = after.permissions.value & ~before.permissions.value
        names = [p[0] for p in discord.Permissions(added) if p[1]] or ["permission change"]
        flag = " ⚠️ **khatarnak**" if dangerous else ""
        await audit(after.guild, "roles", "e3", "✏️ Role edit",
                    f"**{after.name}** me permission badli: `{', '.join(names[:8])}`{flag}")

    @commands.Cog.listener()
    async def on_webhooks_update(self, channel: discord.abc.GuildChannel) -> None:
        await _antinuke_bump(channel.guild, "Webhook Create")
        await audit(channel.guild, "channels", "e4", "🪝 Webhook badla",
                    f"**#{getattr(channel, 'name', '?')}** me webhook create/update hua")

    @commands.Cog.listener()
    async def on_guild_channel_update(self, before: discord.abc.GuildChannel,
                                      after: discord.abc.GuildChannel) -> None:
        # permission overwrites ka mass badlav = lockdown/nuke ka pehla step
        if (before.overwrites == after.overwrites
                and before.name == after.name
                and getattr(before, "nsfw", None) == getattr(after, "nsfw", None)):
            return
        if _self_action(after.guild.id):
            # ye lockdown/restore/setup ka apna badlav hai — na count, na log
            return
        await _antinuke_bump(after.guild, "Channel Update")
        await audit(after.guild, "channels", "e4", "✏️ Channel edit",
                    f"**#{after.name}** me setting badli")

    @commands.Cog.listener()
    async def on_guild_update(self, before: discord.Guild, after: discord.Guild) -> None:
        await _antinuke_bump(after.guild, "Guild Update")
        changed = []
        if before.name != after.name:
            changed.append("naam")
        if before.verification_level != after.verification_level:
            changed.append("verification level")
        if before.explicit_content_filter != after.explicit_content_filter:
            changed.append("content filter")
        if before.icon != after.icon:
            changed.append("icon")
        await audit(after.guild, "channels", "e4", "🖥 Server setting badli",
                    "Badlav: " + (", ".join(changed) or "aur kuch") + " ⚠️")

    @commands.Cog.listener()
    async def on_voice_state_update(self, member: discord.Member, before: discord.VoiceState,
                                    after: discord.VoiceState) -> None:
        if before.channel == after.channel:
            return
        what = "join" if after.channel and not before.channel else (
            "leave" if before.channel and not after.channel else "move")
        await audit(member.guild, "voice", "e5", f"🔊 Voice {what}",
                    f"{member.mention} {what} — `{getattr(after.channel or before.channel, 'name', '?')}`")

    @commands.Cog.listener()
    async def on_member_ban(self, guild: discord.Guild, user: discord.User | discord.Member) -> None:
        await _antinuke_bump(guild, "Mass Ban")
        await audit(guild, "members", "e2", "🚫 Ban", f"**{user}** ban hua")

    @commands.Cog.listener()
    async def on_member_unban(self, guild: discord.Guild, user: discord.User) -> None:
        await audit(guild, "members", "e2", "✅ Unban", f"**{user}** unban hua")

    # ------------------------------------------------------------------
    # BOOSTS — boosterperks
    # ------------------------------------------------------------------
    @commands.Cog.listener()
    async def on_member_update(self, before: discord.Member, after: discord.Member) -> None:
        if before.premium_since == after.premium_since:
            return
        gid = after.guild.id
        boosted = after.premium_since is not None

        if is_on(gid, "boosterperks"):
            settings = cfg(gid, "boosterperks")
            role = resolve_role(after.guild, settings.get("role"))
            if role is not None:
                try:
                    if boosted and role not in after.roles:
                        await after.add_roles(role, reason="Booster perk")
                    elif not boosted and role in after.roles:
                        await after.remove_roles(role, reason="Boost khatam")
                except discord.HTTPException:
                    pass
            if boosted and settings.get("welcomeDM"):
                try:
                    perks = "\n".join(f"• {p}" for p in settings.get("perks") or [])
                    await after.send(
                        f"🔥 **{after.display_name}, shukriya server boost karne ke liye!**\n\n"
                        + (perks or "• Bober role mil gaya!")
                    )
                except discord.HTTPException:
                    pass

        await audit(after.guild, "boost", "e8",
                    "🔥 Boost" if boosted else "🖼 Unboost",
                    f"{after.mention} ne server {'boost' if boosted else 'unboost'} kiya")

    # ------------------------------------------------------------------
    # GIVEAWAYS — entry reactions
    # ------------------------------------------------------------------
    @commands.Cog.listener()
    async def on_raw_reaction_add(self, payload: discord.RawReactionActionEvent) -> None:
        if payload.guild_id is None or payload.user_id == (self.bot.user and self.bot.user.id):
            return
        posted = store.kv_get(f"giveaways:{payload.guild_id}") or {}
        hit = next((gid for gid, rec in posted.items()
                    if int(rec.get("msg") or 0) == payload.message_id), None)
        if hit is None:
            return
        if str(payload.emoji) != "🎉":
            return
        settings = cfg(payload.guild_id, "giveaways")
        giveaway = next((g for g in settings.get("active") or [] if str(g.get("id")) == hit), None)
        if giveaway is None:
            return
        guild = self.bot.get_guild(payload.guild_id)
        if guild is None:
            return

        required = resolve_role(guild, giveaway.get("requiredRole") or settings.get("requireRole"))
        if required is None:
            return

        member = guild.get_member(payload.user_id)
        if member is None or required in member.roles:
            return
        channel = guild.get_channel(payload.channel_id)
        if isinstance(channel, discord.TextChannel):
            try:
                msg = await channel.fetch_message(payload.message_id)
                await msg.remove_reaction(payload.emoji, member)
            except discord.HTTPException:
                pass
            try:
                await member.send(f"❌ **{giveaway.get('prize')}** me enter karne ke liye "
                                  f"{required.mention} chahiye.")
            except discord.HTTPException:
                pass


# ==========================================================================
# Feature-kaam (listener ke bahar)
# ==========================================================================
def build_join_dm(member: discord.abc.User | None, settings: dict[str, Any],
                  guild: discord.Guild | None = None) -> str:
    """Join DM ka asla text — `_send_join_dm`, dashboard preview aur
    'Send DM test' teeno yahi use karte hain (kahi text alag na ho)."""
    g = guild or getattr(member, "guild", None)
    text = str(settings.get("message") or "")

    # {rules} placeholder → rules channel ka link (Discord se copy jaisa)
    rules_url = ""
    if g is not None:
        ch = resolve_channel(g, settings.get("rulesChannel"))
        if ch is None:
            # dashboard ka mock id (c3) ya delete hua channel → naam se dhoondho
            for cand in g.text_channels:
                if cand.name.lower() in ("rules", "rules-and-info", "info", "📌rules"):
                    ch = cand
                    break
        if ch is not None:
            rules_url = f"https://discord.com/channels/{g.id}/{ch.id}"

    if "{rules}" in text:
        text = text.replace("{rules}", rules_url or "(rules channel set nahi hai — dashboard se chuno)")
    elif rules_url and settings.get("includeRules") and "discord.gg" not in text:
        # message me pehle se koi invite/rules link nahi hai tabhi jodo —
        # warna user ko do link milenge
        text = f"{text}\n📜 Rules: {rules_url}"

    body = fill(text, member=member, guild=g)
    title = str(settings.get("title") or "")
    if title:
        body = f"**{title}**\n\n{body}"
    return body


async def _send_join_dm(member: discord.Member, settings: dict[str, Any]) -> None:
    """Naye member ko DM bhejo — har join par (retry + asli wajah ke saath log)."""
    if getattr(member, "bot", False):
        return  # bots ke DM band hote hain — bekar me 3 attempt waste
    delay = max(0, int(settings.get("delay") or 0))
    if delay:
        await asyncio.sleep(delay)
    body = build_join_dm(member, settings)
    if not body.strip():
        log.info("join DM chhoda — message khali hai (member %s)", member.id)
        return
    retries = max(0, int(settings.get("retry") or 0))
    for attempt in range(retries + 1):
        try:
            msg = await member.send(body)
            log.info("join DM bheja -> %s (msg %s, attempt %d)",
                     member.id, msg.id, attempt + 1)
            return
        except discord.HTTPException as exc:
            if attempt >= retries:
                status = getattr(exc, "status", 0)
                if status == 403:
                    log.info("join DM fail -> %s: HTTP 403 — user ke DMs band hain "
                             "(Privacy & Safety me 'Allow DMs' off)", member.id)
                else:
                    log.warning("join DM fail -> %s: HTTP %s %s",
                                member.id, status, str(exc)[:140])
                return
            await asyncio.sleep(2)


async def _detect_inviter(guild: discord.Guild, member: discord.Member) -> str | None:
    if not is_on(guild.id, "invites"):
        return None
    try:
        current = await guild.invites()
    except discord.HTTPException:
        return None
    cached_raw = store.kv_get(f"invites:{guild.id}") or {}
    cached = {code: uses for code, uses in cached_raw.items()}
    found = None
    for invite in current:
        uses = invite.uses or 0
        if cached.get(invite.code, -1) >= 0 and uses > cached.get(invite.code, 0):
            found = invite.code
            break
    store.kv_set(f"invites:{guild.id}", {i.code: i.uses or 0 for i in current}, save=False)

    if found:
        store.kv_update(f"invite_src:{guild.id}", {str(member.id): found})
        await notify(guild, "invites", "🔗 Invite source",
                     f"{member.mention} **`{found}`** se aaye.", 0x1ABC9C)
    return found


# --------------------------- automod -------------------------------------
def _mentions_over(content: str, mentions: int) -> bool:
    return len(re.findall(r"<@(?:!?\d+)>", content)) > mentions


def _caps_ratio(text: str) -> float:
    letters = [ch for ch in text if ch.isalpha()]
    if len(letters) < 12:
        return 0.0
    upper = sum(1 for ch in letters if ch.isupper())
    return upper / max(1, len(letters))


async def _apply_punishment(member: discord.Member, action: str) -> None:
    low = action.lower()
    if "timeout" in low:
        match = re.search(r"(\d+)\s*m", low)
        minutes = int(match.group(1)) if match else 10
        try:
            await member.timeout(datetime.now(timezone.utc) + timedelta(minutes=minutes),
                                 reason="Automod")
        except discord.HTTPException:
            pass
    elif "kick" in low:
        try:
            await member.kick(reason="Automod")
        except discord.HTTPException:
            pass
    elif "ban" in low:
        try:
            await member.ban(reason="Automod", delete_message_seconds=0)
        except discord.HTTPException:
            pass


async def _automod(guild: discord.Guild, message: discord.Message) -> bool:
    """True = message pakad liya (delete/warn hua), aage kuch mat karo."""
    gid = guild.id
    if not is_on(gid, "automod"):
        return False
    settings = cfg(gid, "automod")
    content = message.content or ""
    if not content:
        return False

    for flt in settings.get("filters") or []:
        if not flt.get("on"):
            continue
        action = str(flt.get("action") or settings.get("action") or "delete")
        hit = False
        trigger = str(flt.get("trigger") or "").lower()
        words = [w.strip().lower() for w in str(flt.get("words") or "").split(",") if w.strip()]

        if words and any(re.search(rf"\b{re.escape(w)}\b", content.lower()) for w in words):
            hit = True
        elif "discord.gg" in trigger or "invite" in trigger:
            hit = bool(re.search(r"(?:discord\.gg|discord(?:app)?\.com/invite)/[\w-]+", content, re.I))
        elif "mention" in trigger:
            hit = _mentions_over(content, 5)
        elif "caps" in trigger:
            hit = _caps_ratio(content) > 0.7 and len(content) > 12
        elif trigger in ("url", "link"):
            hit = bool(re.search(r"https?://\S+", content, re.I)) and any(
                ext in content.lower() for ext in words)
        elif "unicode" in trigger:
            hit = bool(re.search(r"[҃-҉᪰-᫿⃐-⃿]", content))

        if not hit:
            continue

        try:
            await message.delete()
        except discord.HTTPException:
            pass
        if isinstance(message.author, discord.Member):
            await _apply_punishment(message.author, action)

        if "warn" in action.lower():
            try:
                await message.channel.send(
                    f"⚠️ {message.author.mention}, wo message allow nahi hai "
                    f"(**{flt.get('name')}** filter).", delete_after=5)
            except discord.HTTPException:
                pass

        await notify(guild, "automod", f"🚨 Automod: {flt.get('name')}",
                     f"{message.author.mention} ka message `{message.channel.mention}` me "
                     f"hataya.\n**Action:** {action}\n```{content[:400]}```", 0xE74C3C)
        return True

    return False


# --------------------------- scam ---------------------------------------
PHISH_HINTS = (
    "free-nitro", "nitro-free", "steamcommunlty", "steamcommunity.ru",
    "dscord", "discorcl", "dlscord", "nitro.gift", "grabnitro",
    "discord-activity", "epicfreegift", "claim-nitro",
)


async def _scam_check(guild: discord.Guild, message: discord.Message) -> bool:
    """True = scam pakad liya."""
    gid = guild.id
    if not is_on(gid, "scam"):
        return False
    settings = cfg(gid, "scam")
    content = (message.content or "").lower()
    if not content:
        return False

    reason = None
    urls = re.findall(r"https?://[^\s]+", content, re.I)
    has_link = "http" in content
    if settings.get("checkPhishing") and any(h in content for h in PHISH_HINTS):
        reason = "Phishing domain"
    elif has_link and settings.get("checkFreeNitro") and "nitro" in content and any(
            w in content for w in ("free", "giveaway", "gift")) and urls:
        reason = "Free Nitro scam"
    elif has_link and settings.get("checkImpersonation") and "discord" in content and any(
            w in content for w in ("/login", "token", "verify", "qr")) and urls:
        reason = "Discord impersonation"
    elif has_link and settings.get("checkGiveawayFake") and "giveaway" in content and "won" in content and urls:
        reason = "Fake giveaway link"
    elif has_link and settings.get("checkExternal") and any(
            u.lower().endswith((".exe", ".bat", ".apk", ".scr", ".zip")) for u in urls):
        reason = "Dangerous file link"
    if reason is None:
        return False

    try:
        await message.delete()
    except discord.HTTPException:
        pass
    if isinstance(message.author, discord.Member):
        action = str(settings.get("action") or "quarantine")
        if action == "ban":
            try:
                await message.author.ban(reason=f"Scam: {reason}", delete_message_seconds=0)
            except discord.HTTPException:
                pass
        else:
            try:
                await message.author.timeout(
                    datetime.now(timezone.utc) + timedelta(minutes=10),
                    reason=f"Scam: {reason}")
            except discord.HTTPException:
                pass

    if settings.get("alerts", True):
        await notify(guild, "scam", f"🛡️ Scam block: {reason}",
                     f"{message.author.mention} ka message `{message.channel.mention}` me block.\n"
                     f"```{(message.content or '')[:300]}```", 0xC0392B)
    return True


# --------------------------- autoresponder ------------------------------
def _matches(phrase: str, content: str, *, match_case: bool, wildcard: bool) -> bool:
    text = content if match_case else content.lower()
    needle = phrase if match_case else phrase.lower()
    if wildcard and ("*" in needle or "?" in needle):
        pattern = ".*".join(re.escape(part) for part in needle.split("*"))
        pattern = pattern.replace(re.escape("?"), ".")
        return re.search(pattern, text) is not None
    return needle in text


async def _autorespond(guild: discord.Guild, message: discord.Message) -> None:
    gid = guild.id
    if not is_on(gid, "autoresponder"):
        return
    settings = cfg(gid, "autoresponder")
    content = message.content or ""
    match_case = bool(settings.get("matchCase"))
    wildcard = bool(settings.get("useWildcard", True))

    for trigger in settings.get("triggers") or []:
        if not trigger.get("on"):
            continue
        if not _matches(str(trigger.get("phrase") or ""), content,
                        match_case=match_case, wildcard=wildcard):
            continue

        key = f"ar:{gid}:{message.channel.id}:{message.author.id}"
        last = float(store.kv_get(key) or 0)
        limit = max(0, int(settings.get("rateLimit") or 0))
        if limit and (discord.utils.utcnow().timestamp() - last) < limit:
            return
        store.kv_set(key, discord.utils.utcnow().timestamp(), save=False)

        response = fill(trigger.get("resp"), member=message.author, guild=guild)
        await _safe_send(message.channel, content=response,
                         reference=None if settings.get("dmOnMatch") else message)
        if settings.get("dmOnMatch"):
            try:
                await message.author.send(response)
            except discord.HTTPException:
                pass
        return


# --------------------------- counting ----------------------------------
def _counting_state(guild: discord.Guild, current: int, last_user: str) -> None:
    """Counter set karo — aur config me bhi likh do taaki dashboard live dikhe."""
    store.kv_set(f"counting:{guild.id}", {"current": current, "last_user": last_user},
                 save=False)
    store.set_module_cfg(guild.id, "counting", {"current": current})


async def _counting(guild: discord.Guild, message: discord.Message) -> None:
    gid = guild.id
    if not is_on(gid, "counting"):
        return
    settings = cfg(gid, "counting")
    channel = resolve_channel(guild, settings.get("channel"))
    if channel is None or channel.id != message.channel.id:
        return

    text = (message.content or "").strip()
    state = store.kv_get(f"counting:{gid}") or {}
    current = int(state.get("current") or settings.get("current") or 1)
    last_user = str(state.get("last_user") or "")

    if not text.isdigit():
        if settings.get("deleteWrong", True):
            try:
                await message.delete()
            except discord.HTTPException:
                pass
        return

    if settings.get("noDoubleCount") and last_user == str(message.author.id):
        if settings.get("deleteWrong", True):
            try:
                await message.delete()
            except discord.HTTPException:
                pass
            try:
                await message.channel.send(
                    f"❌ {message.author.mention} dobara count nahi kar sakte.",
                    delete_after=5)
            except discord.HTTPException:
                pass
        return

    if int(text) != current:
        if settings.get("resetOnError", True):
            _counting_state(guild, 1, "")
        if settings.get("deleteWrong", True):
            try:
                await message.delete()
            except discord.HTTPException:
                pass
            try:
                await message.channel.send(
                    f"❌ Sahi number **{current}** tha. {message.author.mention} "
                    f"dobara se 1 se shuru karo.", delete_after=5)
            except discord.HTTPException:
                pass
        return

    _counting_state(guild, current + 1, str(message.author.id))


# --------------------------- leveling ----------------------------------
def _level_for(xp: int, levels: list[dict[str, Any]]) -> int:
    best = 1
    for row in sorted(levels or [], key=lambda r: int(r.get("lvl") or 0)):
        if xp >= int(row.get("xp") or 0):
            best = max(best, int(row.get("lvl") or 1))
    return best


async def _leveling(guild: discord.Guild, message: discord.Message) -> None:
    gid = guild.id
    if not is_on(gid, "leveling"):
        return
    settings = cfg(gid, "leveling")
    if len(message.content or "") < max(0, int(settings.get("minMessageLength") or 4)):
        return
    if str(message.channel.id) in resolve_many(guild, settings.get("noXpChannels"), "ch"):
        return

    state = store.kv_get(f"xp:{gid}") or {}
    entry = dict(state.get(str(message.author.id)) or {})
    now = discord.utils.utcnow().timestamp()
    if now - float(entry.get("last") or 0) < max(1, int(settings.get("cooldown") or 60)):
        return

    lo, hi = (1, 6)
    raw = str(settings.get("xpPerMessage") or "1-6")
    if "-" in raw:
        try:
            lo, hi = [int(x) for x in raw.split("-", 1)]
        except ValueError:
            lo, hi = 1, 6
    gained = random.randint(min(lo, hi), max(lo, hi))

    old_xp = int(entry.get("xp") or 0)
    old_level = int(entry.get("level") or _level_for(old_xp, settings.get("levels")))
    new_xp = old_xp + gained
    new_level = _level_for(new_xp, settings.get("levels"))
    entry.update({"xp": new_xp, "level": new_level, "last": now, "msgs": int(entry.get("msgs") or 0) + 1})
    state[str(message.author.id)] = entry
    store.kv_set(f"xp:{gid}", state, save=False)

    if new_level > old_level:
        for reward in settings.get("roleRewards") or []:
            if not reward.get("on") or int(reward.get("level") or 0) != new_level:
                continue
            role = resolve_role(guild, reward.get("role"))
            if role is None:
                continue
            try:
                if isinstance(message.author, discord.Member):
                    await message.author.add_roles(role, reason=f"Level {new_level} reward")
            except discord.HTTPException:
                pass

        if settings.get("announceLevelUps"):
            channel = resolve_channel(guild, settings.get("channel")) or message.channel
            await _safe_send(
                channel,
                content=f"🌟 {message.author.mention} ne **Level {new_level}** "
                        f"pahunch liya! ({new_xp} XP)")


# --------------------------- antinuke -----------------------------------
# Har event ke liye audit-log action types (executor dhundhne ke liye).
# Ek se zyada tab jab ek event do tarah ki audit entry me aata hai.
# Bot ke apne likhe hue kaam (lockdown, unlock, restore, setup, panels) se
# apna hi anti-nuke trip na ho — ye window gateway latency ke liye hai.
_SELF_UNTIL: dict[int, float] = {}
# Alert flood rokne ke liye (per guild + instance + event): 10s me ek hi alert.
_ALERT_LAST: dict[tuple[int, str, str], float] = {}
_ALERT_COOLDOWN = 10.0


def mark_self_action(guild_id: int, seconds: float = 12.0) -> None:
    """Agle `seconds` tak is guild ke events ko apna maankar chhod do."""
    _SELF_UNTIL[guild_id] = time.time() + seconds


def _self_action(guild_id: int) -> bool:
    return _SELF_UNTIL.get(guild_id, 0.0) > time.time()


_AN_ACTION_MAP: dict[str, tuple[discord.AuditLogAction, ...]] = {
    "Channel Create": (discord.AuditLogAction.channel_create,),
    "Channel Delete": (discord.AuditLogAction.channel_delete,),
    "Role Create": (discord.AuditLogAction.role_create,),
    "Role Delete": (discord.AuditLogAction.role_delete,),
    "Mass Ban": (discord.AuditLogAction.ban,),
    "Mass Kick": (discord.AuditLogAction.kick,),
    "Bot Add": (discord.AuditLogAction.bot_add,),
    "Guild Update": (discord.AuditLogAction.guild_update,),
    "Channel Update": (discord.AuditLogAction.channel_update,),
    "Webhook Create": (discord.AuditLogAction.webhook_create,
                       discord.AuditLogAction.webhook_delete),
    "Permission Grant": (discord.AuditLogAction.member_role_update,
                         discord.AuditLogAction.role_update),
}


# Khatarnak permissions — inke add hone par hi "Permission Grant" count hote hain.
_DANGEROUS_PERM_FLAGS = (
    "administrator", "manage_guild", "manage_roles", "manage_channels",
    "ban_members", "kick_members", "manage_webhooks", "mention_everyone",
    "moderate_members",
)


def _dangerous_added(before: discord.Permissions, after: discord.Permissions) -> list[str]:
    return [f for f in _DANGEROUS_PERM_FLAGS
            if getattr(after, f, False) and not getattr(before, f, False)]


def _window_seconds(threshold: dict[str, Any]) -> int:
    raw = threshold.get("timeWindow") or threshold.get("window") or "10s"
    match = re.search(r"(\d+)", str(raw))
    return max(1, int(match.group(1))) if match else 10


def _rule_limit(threshold: dict[str, Any]) -> int:
    raw = threshold.get("threshold", threshold.get("limit"))
    try:
        return max(1, int(raw))
    except (TypeError, ValueError):
        return 999


def _punish_kind(threshold: dict[str, Any], settings: dict[str, Any]) -> str:
    """Rule/instance ka action (khaali ho to default). 'Log' = sirf alert."""
    raw = (str(threshold.get("action") or "").strip()
           or str(settings.get("defaultAction")
                  or settings.get("action") or "ban"))
    low = raw.lower()
    if low.startswith("log") or low in ("none", "off"):
        return "log"
    if low.startswith("timeout") or low.startswith("mute"):
        return "timeout"
    if low.startswith("warn"):
        return "warn"
    if low.startswith("kick"):
        return "kick"
    if "delete" in low:
        return "bandelete"
    if low == "lockdown":
        return "lockdown"
    return "ban"


def _protected_skip(actor: discord.User, member: discord.Member | None,
                    ctx: dict[str, Any]) -> str | None:
    """Whitelist/protected user ya role — unhe kabhi khud saza nahi dete."""
    users = {str(x) for x in (ctx.get("whitelistUsers") or [])} | \
            {str(x) for x in (ctx.get("protectedUsers") or [])}
    if str(actor.id) in users:
        return f"**{actor}** whitelist/protected user hai — chhoda gaya"
    if member is not None:
        roles = {str(x) for x in (ctx.get("whitelistRoles") or [])} | \
                {str(x) for x in (ctx.get("protectedRoles") or [])}
        hit = [r.name for r in getattr(member, "roles", []) if str(r.id) in roles]
        if hit:
            return f"**{actor}** ke paas protected role `{hit[0]}` hai — chhoda gaya"
        if ctx.get("whitelistAdmins", False) and member.guild_permissions.administrator:
            return f"**{actor}** admin hai (whitelist) — chhoda gaya"
    return None


async def _lockdown(guild: discord.Guild, ctx: dict[str, Any], reason: str) -> str:
    """Lockdown — sab text channels me @everyone ki writing band."""
    everyone = guild.default_role
    changed = 0
    for channel in guild.text_channels:
        try:
            mark_self_action(guild.id, 15)
            await channel.set_permissions(everyone, send_messages=False, reason=reason)
            changed += 1
        except discord.HTTPException:
            continue
    store.kv_set(f"lockdown:{guild.id}", {
        "on": True, "reason": reason,
        "t": discord.utils.utcnow().isoformat(),
        "minutes": int(ctx.get("lockdownMinutes") or 30),
    })
    return f"🔒 lockdown ON — {changed} text channels lock (dashboard se unlock karo)"


async def unlockdown(guild: discord.Guild) -> str:
    """Lockdown hatao — @everyone ka send overwrite wapas normal."""
    everyone = guild.default_role
    changed = 0
    for channel in guild.text_channels:
        try:
            perms = channel.overwrites_for(everyone)
            if perms.send_messages is False:
                perms.send_messages = None
                mark_self_action(guild.id, 15)
                await channel.set_permissions(everyone, overwrite=perms,
                                              reason="Anti-Nuke lockdown end")
                changed += 1
        except discord.HTTPException:
            continue
    store.kv_set(f"lockdown:{guild.id}", {"on": False})
    return f"🔓 lockdown hata — {changed} channels wapas normal"


async def _punish(guild: discord.Guild, actor: discord.User | None, kind: str,
                  reason: str, ctx: dict[str, Any]) -> str:
    """Executor par saza lagao — saza ka raw hasil (alert me yahi dikhta hai)."""
    if kind == "log":
        return "Log only — saza lagayi nahi"
    if actor is None:
        return "⚠️ executor pata nahi (audit log me entry nahi mili) — sirf alert gaya"

    me = guild.me
    if me is not None and actor.id == me.id:
        return "bot ka apna action tha — khud ko saza nahi denge"
    if guild.owner_id and actor.id == guild.owner_id:
        return f"**{actor}** server owner hai — Discord API owner ko ban nahi karne deti"

    # Members Intent off ho sakta hai (cache khaali) — whitelist check ke
    # liye ek baar API se member maang lo, fail ho to chalne do.
    member = guild.get_member(actor.id)
    if member is None:
        try:
            member = await guild.fetch_member(actor.id)
        except (discord.NotFound, discord.Forbidden, discord.HTTPException):
            member = None

    skip = _protected_skip(actor, member, ctx)
    if skip is not None:
        return skip

    # guild.ban / guild.kick User le leta hai — member cache ki zaroorat nahi
    # (purane code me `actor.kick()` tha jo User par exist hi nahi karta).
    try:
        if kind == "warn":
            try:
                await actor.send(f"⚠️ **Anti-Nuke warning** — {guild.name}\n{reason}")
            except discord.HTTPException:
                pass
            return f"**{actor}** ko warning di (DM)"
        if kind == "timeout":
            if member is None:
                return "⚠️ member nahi mila — timeout apply nahi hua"
            minutes = int(ctx.get("timeoutMinutes") or 15)
            until = discord.utils.utcnow() + timedelta(minutes=minutes)
            await member.timeout(until, reason=reason)
            return f"**{actor}** ko {minutes} minute timeout"
        if kind == "lockdown":
            return await _lockdown(guild, ctx, reason)
        if kind == "kick":
            await guild.kick(actor, reason=reason)
            return f"**{actor}** ko kick kar diya"
        if kind == "bandelete":
            await guild.ban(actor, reason=reason, delete_message_seconds=86400)
            return f"**{actor}** ko ban kar diya + 1 din ke message delete hue"
        await guild.ban(actor, reason=reason, delete_message_seconds=0)
        return f"**{actor}** ko ban kar diya"
    except discord.Forbidden:
        return ("❌ action fail — bot ko **Ban Members / Moderate Members** chahiye "
                "aur bot ki top role attacker se **upar** honi chahiye")
    except discord.HTTPException as exc:
        return f"❌ action fail (HTTP {exc.status})"


async def _antinuke_alert(guild: discord.Guild, ctx: dict[str, Any],
                          event_name: str, hits: int, seconds: int,
                          actor: discord.User | None, kind: str,
                          punished: str) -> None:
    """Alert — anti-nuke ka apna Alert Channel pehle, warna logging ka e7."""
    # Flood guard: same (guild, instance, event) par 10s me ek alert.
    cd = (guild.id, str(ctx.get("name")), event_name)
    now = time.time()
    if now - _ALERT_LAST.get(cd, 0.0) < _ALERT_COOLDOWN:
        logging.getLogger("antinuke").info(
            "alert cooldown skip: %s/%s", ctx.get("name"), event_name)
        return
    _ALERT_LAST[cd] = now

    body = (f"**{event_name}** — {hits} baar {seconds}s ke andar.\n"
            f"Instance: **{ctx.get('name') or 'Default'}**\n"
            f"Executor: {actor.mention if actor else 'pata nahi'}\n"
            f"Saza: **{kind.upper()}** → {punished}")
    channel = resolve_channel(guild, ctx.get("logChannel"))
    if channel is not None:
        embed = discord.Embed(title="🚨 Anti-Nuke trip", description=body,
                              colour=0xFF4757, timestamp=discord.utils.utcnow())
        embed.set_footer(text="APEX anti-nuke")
        await _safe_send(channel, embed=embed)
    else:
        await audit(guild, "antinuke", "e7", "🚨 Anti-Nuke trip", body)

    # UI ke mutabiq: alerts ON ho to owner ko DM bhi (best effort).
    if ctx.get("alerts", True) and guild.owner_id:
        try:
            owner = guild.get_member(guild.owner_id)
            if owner is None:
                owner = await guild.fetch_member(guild.owner_id)
            await owner.send(f"🚨 **Anti-Nuke trip — {guild.name}**\n{body}")
        except (discord.NotFound, discord.Forbidden, discord.HTTPException):
            pass


def antinuke_instances(guild_id: int) -> list[dict[str, Any]]:
    """Is guild ki saari Anti-Nuke instances (har instance apna config)."""
    raw = store.kv_get(f"nkinst:{guild_id}") or []
    return [x for x in raw if isinstance(x, dict)]


def save_antinuke_instances(guild_id: int, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    store.kv_set(f"nkinst:{guild_id}", items)
    return items


def _restore_wanted(guild_id: int, kind: str) -> bool:
    """kind = 'Channels' | 'Roles' — default module ya kisi instance ne ON kiya?"""
    legacy = cfg(guild_id, "antinuke")
    if legacy.get(f"restore{kind}"):
        return True
    return any(i.get("enabled") and i.get(f"restore{kind}")
               for i in antinuke_instances(guild_id))


async def _latest_audit(guild: discord.Guild, action: discord.AuditLogAction):
    try:
        async for entry in guild.audit_logs(limit=5, action=action):
            return entry
    except discord.HTTPException:
        return None
    return None


async def _restore_deleted_channel(guild: discord.Guild, deleted: Any) -> str:
    """Best-effort: delete hue channel ko audit-log ki details se wapas banao."""
    entry = await _latest_audit(guild, discord.AuditLogAction.channel_delete)
    target = getattr(entry, "target", None) if entry else None
    name = (getattr(target, "name", None) or getattr(deleted, "name", None)
            or "restored-channel")
    category = getattr(target, "category", None) or getattr(deleted, "category", None)
    overwrites = getattr(target, "overwrites", None) or {}
    is_voice = isinstance(target, discord.VoiceChannel) or isinstance(deleted, discord.VoiceChannel)
    try:
        mark_self_action(guild.id, 15)
        if is_voice:
            created = await guild.create_voice_channel(
                name, category=category, overwrites=overwrites,
                reason="Anti-Nuke: deleted channel restore")
        else:
            created = await guild.create_text_channel(
                name, category=category, overwrites=overwrites,
                reason="Anti-Nuke: deleted channel restore")
        return f"♻️ **{created.mention}** wapas bana"
    except discord.HTTPException as exc:
        return f"♻️ restore fail: `#{name}` (HTTP {exc.status})"


async def _restore_deleted_role(guild: discord.Guild, deleted: Any) -> str:
    """Best-effort: delete role wapas banao (members par wapas lagana padega)."""
    entry = await _latest_audit(guild, discord.AuditLogAction.role_delete)
    target = getattr(entry, "target", None) if entry else None
    name = (getattr(target, "name", None) or getattr(deleted, "name", None)
            or "restored-role")
    if getattr(target, "is_default", lambda: False)():
        return "♻️ @everyone delete nahi ho sakta"
    try:
        created = await guild.create_role(
            name=name,
            permissions=getattr(target, "permissions", discord.Permissions.none()),
            colour=getattr(target, "colour", discord.Colour.default()),
            hoist=getattr(target, "hoist", False),
            mentionable=getattr(target, "mentionable", False),
            reason="Anti-Nuke: deleted role restore",
        )
        return f"♻️ role **@{created.name}** wapas bana (members dobara lagao)"
    except discord.HTTPException as exc:
        return f"♻️ restore fail: `@{name}` (HTTP {exc.status})"


def _rule_contexts(gid: int, legacy: dict[str, Any],
                   event_name: str) -> list[tuple[str, dict, dict]]:
    """(counter key, rule, context) — default rules + har enabled instance."""
    out: list[tuple[str, dict, dict]] = []

    for t in legacy.get("thresholds") or []:
        if t.get("on") and str(t.get("event")) == event_name:
            out.append((f"nk:{gid}:{event_name}", t, {
                "name": "Default rules", "instance": "default",
                "logChannel": legacy.get("logChannel"),
                "alerts": legacy.get("alerts", True),
                # default FALSE — sirf owner safe hai, admin ko bhi saza milti hai
                "whitelistAdmins": legacy.get("whitelistAdmins", False),
                "whitelistUsers": legacy.get("whitelistUsers") or [],
                "whitelistRoles": legacy.get("whitelistRoles") or [],
                "protectedUsers": legacy.get("protectedUsers") or [],
                "protectedRoles": legacy.get("protectedRoles") or [],
                "timeoutMinutes": legacy.get("timeoutMinutes"),
                "defaultAction": legacy.get("action"),
            }))

    for inst in antinuke_instances(gid):
        if not inst.get("enabled"):
            continue
        if inst.get("guildId") and str(inst.get("guildId")) != str(gid):
            continue
        for r in inst.get("rules") or []:
            ev = str(r.get("event") or r.get("eventType") or "")
            if r.get("enabled", True) and ev == event_name:
                ctx = dict(inst)
                ctx.setdefault("alerts", True)
                out.append((f"nki:{gid}:{inst.get('id')}:{event_name}", r, ctx))
    return out


async def _evaluate_rule(guild: discord.Guild, event_name: str, key: str,
                         rule: dict[str, Any], ctx: dict[str, Any]) -> None:
    """Count karo → limit par trip → executor → saza → incident → alert."""
    seconds = _window_seconds(rule)
    limit = _rule_limit(rule)
    now = discord.utils.utcnow().timestamp()
    hits = [t for t in (store.kv_get(key) or []) if now - float(t) <= seconds]
    hits.append(now)
    store.kv_set(key, hits, save=False)

    # limit = "itne action hone par trip" (pehle limit+1 chahiye tha —
    # isliye dashboard me limit 3 likhne par bhi 4 delete par hi trip hota tha).
    if len(hits) < limit:
        return

    store.kv_set(key, [], save=False)
    actor = await _last_executor(guild, event_name, seconds)
    kind = _punish_kind(rule, ctx)
    reason = (f"Anti-Nuke [{ctx.get('name') or 'Default'}]: "
              f"{event_name} x{len(hits)} in {seconds}s")
    punished = await _punish(guild, actor, kind, reason, ctx)

    # incident history — dashboard ka "Security Incidents" isko dikhata hai
    log = store.kv_get(f"nklog:{guild.id}") or []
    log.insert(0, {
        "event": event_name, "hits": len(hits), "threshold": limit,
        "window": seconds, "instance": ctx.get("name") or "Default",
        "actor": str(actor) if actor else "?",
        "actorId": str(getattr(actor, "id", "")),
        "action": kind, "result": punished,
        "t": discord.utils.utcnow().isoformat(),
    })
    store.kv_set(f"nklog:{guild.id}", log[:25])
    logging.getLogger("antinuke").info(
        "TRIP [%s] %s x%d/%ss -> %s", ctx.get("name"), event_name,
        len(hits), seconds, punished)

    if ctx.get("alerts", True):
        await _antinuke_alert(guild, ctx, event_name, len(hits),
                              seconds, actor, kind, punished)


async def _antinuke_bump(guild: discord.Guild, event_name: str) -> None:
    gid = guild.id
    if not is_on(gid, "antinuke"):
        return
    if _self_action(gid):
        # ye badlav khud bot ne kiya (lockdown/restore/setup) — trip mat karo
        logging.getLogger("antinuke").debug(
            "self-action skip: %s guild=%s", event_name, gid)
        return
    for key, rule, ctx in _rule_contexts(gid, cfg(gid, "antinuke"), event_name):
        try:
            await _evaluate_rule(guild, event_name, key, rule, ctx)
        except Exception:  # noqa: BLE001 — ek rule fail ho to baaki chalte rahein
            logging.getLogger("antinuke").exception("rule fail: %s / %s",
                                                    ctx.get("name"), event_name)


async def _last_executor(guild: discord.Guild, event_name: str,
                         window: int = 15) -> discord.User | None:
    """Audit log me se is event ka karne wala dhoondho.

    Discord ka audit log thoda late aata hai — isliye 4 baar (0.7s gap)
    try karte hain aur sirf window ke andar ki entries maante hain.
    """
    actions = _AN_ACTION_MAP.get(event_name)
    if not actions:
        return None
    since = discord.utils.utcnow() - timedelta(seconds=window + 8)
    for attempt in range(4):
        for action in actions:
            try:
                async for entry in guild.audit_logs(limit=10, action=action):
                    if entry.created_at < since:
                        continue
                    if entry.user is None:
                        continue
                    return entry.user
            except discord.HTTPException:
                continue
        if attempt < 3:
            await asyncio.sleep(0.7)
    return None


# ==========================================================================
# Bahar se call hone wale kaam (web.py ke endpoints)
# ==========================================================================
async def preview(guild: discord.Guild, module_key: str) -> str:
    """Dashboard ka '🧪 Test on Discord' button — har module ka apna jawaab.

    Jo cheez asli me Discord par dikhti hai (panel, message, backup) wo
    bhejta hai; sirf stats wale modules summary embed bhejte hain.
    """
    gid = guild.id

    # ---- seedha action wale modules
    if module_key == "embedbuilder":
        return await send_embed(guild)
    if module_key == "memberbackup":
        info = await run_backup(guild)
        return f"backup ban gaya: {info['file']} ({info['size']}, {info['members']} members)"
    if module_key == "verification":
        await sync_guild(guild)
        panels = _panels(gid)
        mid = panels.get("verify_msg")
        ch = guild.get_channel(int(panels.get("verify_channel") or 0))
        q = panels.get("verify_q") or {}
        if mid and isinstance(ch, discord.TextChannel):
            alive = True
            try:
                await ch.fetch_message(int(mid))
            except (discord.NotFound, ValueError, discord.HTTPException):
                alive = False
            if alive:
                tip = (f" — aaj ka sawaal {q.get('a')}+{q.get('b')}, sahi option "
                       f"{int(q.get('a')) + int(q.get('b'))}" if q else "")
                return (f"✅ panel zinda hai #{ch.name}{tip}. Discord me wahi option "
                        f"dabao to role lagega. Naya panel chahiye to purana delete "
                        f"karke dobara Test.")
            mid = None
        gate = resolve_channel(guild, cfg(gid, "verification").get("gateChannel"))
        if isinstance(gate, discord.TextChannel):
            return (f"panel naya post ho gaya #{gate.name} — wahan sahi option dabao"
                    + (f" ({int(q.get('a')) + int(q.get('b'))} hona chahiye)" if q else ""))
        return ("⚠️ gateChannel TEXT channel nahi hai — dashboard se Gate Channel "
                "me text channel chuno (voice/category me panel nahi post hota)")
    if module_key in ("reactionroles", "customroles", "giveaways"):
        await sync_guild(guild)
        return "panels/giveaways sync hue — Discord me dekho"
    if module_key in ("customization", "servermgmt"):
        return await apply_guild_settings(guild, module_key) or "kuch badla nahi"
    if module_key == "stickymessages":
        from bot import refresh_stickies  # circular import se bachne ke liye andar

        count = await refresh_stickies(guild)
        return f"{count} sticky message post hue"
    if module_key == "tickets":
        channel_id = (store.guild_config(gid) or {}).get("panel_channel_id")
        channel = guild.get_channel(int(channel_id or 0))
        if isinstance(channel, discord.TextChannel):
            from bot import send_panel

            await send_panel(channel)
            return f"panel dobara bheja #{channel.name}"
        return "panel channel nahi mila — pehle Setup chalao"

    # ---- message bhejne wale modules
    settings = cfg(gid, module_key)
    if not is_on(gid, module_key):
        return "module OFF hai — pehle upar toggle on karo"

    channel = _find_channel(guild, settings)
    if channel is None and not _has_channel_field(settings):
        # aise modules (tracking, boosterperks, autoresponder...) ke paas
        # channel field hi nahi hota — test ke liye bot jahan bhej sake wahan
        channel = _fallback_channel(guild)
    if channel is None and module_key != "joindm":
        # Join DM ko kisi channel ki zaroorat hi nahi — wo seedha DM bhejta hai
        return "channel resolve nahi hua — dashboard se channel chuno"

    embed: discord.Embed | None = None
    text: str | None = None
    notes: list[str] = []

    if module_key == "welcome":
        me = guild.me
        wtype = str(settings.get("type") or "card")
        if wtype in ("card", "embed"):
            # asli join wala embed hi bhejo (image/thumbnail ke saath) — taaki
            # URL ka asli asar Discord par dikhe
            test_embed, enotes = await welcome_embed(guild, me, settings, extras="")
            if test_embed.title:
                test_embed.title = f"👋 **[TEST]** {test_embed.title}"
            else:
                test_embed.description = "👋 **[TEST]**\n" + (test_embed.description or "")
            embed = test_embed
            notes.extend(enotes)
        else:
            text = (f"👋 **[TEST]** "
                    f"{fill(settings.get('message'), member=me, guild=guild, count=guild.member_count)}")
    elif module_key == "farewell":
        me = guild.me
        text = fill(settings.get("message"), member=me, guild=guild, count=guild.member_count)
        text = f"👋 **[TEST]** {text}"
    elif module_key == "joindm":
        # ASLI DM bhejo — owner ke DM me aa jayega, taaki tum khud delivery
        # dekh sako (naya account join karwane ki zaroorat nahi)
        target = guild.get_member(guild.owner_id) or guild.owner
        if target is None:
            try:  # members cache abhi bhara nahi hoga — REST se dhoondho
                target = await guild.fetch_member(guild.owner_id)
            except discord.HTTPException:
                target = None
        if target is None:
            return "DM target nahi mila — server owner ka member id resolve nahi hua"
        body = build_join_dm(target, settings, guild)
        try:
            msg = await target.send(f"👋 **[TEST]**\n{body}")
        except discord.HTTPException as exc:
            status = getattr(exc, "status", 0)
            if status == 403:
                return ("DM fail (HTTP 403) — tumhare DMs band hain: User Settings "
                        "→ Privacy & Safety → 'Allow direct messages from server "
                        "members' ON karo, phir dobara try karo")
            return f"DM fail: HTTP {status} {str(exc)[:120]}"
        who = getattr(target, "display_name", None) or str(target)
        return f"DM bheja -> {who} (msg {msg.id}) — apne DMs me dekho ✅"
    elif module_key == "automod":
        active = [f for f in settings.get("filters") or [] if f.get("on")]
        embed = discord.Embed(
            title="🚨 Automod — active filters",
            description="\n".join(f"• **{f.get('name')}** → {f.get('action')}"
                                  for f in active) or "koi filter ON nahi",
            colour=0xE74C3C)
        embed.add_field(name="Action (default)", value=str(settings.get("action")), inline=True)
    elif module_key == "scam":
        checks = [k for k in ("checkPhishing", "checkFreeNitro", "checkImpersonation",
                              "checkGiveawayFake", "checkExternal") if settings.get(k)]
        embed = discord.Embed(
            title="🛡️ Scam Protection — ON",
            description="\n".join(f"• {c}" for c in checks) or "koi check off",
            colour=0xC0392B)
        embed.add_field(name="Action", value=str(settings.get("action")), inline=True)
    elif module_key == "logging":
        active = [e for e in settings.get("events") or [] if e.get("on")]
        embed = discord.Embed(
            title="📄 Audit Logging — enabled events",
            description="\n".join(f"• {e.get('name')} ({e.get('sub')})"
                                  for e in active),
            colour=0x95A5A6)
        embed.set_footer(text="Yahi channel par sab logs aayenge")
    elif module_key == "counting":
        state = store.kv_get(f"counting:{gid}") or {}
        current = int(state.get("current") or settings.get("current") or 1)
        embed = discord.Embed(
            title="🔢 Counting",
            description=f"Agla sahi number: **{current}**",
            colour=0xF39C12)
    elif module_key == "leveling":
        state = store.kv_get(f"xp:{gid}") or {}
        top = sorted(state.items(), key=lambda kv: int((kv[1] or {}).get("xp") or 0), reverse=True)[:5]
        rows = []
        for uid, entry in top:
            member = guild.get_member(int(uid))
            rows.append(f"**{member.display_name if member else uid}** — "
                        f"Lv {entry.get('level')} ({entry.get('xp')} XP)")
        embed = discord.Embed(title="⭐ Leveling — leaderboard",
                              description="\n".join(rows) or "abhi kisi ne XP nahi kamaya",
                              colour=0xF1C40F)
        embed.add_field(name="XP/message", value=str(settings.get("xpPerMessage")), inline=True)
        embed.add_field(name="Cooldown", value=f"{settings.get('cooldown')}s", inline=True)
    elif module_key == "invites":
        cache = store.kv_get(f"invites:{gid}") or {}
        embed = discord.Embed(
            title="🔗 Invite tracking",
            description="\n".join(f"`{code}` → {uses} uses" for code, uses in list(cache.items())[:10])
                         or "cache khali — bot ko invite list chahiye",
            colour=0x1ABC9C)
    elif module_key == "tracking":
        counters = store.kv_get(f"tracking:{gid}") or {"joins": 0, "leaves": 0}
        embed = discord.Embed(
            title="📊 Join / Leave tracking",
            description=(f"Joins: **{counters.get('joins', 0)}**\n"
                         f"Leaves: **{counters.get('leaves', 0)}**\n"
                         f"Net: **{counters.get('joins', 0) - counters.get('leaves', 0)}**"),
            colour=0x2ECC71)
        embed.set_footer(text="Ye counter bot ke restart se nahi milta — session ka hisaab")
    elif module_key == "boosterperks":
        role = resolve_role(guild, settings.get("role"))
        embed = discord.Embed(
            title="🔥 Booster perks",
            description="\n".join(f"• {p}" for p in settings.get("perks") or [])
                         or "• Bober role",
            colour=0xE91E63)
        embed.add_field(name="Role", value=role.mention if role else "set nahi", inline=True)
    elif module_key == "autoresponder":
        active = [t for t in settings.get("triggers") or [] if t.get("on")]
        embed = discord.Embed(
            title="💬 Autoresponder — triggers",
            description="\n".join(f"• `{t.get('phrase')}` → {str(t.get('resp'))[:60]}"
                                  for t in active),
            colour=0x3498DB)
        embed.add_field(name="Match", value=str(settings.get("type")), inline=True)
    elif module_key == "antinuke":
        active = [t for t in settings.get("thresholds") or [] if t.get("on")]
        embed = discord.Embed(
            title="🛡️ Anti-Nuke thresholds (Default rules)",
            description="\n".join(f"• {t.get('event')}: {t.get('limit')}/{t.get('window')} "
                                  f"→ {t.get('action')}" for t in active)
                         or "koi default rule ON nahi",
            colour=0x8E44AD)
        # instances bhi dikhao — warna lagta hai sirf default rules chal rahe hain
        for inst in antinuke_instances(gid):
            rules = inst.get("rules") or []
            on = [r for r in rules if r.get("enabled", True)]
            sample = ", ".join(
                f"{r.get('event')} {r.get('threshold')}/{r.get('timeWindow')}→{r.get('action')}"
                for r in on[:4])
            value = (f"{len(on)}/{len(rules)} rules "
                     f"{'(instance ON)' if inst.get('enabled') else '(instance OFF)'}\n"
                     f"{sample}{' …' if len(on) > 4 else ''}") or "—"
            embed.add_field(
                name=f"🧩 {inst.get('name')} [{inst.get('id')}]",
                value=value[:1020], inline=False)
        embed.set_footer(
            text="Ban tabhi lagega jab executor owner/bot ke alawa ho — "
                 "abhi is server me sirf wahi do hain (tum owner + bot).")
    elif module_key == "overview":
        embed = discord.Embed(title="📊 APEX bot — overview",
                              colour=0x7C5CFF)
        embed.add_field(name="Guild", value=f"{guild.name} ({guild.member_count} members)", inline=True)
        embed.add_field(name="Channels", value=str(len(guild.text_channels)), inline=True)
        embed.add_field(name="Roles", value=str(len(guild.roles)), inline=True)
        st = store.stats(gid)
        embed.add_field(name="Tickets", value=f"{st['open']} open / {st['closed']} closed", inline=True)
    else:
        return f"**{module_key}** ka Discord action nahi hai (config module hai)."

    if embed is not None:
        message = await _safe_send(channel, embed=embed)
    else:
        message = await _safe_send(channel, content=text)
    if message is None:
        return "message bhejna fail hua (permission check karo)"
    out = f"#{channel.name} me bheja (msg {message.id})"
    if notes:
        out += " | " + " ; ".join(notes)
    return out


CHANNEL_FIELDS = ("channel", "logChannel", "targetChannel", "gateChannel", "dest",
                  "leaderboardChannel", "punishChannel", "rulesChannel", "panelChannel")


def _find_channel(guild: discord.Guild, settings: dict[str, Any]) -> discord.TextChannel | None:
    for field in CHANNEL_FIELDS:
        channel = resolve_channel(guild, settings.get(field))
        if channel is not None:
            return channel
    return None


def _has_channel_field(settings: dict[str, Any]) -> bool:
    return any(field in settings for field in CHANNEL_FIELDS)


def _fallback_channel(guild: discord.Guild) -> discord.TextChannel | None:
    """Panel channel, warna bot ki pehli bhejne-layak text channel."""
    panel_id = (store.guild_config(guild.id) or {}).get("panel_channel_id")
    channel = guild.get_channel(int(panel_id or 0))
    if isinstance(channel, discord.TextChannel):
        return channel
    me = guild.me
    for candidate in guild.text_channels:
        try:
            if me is None or candidate.permissions_for(me).send_messages:
                return candidate
        except discord.HTTPException:  # noqa: PERF203
            continue
    return None


async def apply_guild_settings(guild: discord.Guild, module_key: str) -> str | None:
    """Dashboard par save hote hi kuch modules ka asar turant lagao."""
    if not is_on(guild.id, module_key):
        return None  # module band hai to server ko chhuna hi nahi
    if module_key == "customization":
        # server profile (naam/description/channels) + bot ka naam — dono
        parts = [p for p in (
            await _apply_server_profile(guild, module_key),
            await _apply_bot_identity(guild),
        ) if p]
        return " ; ".join(parts) or None
    if module_key == "servermgmt":
        return await _apply_server_profile(guild, module_key)
    if module_key in ("verification", "reactionroles", "customroles", "giveaways"):
        await sync_guild(guild)
        return "panels synced"
    if module_key == "stickymessages":
        return None  # bot.py ka apna callback chalta hai
    if module_key == "tickets":
        # dashboard ki categories -> panel ke buttons (label/emoji/prefix sab)
        from bot import register_panel_keys, ticket_types  # circular import se bachne ke liye andar
        register_panel_keys(ticket_types(guild.id))
        return "ticket categories -> panel buttons sync (naya panel: Re-send Panel)"
    return None


_bot_username_applied: str | None = None  # is process me last global rename (429 se bachne ke liye)
_bot_assets_applied: dict[tuple[int, str], str] = {}  # (guild, key) -> last applied URL


async def _dl_image(url: str) -> tuple[bytes | None, str, str | None]:
    """Image download karke (data, mime, err) do — bot ki DP/banner upload ke liye."""
    ctype = "image/png"
    try:
        timeout = aiohttp.ClientTimeout(total=20)
        async with aiohttp.ClientSession(
            timeout=timeout,
            headers={"User-Agent": "Mozilla/5.0 (image-get)"},
        ) as sess:
            async with sess.get(url, allow_redirects=True) as resp:
                if resp.status >= 400:
                    return None, ctype, f"image khul nahi rahi (HTTP {resp.status})"
                ctype = (resp.headers.get("content-type") or "") \
                    .split(";")[0].strip().lower() or "image/png"
                data = await resp.read()
    except (aiohttp.ClientError, asyncio.TimeoutError, ValueError):
        return None, ctype, "image download fail (network/proxy ne roka)"
    if not ctype.startswith("image/"):
        return None, ctype, (f"ye image nahi hai — server de raha hai "
                             f"`{ctype}` (image/* chahiye)")
    if len(data) > 4 * 1024 * 1024:
        return None, ctype, f"image {len(data) // (1024 * 1024)}MB ki hai — 4MB se chhoti chahiye"
    return data, ctype, None


async def _apply_bot_identity(guild: discord.Guild) -> str | None:
    """Bot ki pehchan — dashboard se (Customization → Bot Identity).

    * ``botName``     → **is server** ka nickname (members ko yahi dikhta hai).
                        Khali = nickname hata do (Discord wala asli naam).
    * ``botUsername`` → poore Discord ka username (Discord limit: 2 badle/ghante,
                        isliye default khaali rakha hai — khali = mat chhoo).
    * ``botAvatar``   → bot ki **DP** — seedhi image URL ya server message link.
    * ``botBanner``   → profile **banner** — wahi rules.
    DP/banner me ``reset`` likhne par wapas Discord default (khali = mat chhoo).
    """
    global _bot_username_applied

    settings = cfg(guild.id, "customization")
    me = guild.me
    if me is None:
        return "bot identity: bot ka member cache me nahi hai"

    notes: list[str] = []
    http = getattr(getattr(me, "_state", None), "http", None)
    payload: dict[str, Any] = {}

    # --- 1) is server ka nickname (Discord limit: 32 character)
    want = " ".join(str(settings.get("botName") or "").split())[:32] or None
    if (me.nick or None) != want:
        try:
            await me.edit(nick=want)
            notes.append(f"bot nickname -> {want or '(asli naam)'}")
        except discord.HTTPException as exc:
            notes.append(f"bot nickname fail: HTTP {exc.status} — "
                         f"{str(exc)[:200]}".replace("\n", " "))

    # --- 2) global username. NOTE: Guild ke paas `.client` attribute hota hi
    #        nahi — wahi galat tha pehle. ClientUser.edit bhi andar yahi
    #        `http.edit_profile` (PATCH /users/@me) call karta hai.
    guser = " ".join(str(settings.get("botUsername") or "").split())[:32]
    if guser and guser != _bot_username_applied and guser != (me.name or ""):
        payload["username"] = guser

    # --- 3) DP + banner (sirf tabhi jab value badli ho — baar-baar upload nahi)
    for key, pkey, label in (("botAvatar", "avatar", "bot DP"),
                             ("botBanner", "banner", "bot banner")):
        raw = str(settings.get(key) or "").strip()
        if not raw or _bot_assets_applied.get((guild.id, key)) == raw:
            continue
        if raw.lower() == "reset":
            payload[pkey] = None
            continue
        url, why = await resolve_embed_image(guild, raw)
        if not url:
            notes.append(f"{label} skip: {why}")
            continue
        data, mime, err = await _dl_image(url)
        if err:
            notes.append(f"{label} skip: {err}")
            continue
        payload[pkey] = f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"

    # --- ek hi PATCH /users/@me (username + DP + banner saath me)
    if payload:
        if http is None:
            notes.append("bot profile: bot ka http session nahi mila")
        else:
            try:
                await http.edit_profile(payload)
                if "username" in payload:
                    _bot_username_applied = str(payload["username"])
                    notes.append(f"bot username -> {payload['username']}")
                for key, pkey, label in (("botAvatar", "avatar", "bot DP"),
                                         ("botBanner", "banner", "bot banner")):
                    if pkey in payload:
                        cur = str(settings.get(key) or "").strip()
                        _bot_assets_applied[(guild.id, key)] = cur
                        notes.append(
                            f"{label} -> " + ("Discord default (reset)"
                                              if payload[pkey] is None else "nayi image"))
            except discord.HTTPException as exc:
                hint = " (Discord limit: 2 badle/ghante — thodi der baad dobara)" \
                    if exc.status == 429 or "too fast" in str(exc).lower() else ""
                notes.append(f"bot profile fail: HTTP {exc.status}{hint} — "
                             f"{str(exc)[:220]}".replace("\n", " "))

    return " ; ".join(notes) or None


async def _apply_server_profile(guild: discord.Guild, module_key: str) -> str | None:
    settings = cfg(guild.id, module_key)
    kwargs: dict[str, Any] = {}

    if module_key == "customization":
        if settings.get("serverName"):
            kwargs["name"] = str(settings["serverName"])[:100]
        if settings.get("description") is not None:
            kwargs["description"] = str(settings.get("description") or "")[:300]
        for field, value in (
            ("system_channel", "systemChannel"),
            ("rules_channel", "rulesChannel"),
            ("public_updates_channel", "publicUpdates"),
        ):
            channel = resolve_channel(guild, settings.get(value))
            if channel is not None:
                kwargs[field] = channel
    else:
        # servermgmt — server profile (naam, description, verification, AFK)
        if module_key == "servermgmt" and settings.get("name"):
            kwargs["name"] = str(settings["name"])[:100]
        if settings.get("description") is not None:
            kwargs["description"] = str(settings.get("description") or "")[:300]

        channel = resolve_channel(guild, settings.get("afkChannel"))
        if channel is not None:
            kwargs["afk_channel"] = channel

        timeout = settings.get("afkTimeout")
        if timeout is not None:
            try:
                value = int(timeout)
                # Discord sirf yehi values maanta hai
                kwargs["afk_timeout"] = min({60, 300, 900, 1800, 3600},
                                            key=lambda allowed: abs(allowed - value))
            except (TypeError, ValueError):
                pass

        if settings.get("verificationLevel"):
            try:
                kwargs["verification_level"] = discord.VerificationLevel[
                    str(settings["verificationLevel"]).upper()]
            except KeyError:
                pass

        # notifications: page ka defaultNotifications channelPicker deta hai
        # (demo id c1) — wo yahan meaning nahi rakhta, sirf 'all'/'mentions'
        # jaise naam handle karo, warna mat chhoo.
        note = str(settings.get("defaultNotifications") or "").lower()
        if note in ("all", "all_messages"):
            kwargs["default_notifications"] = discord.NotificationLevel.all_messages
        elif note in ("mentions", "only_mentions"):
            kwargs["default_notifications"] = discord.NotificationLevel.only_mentions

    if not kwargs:
        return None
    try:
        await guild.edit(**kwargs)
    except discord.HTTPException as exc:
        return f"guild edit fail: {exc}"
    return "server profile updated: " + ", ".join(kwargs)


_MSG_LINK_RE = re.compile(
    r"^(?:https?://)?(?:ptb\.|canary\.)?discord(?:app)?\.com/channels/(@me|\d+)/(\d+)/(\d+)/?$",
    re.I,
)


async def resolve_embed_image(guild: discord.Guild, raw: Any) -> tuple[str | None, str | None]:
    """Embed ke image/thumbnail URL ko kaam karne wale URL me badlo.

    Returns (url | None, note). Kuch khaas cases:
      * Discord **message link** → us message ki pehli image (attachment/embed)
      * DM (`@me`) link         → bot usko padh nahi sakta (wajah ke saath None)
      * seedhi http(s) URL      → content-type `image/*` check; network fail
                                  ho to best effort (Discord khud bhi check karta hai)
    """
    url = str(raw or "").strip()
    if not url:
        return None, None

    m = _MSG_LINK_RE.match(url)
    if m:
        scope, ch_id, msg_id = m.group(1), int(m.group(2)), int(m.group(3))
        if scope == "@me":
            return None, ("DM message link hai — bot uska content padh nahi sakta "
                          "(kisi **server message** ka link ya seedhi image URL do)")
        channel = guild.get_channel(ch_id)
        if channel is None:
            try:
                channel = await guild.fetch_channel(ch_id)
            except (discord.NotFound, discord.Forbidden, discord.HTTPException):
                channel = None
        if channel is None:
            return None, "message wala channel bot ko mila nahi"
        try:
            msg = await channel.fetch_message(msg_id)
        except (discord.NotFound, discord.Forbidden, discord.HTTPException):
            return None, "message fetch nahi hua (delete ho gaya ya permission nahi)"
        for att in getattr(msg, "attachments", None) or []:
            if getattr(att, "url", None):
                return str(att.url), "message link se attachment image mili"
        for emb in getattr(msg, "embeds", None) or []:
            for cand in (getattr(getattr(emb, "image", None), "url", None),
                         getattr(getattr(emb, "thumbnail", None), "url", None)):
                if cand:
                    return str(cand), "message link se embed image mili"
        return None, "us message me koi image/attachment hi nahi hai"

    if not re.match(r"^https?://", url, re.I):
        return None, "image URL `http://` ya `https://` se shuru honi chahiye"

    try:
        timeout = aiohttp.ClientTimeout(total=6)
        async with aiohttp.ClientSession(
            timeout=timeout,
            headers={"User-Agent": "Mozilla/5.0 (image-check)"},
        ) as probe:
            async with probe.head(url, allow_redirects=True) as resp:
                if resp.status >= 400:
                    return None, f"URL khul hi nahi raha (HTTP {resp.status})"
                ctype = (resp.headers.get("content-type") or "").lower()
                if ctype and not ctype.startswith("image/"):
                    return None, (f"ye image URL nahi hai — server de raha hai "
                                  f"`{ctype.split(';')[0]}` (image/* chahiye)")
    except (aiohttp.ClientError, asyncio.TimeoutError, ValueError):
        pass  # network/proxy block → best effort, Discord khud validate kar lega
    return url, None


_EMOJI_CODE_RE = re.compile(r"<(a?):([\w-]{2,32}):(\d{5,})>")


async def _sync_embed_emojis(guild: discord.Guild, text: str) -> tuple[str, list[str]]:
    """Embed ke custom emoji ko IS server me laao — (naya_text, notes).

    Discord bot ko **bahar ke (external)** emoji render nahi karne deta:
    send karte hi `<a:naam:123>` chhod ke `:naam:` bana deta hai (verify
    kiya — config theek tha, Discord ne khud strip kiya). Isliye missing
    emoji ek baar CDN se utha kar server me upload karke ID badal dete hain.
    Ek baar upload hone ke baad hamesha ye nayi ID hi use hoti hai.
    """
    if not text or "<" not in text:
        return text, []
    codes = set(_EMOJI_CODE_RE.findall(str(text)))
    if not codes:
        return text, []

    notes: list[str] = []
    by_id = {str(e.id): e for e in guild.emojis}
    by_name = {e.name: e for e in guild.emojis}
    out = str(text)
    for anim, name, eid in sorted(codes):
        if eid in by_id:
            continue  # ye ID pehle se is server ka hai — Discord ko koi problem nahi
        target = by_name.get(name)
        if target is None:
            url = (f"https://cdn.discordapp.com/emojis/{eid}."
                   f"{'gif' if anim else 'png'}?size=48")
            try:
                timeout = aiohttp.ClientTimeout(total=15)
                async with aiohttp.ClientSession(timeout=timeout) as probe:
                    async with probe.get(url) as resp:
                        if resp.status != 200:
                            raise ValueError(f"CDN HTTP {resp.status}")
                        data = await resp.read()
                target = await guild.create_custom_emoji(
                    name=name, image=data,
                    reason="Embed emoji sync — external emoji Discord bot ko nahi dikhata")
                notes.append(f"emoji :{name}: server me upload hua")
            except Exception as exc:  # permission / limit / CDN — koi bhi wajah
                notes.append(f"emoji :{name}: upload fail ({type(exc).__name__}: {exc}) — "
                             f"Discord :{name}: hi dikha raha hai")
                continue
        local_anim = "a" if target.animated else ""
        out = out.replace(f"<{anim}:{name}:{eid}>",
                          f"<{local_anim}:{target.name}:{target.id}>")
    return out, notes


async def welcome_embed(guild: discord.Guild, member: discord.abc.User | None,
                        settings: dict[str, Any], extras: str = ""
                        ) -> tuple[discord.Embed, list[str]]:
    """Welcome/Farewell ka embed — EmbedBuilder ka **same logic**.

    * `type: card`  → cardTitle + cardSub (+ toggle wale extras) + footer
    * `type: embed` → welcome message (+ extras) description me
    * Image/Thumbnail → `resolve_embed_image` (seedhi `image/*` URL ya
      **server message link**; DM link / non-image par saaf Hinglish wajah
      note me chali jati hai)
    * Text → `_sync_embed_emojis` (external emoji server me upload)
    """
    wtype = str(settings.get("type") or "card")
    notes: list[str] = []

    async def sync(value: Any) -> str:
        if not value:
            return ""
        text, ns = await _sync_embed_emojis(guild, str(value))
        for n in ns:
            if n not in notes:
                notes.append(n)
        return text

    who = member or guild.me
    if wtype == "card":
        title = await sync(fill(settings.get("cardTitle"), member=who, guild=guild))
        desc = await sync(fill(settings.get("cardSub"), member=who, guild=guild))
    else:
        title = ""
        desc = await sync(fill(settings.get("message"), member=who, guild=guild,
                               count=guild.member_count))
    if extras:
        desc = f"{desc}\n\n{extras}" if desc else str(extras)

    embed = discord.Embed(title=title or None, description=desc or None,
                          colour=0x2ECC71)
    if wtype == "card":
        embed.set_footer(text=f"Welcome to {guild.name}")
    else:
        embed.set_footer(text=f"{guild.member_count} members")

    for key, setter in (("image", embed.set_image), ("thumbnail", embed.set_thumbnail)):
        raw = settings.get(key)
        if not raw:
            continue
        good, n = await resolve_embed_image(guild, raw)
        if good:
            setter(url=good)
            if n:
                notes.append(f"{key}: {n}")
        else:
            notes.append(f"{key} chhoda gaya — {n or 'invalid URL'}")
    return embed, notes


async def send_embed(guild: discord.Guild) -> str:
    """EmbedBuilder ka 'Send to Discord'."""
    settings = cfg(guild.id, "embedbuilder")
    channel = resolve_channel(guild, settings.get("targetChannel"))
    if channel is None:
        return ("targetChannel set nahi ya wo channel delete ho chuka hai "
                "— dashboard se channel chuno")

    # Discord ko title/description me se ek chahiye — fields bhi ho to 400 aata hai
    if not (settings.get("title") or settings.get("description")):
        return "embed me title ya description chahiye — warna Discord 400 deta hai"

    notes: list[str] = []

    def note(n: str) -> None:
        if n and n not in notes:
            notes.append(n)

    async def sync(value: Any) -> str:
        """Text me hue custom emoji ko server ke emoji me badal ke do."""
        if not value:
            return ""
        new_text, enotes = await _sync_embed_emojis(guild, str(value))
        for n in enotes:
            note(n)
        return new_text

    title = await sync(settings.get("title"))
    description = await sync(settings.get("description"))
    author = await sync(settings.get("author"))
    footer = await sync(settings.get("footer"))

    embed = discord.Embed(title=title or None,
                          description=description or None,
                          colour=_hex(settings.get("color")))
    if author:
        embed.set_author(name=author)

    for key, setter in (("image", embed.set_image), ("thumbnail", embed.set_thumbnail)):
        raw = settings.get(key)
        if not raw:
            continue
        good, n = await resolve_embed_image(guild, raw)
        if good:
            setter(url=good)
            if n:
                note(f"{key}: {n}")
        else:
            note(f"{key} chhoda gaya — {n or 'invalid URL'}")

    if footer:
        embed.set_footer(text=footer)
    for field in settings.get("fields") or []:
        if field.get("name") and field.get("value"):
            fname = await sync(field.get("name")) or str(field["name"])
            fvalue = await sync(field.get("value")) or str(field["value"])
            embed.add_field(name=fname[:256],
                            value=fvalue[:1024],
                            inline=bool(field.get("inline", True)))

    message = await _safe_send(channel, embed=embed)
    if message is None:
        return "message bhejna fail hua (permission/channel check karo)"
    out = f"sent in #{channel.name} (msg {message.id})"
    if notes:
        out += " | " + " ; ".join(notes)
    return out


async def run_backup(guild: discord.Guild) -> dict[str, Any]:
    """MemberBackup — server ka JSON snapshot banao."""
    settings = cfg(guild.id, "memberbackup")
    includes = settings.get("includes") or {}
    payload: dict[str, Any] = {
        "guild": {"id": guild.id, "name": guild.name},
        "taken_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    if includes.get("members", True):
        payload["members"] = [
            {"id": str(m.id), "name": str(m), "roles": [str(r.id) for r in m.roles]}
            for m in guild.members
        ]
    if includes.get("roles", True):
        payload["roles"] = [{"id": str(r.id), "name": r.name, "color": str(r.colour),
                             "permissions": r.permissions.value} for r in guild.roles]
    if includes.get("channels", True):
        payload["channels"] = [
            {"id": str(c.id), "name": c.name, "type": str(type(c).__name__),
             "position": c.position}
            for c in guild.channels
        ]
    if includes.get("bans", False):
        try:
            bans = await guild.bans()
            payload["bans"] = [{"id": str(b.user.id), "name": str(b.user)} for b in bans]
        except discord.HTTPException:
            payload["bans"] = []
    if includes.get("settings", True):
        payload["settings"] = {
            "name": guild.name, "description": guild.description,
            "member_count": guild.member_count, "owner_id": guild.owner_id,
        }

    folder = Path(config.DATA_DIR) / "backups"
    folder.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M")
    path = folder / f"{guild.id}_{stamp}.json"
    text = json.dumps(payload, indent=2, ensure_ascii=False)
    path.write_text(text, encoding="utf-8")

    # purane backups hata do
    keep = max(1, int(settings.get("keepBackups") or 10))
    old = sorted(folder.glob(f"{guild.id}_*.json"))
    for extra in old[:-keep]:
        try:
            extra.unlink()
        except OSError:
            pass

    size = f"{path.stat().st_size / 1024:.1f} KB"
    store.set_module_cfg(guild.id, "memberbackup", {
        "lastBackup": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"),
        "totalBackedUp": payload.get("settings", {}).get("member_count", guild.member_count),
        "size": size,
    })
    return {"ok": True, "file": path.name, "size": size,
            "members": len(payload.get("members", []))}


# ==========================================================================
# Register
# ==========================================================================
async def register(bot: commands.Bot) -> None:
    """Cog register karo — `add_cog` coroutine hai, isliye await zaroori hai.

    Bina await ke listeners kabhi attach nahi hote (discord.py chup-chaap
    RuntimeWarning dekar ignore kar deta hai) — matlab 22 modules rehte hi nahi.
    """
    global _BOT
    _BOT = bot
    await bot.add_cog(Features(bot))
