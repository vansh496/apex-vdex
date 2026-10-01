"""
APEX Discord Ticket Bot
=======================
Button se ticket create · category/type selection · claim · close + transcript
· auto permission overwrites · per-user ticket limit.

Run:  python bot.py
First time:  /setup  (server me chalao)
"""

from __future__ import annotations

import asyncio
import logging
import random
import re
import sys
from datetime import datetime, timedelta, timezone
from typing import Any

import discord
from discord import app_commands
from discord.ext import commands
from discord.ui import Button, Modal, Select, TextInput, View

import config
import transcripts
from storage import store

# Windows console cp1252 par emoji / → (arrow) chhapte hi crash ho jaata tha.
# Isliye stdout+stderr ko UTF-8 me daal dete hain — warna INTENTS_ERROR ka
# print hi nahi hota aur asli problem dikhti hi nahi.
if hasattr(sys.stdout, "reconfigure"):
    for _stream in (sys.stdout, sys.stderr):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except (ValueError, OSError):
            pass

# --------------------------------------------------------------------------
# Logging
# --------------------------------------------------------------------------
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL, logging.INFO),
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    handlers=[logging.FileHandler(config.LOG_FILE, encoding="utf-8"), logging.StreamHandler()],
    force=True,
)
log = logging.getLogger("ticketbot")

IST = timezone(timedelta(hours=5, minutes=30), "IST")
SUCCESS = 0x2ECC71
DANGER = 0xE74C3C
INFO = 0x3498DB
WARN = 0xF1C40F

MISSING_TOKEN = (
    "\n"
    "========================================================\n"
    "  Bot token missing!\n"
    "  `.env` file me likho:\n"
    "      DISCORD_TOKEN=apka-token-here\n"
    "  (Developer Portal > Bot > Reset Token)\n"
    "========================================================\n"
)


# ==========================================================================
# Helpers
# ==========================================================================
def ts(value: str | None) -> str:
    if not value:
        return "-"
    try:
        return datetime.fromisoformat(value).astimezone(IST).strftime("%d %b %Y, %I:%M %p IST")
    except ValueError:
        return value


def is_staff(member: discord.Member, guild_id: int) -> bool:
    if not isinstance(member, discord.Member):
        return False
    if member.guild_permissions.manage_channels:
        return True
    roles = {str(r.id) for r in store.guild_config(guild_id).get("staff_role_ids") or []}
    return any(str(r.id) in roles for r in member.roles)


def ticket_limit(guild_id: int) -> int:
    return int(store.guild_config(guild_id).get("max_open_tickets") or config.MAX_OPEN_TICKETS)


def channel_link(guild_id: int, channel_id: int) -> str:
    return f"https://discord.com/channels/{guild_id}/{channel_id}"


def mention(user_id: str | None) -> str:
    return f"<@{user_id}>" if user_id else "—"


# --------------------------------------------------------------------------
# Ticket types
#   Dashboard ki "Ticket Categories" = asli source. config.TICKET_TYPES
#   sirf defaults/fallback hai (purane tickets + jab dashboard khali ho).
# --------------------------------------------------------------------------
_FALLBACK_TYPE: dict[str, Any] = {
    "label": "Ticket",
    "emoji": "\U0001F3AB",
    "short": "ticket",
    "color": 0x7C5CFF,
    "category": "Tickets",
    "description": "Ticket kholo — detail me batao.",
    "subject_label": "Subject",
    "subject_placeholder": "Chhota sa topic likho",
    "details_label": "Details",
    "details_placeholder": "Poori detail likho",
}

_PANEL_TEMPLATE: dict[str, Any] = config.TICKET_TYPES.get("support") or _FALLBACK_TYPE
_PANEL_REGISTERED: set[str] = set()
_BOT: Any = None  # setup_hook me set hota hai — naye buttons register karne ke liye


def _slug(value: Any) -> str:
    """Channel prefix ko Discord-safe naam banao ('My Pfx' -> 'my-pfx')."""
    out = []
    for ch in str(value or "").lower():
        out.append(ch if (ch.isascii() and (ch.isalnum() or ch == "-")) else "-")
    slug = "".join(out)
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-")[:24].strip("-") or "ticket"


def ticket_types(guild_id: int | None) -> dict[str, dict[str, Any]]:
    """Dashboard categories = asli ticket types; khali ho to purane defaults.

    Har entry TICKET_TYPES jaisa full template hoti hai (modal fields wagarah) —
    label/emoji/short/color/category dashboard se aate hain.
    """
    try:
        cats = (store.module_cfg(guild_id, "tickets") or {}).get("categories") or []
    except Exception:  # noqa: BLE001
        cats = []
    if not isinstance(cats, list) or not cats:
        return dict(config.TICKET_TYPES)

    out: dict[str, dict[str, Any]] = {}
    for c in cats:
        if not isinstance(c, dict):
            continue
        key = str(c.get("id") or "").strip()
        label = str(c.get("label") or "").strip() or "Ticket"
        if not key:
            continue
        raw_color = c.get("color")
        try:
            color = int(str(raw_color).lstrip("#"), 16) if raw_color else _PANEL_TEMPLATE["color"]
        except ValueError:
            color = _PANEL_TEMPLATE["color"]
        out[key] = {
            **_PANEL_TEMPLATE,
            "label": label[:80],
            "emoji": str(c.get("emoji") or "").strip() or _PANEL_TEMPLATE["emoji"],
            "short": _slug(c.get("prefix")),
            "color": color,
            "category": str(c.get("cat") or "").strip() or label[:100],
            "description": str(c.get("description") or "").strip()
            or (label + " ka ticket — detail me batao."),
        }
    return out or dict(config.TICKET_TYPES)


def resolve_type(guild_id: int | None, type_key: str) -> dict[str, Any]:
    """Pehle dashboard, phir purane defaults — anjaan key par bhi kabhi na gire."""
    key = str(type_key or "")
    t = ticket_types(guild_id).get(key)
    if t:
        return t
    return config.TICKET_TYPES.get(key) or {**_FALLBACK_TYPE, "label": key or "Ticket"}


def all_panel_keys() -> list[str]:
    """Registration ke liye — defaults + har guild ke dashboard ids."""
    keys = list(config.TICKET_TYPES)
    try:
        for gid in list(store.modules):
            for k in ticket_types(int(gid)):
                if k not in keys:
                    keys.append(k)
    except Exception:  # noqa: BLE001
        pass
    return keys


def register_panel_keys(types: dict[str, dict[str, Any]] | None = None) -> None:
    """Dashboard par nayi category save -> uska button click ho sake."""
    if _BOT is None:
        return
    keys = list(types) if types is not None else all_panel_keys()
    new = [k for k in keys if k not in _PANEL_REGISTERED]
    if not new:
        return
    view = View(timeout=None)
    for key in new:
        view.add_item(TicketTypeButton(key))
    _BOT.add_view(view)
    _PANEL_REGISTERED.update(new)
    log.info("tickets: %d naya panel button register hua: %s", len(new), ", ".join(new))


def type_label(type_key: str, guild_id: int | None = None) -> str:
    cfg = resolve_type(guild_id, type_key)
    return f"{cfg['emoji']} {cfg['label']}"


def overwrites_for(guild: discord.Guild, opener: discord.Member, guild_id: int) -> dict:
    """@everyone ko deny, opener ko allow, staff roles ko full access."""
    gcfg = store.guild_config(guild_id)
    ow: dict = {
        guild.default_role: discord.PermissionOverwrite(view_channel=False, send_messages=False)
    }

    for role_id in gcfg.get("staff_role_ids") or []:
        role = guild.get_role(int(role_id))
        if role:
            ow[role] = discord.PermissionOverwrite(**config.STAFF_PERMISSION_FIELDS)

    support_role_id = gcfg.get("support_role_id")
    if support_role_id:
        support_role = guild.get_role(int(support_role_id))
        if support_role:
            ow[support_role] = discord.PermissionOverwrite(view_channel=True, send_messages=True)

    ow[opener] = discord.PermissionOverwrite(**config.USER_PERMISSION_FIELDS)
    ow[guild.me] = discord.PermissionOverwrite(**config.STAFF_PERMISSION_FIELDS)
    return ow


def ticket_embed(ticket: dict, guild_id: int, status: str = "open") -> discord.Embed:
    t_cfg = resolve_type(guild_id, ticket.get("type", ""))
    color = t_cfg.get("color", INFO)
    if status == "closed":
        color = DANGER

    embed = discord.Embed(
        title=f"{t_cfg.get('emoji', chr(127903))} Ticket #{ticket.get('number', 0):0{config.COUNTER_PAD}d} — {t_cfg.get('label', 'Ticket')}",
        color=color,
    )
    embed.add_field(name="Opened by", value=mention(ticket.get("user_id")), inline=True)
    embed.add_field(name="Claimed by", value=mention(ticket.get("claimed_by")), inline=True)
    embed.add_field(name="Status", value=status.title(), inline=True)
    embed.add_field(name="Subject", value=ticket.get("subject") or "-", inline=False)
    if ticket.get("details"):
        embed.add_field(name="Details", value=ticket["details"][:1024], inline=False)
    if status == "closed":
        embed.add_field(name="Closed by", value=ticket.get("closed_by", "system"), inline=True)
        embed.add_field(name="Closed at", value=ts(ticket.get("closed_at")), inline=True)
    embed.set_footer(text=f"ID: {ticket.get('channel_id')}")
    return embed


async def log_event(guild: discord.Guild, title: str, embed: discord.Embed) -> None:
    log_channel_id = store.guild_config(guild.id).get("log_channel_id")
    if not log_channel_id:
        return
    channel = guild.get_channel(int(log_channel_id))
    if not channel:
        return
    try:
        await channel.send(content=f"**{title}**", embed=embed)
    except discord.Forbidden:
        log.warning("Log channel %s me bot ki send permission nahi hai", log_channel_id)


# ==========================================================================
# Ticket creation
# ==========================================================================
async def create_ticket(
    guild: discord.Guild,
    user: discord.abc.User,
    type_key: str,
    subject: str,
    details: str,
) -> tuple[discord.TextChannel | None, str, bool]:
    gcfg = store.guild_config(guild.id)
    cats_map = gcfg.get("categories") or {}
    # purane type key (setup ke waqt ka) na mile to kisi ek category me chala
    # jaye — ticket khulna band na ho.
    cat_id = cats_map.get(type_key) or next(iter(cats_map.values()), None)
    category = guild.get_channel(int(cat_id)) if cat_id else None
    if category is None:
        return None, "Ticket system setup nahi hai — server me `/setup` chalayein.", False

    number = store.next_number(type_key)
    t_cfg = resolve_type(guild.id, type_key)
    name = f"{t_cfg['short']}-{number:0{config.COUNTER_PAD}d}"

    opener = guild.get_member(user.id) or user  # type: ignore[assignment]
    channel = await guild.create_text_channel(
        name=name,
        category=category,  # type: ignore[arg-type]
        overwrites=overwrites_for(guild, opener, guild.id),
        topic=f"Ticket #{number} | {user} | {t_cfg['label']}",
        reason=f"Ticket #{number} by {user}",
    )

    ticket = store.create_ticket(
        guild_id=guild.id,
        channel_id=channel.id,
        type_key=type_key,
        number=number,
        user=user,
        subject=subject,
        details=details,
    )
    ticket["guild_id"] = str(guild.id)

    msg = await channel.send(embed=ticket_embed(ticket, guild.id), view=TicketControlView())
    store.set_control_message(channel.id, msg.id)

    await log_event(
        guild,
        "🎫 Ticket Opened",
        discord.Embed(
            color=SUCCESS,
            description=(
                f"**{t_cfg['emoji']} {t_cfg['label']} #{number}** opened by {user}\n"
                f"{channel_link(guild.id, channel.id)}"
            ),
        ),
    )

    if config.DM_ON_OPEN:
        try:
            if not user.bot:
                await user.send(
                    embed=discord.Embed(
                        title=f"✅ Ticket #{number} created",
                        description=(
                            f"Aapka ticket ban gaya: {channel.mention}\n"
                            f"Staff jaldi reply karega — intezaar karein."
                        ),
                        color=SUCCESS,
                    )
                )
        except discord.Forbidden:
            pass
        except discord.HTTPException:
            pass

    return channel, f"✅ Ticket ban gaya: {channel.mention}", True


# ==========================================================================
# Views
# ==========================================================================
class PanelView(View):
    """Panel message ke buttons — guild ki dashboard categories se."""

    def __init__(self, guild: discord.Guild | None = None, keys: list[str] | None = None) -> None:
        super().__init__(timeout=None)
        if keys is None:
            keys = list(ticket_types(guild.id if guild else None))
        for key in keys:
            self.add_item(TicketTypeButton(key, guild))
        self.add_item(PanelSelect(guild))

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        return interaction.guild is not None


class TicketTypeButton(Button):
    def __init__(self, type_key: str, guild: discord.Guild | None = None) -> None:
        t_cfg = resolve_type(guild.id if guild else None, type_key)
        super().__init__(
            style=discord.ButtonStyle.primary,
            label=(t_cfg.get("label") or type_key)[:80],
            emoji=t_cfg.get("emoji") or None,
            custom_id=f"tk_new:{type_key}",
        )
        self.type_key = type_key

    async def callback(self, interaction: discord.Interaction) -> None:
        await handle_new_ticket(interaction, self.type_key)


class PanelSelect(Select):
    """Same flow, dropdown se."""

    def __init__(self, guild: discord.Guild | None = None) -> None:
        types = ticket_types(guild.id if guild else None)
        options = [
            discord.SelectOption(
                label=str(t.get("label") or key)[:100],
                value=key,
                description=str(t.get("description") or "Ticket kholo")[:100],
                emoji=t.get("emoji") or None,
            )
            for key, t in list(types.items())[:25]
        ]
        super().__init__(
            placeholder="Open a ticket...",
            custom_id="tk_select",
            options=options,
            min_values=1,
            max_values=1,
        )

    async def callback(self, interaction: discord.Interaction) -> None:
        await handle_new_ticket(interaction, self.values[0])


class TicketControlView(View):
    """Har ticket channel me — persistent (timeout=None)."""

    def __init__(self) -> None:
        super().__init__(timeout=None)
        self.add_item(ClaimButton())
        self.add_item(UnclaimButton())
        self.add_item(AddUserButton())
        self.add_item(CloseButton())

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        return True


class _BaseTicketAction(Button):
    kind = ""

    def __init__(self) -> None:
        styles = {
            "claim": (discord.ButtonStyle.success, "Claim", "\N{HANDSHAKE}"),
            "unclaim": (discord.ButtonStyle.secondary, "Unclaim", "\N{WAVING WHITE FLAG}"),
            "adduser": (discord.ButtonStyle.secondary, "Add User", "\N{BUST IN SILHOUETTE}"),
            "close": (discord.ButtonStyle.danger, "Close Ticket", "\N{LOCK}"),
        }
        style, label, emoji = styles[self.kind]
        super().__init__(style=style, label=label, emoji=emoji, custom_id=f"tk_{self.kind}")

    def _ticket(self, interaction: discord.Interaction) -> dict | None:
        return store.open_in_channel(interaction.channel_id)

    async def _deny(self, interaction: discord.Interaction, msg: str) -> None:
        if interaction.response.is_done():
            await interaction.followup.send(msg, ephemeral=True)
        else:
            await interaction.response.send_message(msg, ephemeral=True)

    async def callback(self, interaction: discord.Interaction) -> None:
        if self.kind == "claim":
            await self.do_claim(interaction)
        elif self.kind == "unclaim":
            await self.do_unclaim(interaction)
        elif self.kind == "adduser":
            await self.do_adduser(interaction)
        elif self.kind == "close":
            await self.do_close(interaction)

    # ------------------------------------------------------------------
    async def do_claim(self, interaction: discord.Interaction) -> None:
        if not is_staff(interaction.user, interaction.guild.id):  # type: ignore[union-attr]
            return await self._deny(interaction, "Sirf staff claim kar sakta hai.")
        ticket = self._ticket(interaction)
        if not ticket:
            return await self._deny(interaction, "Yeh ticket ab exist nahi karta.")
        if not store.claim(interaction.channel_id, interaction.user):  # type: ignore[arg-type]
            return await self._deny(
                interaction, f"Ye ticket pehle hi {mention(ticket.get('claimed_by'))} ne claim kar liya hai."
            )
        ticket["claimed_by"] = str(interaction.user.id)
        ticket["claimed_by_tag"] = str(interaction.user)
        await interaction.channel.set_topic(  # type: ignore[union-attr]
            f"Ticket #{ticket['number']} | {ticket.get('user_tag')} | Claimed by {interaction.user}"
        )
        await interaction.response.send_message(
            f"\N{HANDSHAKE} **{interaction.user}** ne ye ticket claim kar liya.",
            embed=ticket_embed(ticket, interaction.guild.id),  # type: ignore[union-attr]
        )
        if config.DM_ON_CLAIM:
            try:
                await interaction.user.send(  # type: ignore[union-attr]
                    embed=discord.Embed(
                        title="\N{HANDSHAKE} Aapka ticket claim hua",
                        description=f"{interaction.user} aapki help kar raha hai.",
                        color=SUCCESS,
                    )
                )
            except (discord.Forbidden, discord.HTTPException):
                pass

    async def do_unclaim(self, interaction: discord.Interaction) -> None:
        if not is_staff(interaction.user, interaction.guild.id):  # type: ignore[union-attr]
            return await self._deny(interaction, "Sirf staff unclaim kar sakta hai.")
        if not store.unclaim(interaction.channel_id):
            return await self._deny(interaction, "Ye ticket claimed nahi hai.")
        await interaction.response.send_message(
            f"\N{WAVING WHITE FLAG} {interaction.user} ne claim hata diya."
        )

    async def do_adduser(self, interaction: discord.Interaction) -> None:
        if not is_staff(interaction.user, interaction.guild.id):  # type: ignore[union-attr]
            return await self._deny(interaction, "Sirf staff user add kar sakta hai.")
        await interaction.response.send_modal(AddUserModal(interaction.channel_id))  # type: ignore[arg-type]

    async def do_close(self, interaction: discord.Interaction) -> None:
        guild = interaction.guild
        assert guild is not None
        ticket = self._ticket(interaction)
        if not ticket:
            return await self._deny(interaction, "Yeh ticket ab exist nahi karta.")
        staff = is_staff(interaction.user, guild.id)
        owner = str(interaction.user.id) == str(ticket.get("user_id"))
        if not (staff or owner):
            return await self._deny(interaction, "Sirf ticket owner ya staff close kar sakta hai.")
        await interaction.response.send_message(
            "Kya sach me ye ticket close karna hai?", view=ConfirmView(self.kind, interaction.channel_id), ephemeral=True
        )


class ClaimButton(_BaseTicketAction):
    kind = "claim"


class UnclaimButton(_BaseTicketAction):
    kind = "unclaim"


class AddUserButton(_BaseTicketAction):
    kind = "adduser"


class CloseButton(_BaseTicketAction):
    kind = "close"


class ConfirmView(View):
    def __init__(self, action: str, channel_id: int, reason: str | None = None) -> None:
        super().__init__(timeout=config.CLOSE_CONFIRM_TIMEOUT)
        self.action = action
        self.channel_id = channel_id
        self.reason = reason
        self.add_item(ConfirmYes(action, channel_id, reason))
        self.add_item(ConfirmNo())

    async def on_timeout(self) -> None:
        for child in self.children:
            if child.disabled is False:
                child.disabled = True
        try:
            await self.message.edit(content="Confirm nahi hua — ticket waise hi chal raha hai.", view=self)  # type: ignore[union-attr]
        except (discord.HTTPException, AttributeError):
            pass


class ConfirmYes(Button):
    def __init__(self, action: str, channel_id: int, reason: str | None = None) -> None:
        super().__init__(
            style=discord.ButtonStyle.danger,
            label="Haan, close karo",
            emoji="\N{WHITE HEAVY CHECK MARK}",
            custom_id=f"tk_confirm_{action}_{channel_id}",
        )
        self.action = action
        self.channel_id = channel_id
        self.reason = reason

    async def callback(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer()
        channel = interaction.guild.get_channel(self.channel_id)  # type: ignore[union-attr]
        ticket = store.open_in_channel(self.channel_id)
        if channel and ticket:
            await finalize_close(interaction.guild, channel, ticket, interaction.user, self.reason)  # type: ignore[arg-type]
        else:
            await interaction.followup.send("Ticket nahi mila.", ephemeral=True)


class ConfirmNo(Button):
    def __init__(self) -> None:
        super().__init__(
            style=discord.ButtonStyle.secondary,
            label="Nahi, rehne do",
            custom_id="tk_confirm_no",
        )

    async def callback(self, interaction: discord.Interaction) -> None:
        await interaction.response.edit_message(content="Theek hai — ticket waise hi chal raha hai.", view=None)


class AddUserModal(Modal):
    def __init__(self, channel_id: int) -> None:
        super().__init__(title="Ticket me user add karo", timeout=120)
        self.channel_id = channel_id
        self.user_input = TextInput(
            label="User ka ID ya mention",
            placeholder="123456789012345678",
            style=discord.TextStyle.short,
            required=True,
        )
        self.add_item(self.user_input)

    async def on_submit(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)
        raw = self.user_input.value.strip().strip("<@!>")
        try:
            user = await interaction.guild.fetch_member(int(raw))  # type: ignore[union-attr]
        except (ValueError, discord.NotFound):
            await interaction.followup.send("User nahi mila — sahi ID daalo.", ephemeral=True)
            return
        if user is None:
            await interaction.followup.send("User nahi mila — sahi ID daalo.", ephemeral=True)
            return
        store.add_participant(self.channel_id, user.id)
        try:
            await interaction.channel.set_permissions(user, **config.USER_PERMISSION_FIELDS)  # type: ignore[union-attr]
        except discord.Forbidden:
            pass
        await interaction.followup.send(f"Added {user.mention} is ticket.", ephemeral=True)


# ==========================================================================
# Close flow (transcript + delete)
# ==========================================================================
async def finalize_close(
    guild: discord.Guild,
    channel: discord.TextChannel,
    ticket: dict,
    closed_by: discord.abc.User,
    reason: str | None = None,
) -> None:
    transcript_path = None
    closed_at = datetime.now(IST).strftime("%d %b %Y, %I:%M %p IST")

    if config.SAVE_TRANSCRIPT:
        try:
            messages = [m async for m in channel.history(limit=None, oldest_first=True)]
            transcript_path = transcripts.save(ticket, messages, str(closed_by), reason)
        except Exception as exc:  # noqa: BLE001
            log.error("Transcript fail: %s", exc)

    closed = store.close(channel.id, closed_by=closed_by, reason=reason, transcript_path=str(transcript_path) if transcript_path else None)
    closed = closed or ticket

    await log_event(
        guild,
        "\N{LOCK} Ticket Closed",
        discord.Embed(
            color=DANGER,
            description=(
                f"**{type_label(ticket.get('type', ''), guild.id)} #{ticket.get('number', 0)}** closed by {closed_by}\n"
                f"Opener: {mention(ticket.get('user_id'))} • "
                f"Claimed: {mention(ticket.get('claimed_by'))}\n"
                f"Subject: {ticket.get('subject', '-')}\n"
                f"Closed at: {closed_at}"
                + (f"\nReason: {reason}" if reason else "")
            ),
        ),
    )

    if config.DM_ON_CLOSE:
        try:
            if not closed_by.bot:
                await closed_by.send(  # type: ignore[union-attr]
                    embed=discord.Embed(
                        title="\N{LOCK} Aapka ticket close ho gaya",
                        description=(
                            f"Ticket #{ticket.get('number', 0)} close kar diya gaya {closed_at}.\n"
                            "Agar issue solve nahi hua to naya ticket khol sakte ho."
                        ),
                        color=DANGER,
                    )
                )
        except (discord.Forbidden, discord.HTTPException):
            pass

    try:
        await channel.delete(reason=f"Ticket #{ticket.get('number', 0)} closed by {closed_by}")
    except discord.NotFound:
        pass
    except discord.Forbidden:
        log.warning("Cannot delete channel %s (missing perms)", channel.id)
        return

    store.forget(channel.id)


# ==========================================================================
# /new ticket flow
# ==========================================================================
async def handle_new_ticket(interaction: discord.Interaction, type_key: str) -> None:
    guild = interaction.guild
    if guild is None:
        return await interaction.response.send_message("Sirf server me kaam karta hai.", ephemeral=True)

    if not store.is_setup(guild.id):
        return await interaction.response.send_message(
            "Ticket system setup nahi hai. Server me `/setup` chalayein.", ephemeral=True
        )

    limit = ticket_limit(guild.id)
    open_tickets = store.open_for_user(guild.id, interaction.user.id)
    if len(open_tickets) >= limit:
        links = "\n".join(
            f"• {channel_link(guild.id, int(t['channel_id']))}" for t in open_tickets[:5]
        )
        return await interaction.response.send_message(
            f"Limit cross kar diya! Aapke paas max **{limit}** open ticket(s) hain:\n{links}\n"
            "Pehle koi close karo ya staff se help lo.",
            ephemeral=True,
        )

    await interaction.response.send_modal(TicketForm(type_key, guild.id))


class TicketForm(Modal):
    def __init__(self, type_key: str, guild_id: int | None = None) -> None:
        t_cfg = resolve_type(guild_id, type_key)
        super().__init__(title=f"{t_cfg['emoji']} {t_cfg['label']}"[:45], timeout=300)
        self.type_key = type_key
        self.subject = TextInput(
            label=t_cfg["subject_label"],
            placeholder=t_cfg["subject_placeholder"],
            style=discord.TextStyle.short,
            max_length=100,
            required=True,
        )
        self.details = TextInput(
            label=t_cfg["details_label"],
            placeholder=t_cfg["details_placeholder"],
            style=discord.TextStyle.paragraph,
            max_length=1500,
            required=True,
        )
        self.add_item(self.subject)
        self.add_item(self.details)

    async def on_submit(self, interaction: discord.Interaction) -> None:
        guild = interaction.guild
        if guild is None:
            return
        subject = self.subject.value.strip() or "No subject"
        details = self.details.value.strip()
        await interaction.response.defer(ephemeral=True)
        channel, msg, ok = await create_ticket(guild, interaction.user, self.type_key, subject, details)
        if not ok and channel is None:
            await interaction.followup.send(f"❌ {msg}", ephemeral=True)
        else:
            await interaction.followup.send(msg, ephemeral=True)


# ==========================================================================
# Bot
# ==========================================================================
class TicketBot(commands.Bot):
    def __init__(self) -> None:
        intents = discord.Intents.default()
        intents.message_content = config.INTENT_MESSAGE_CONTENT
        intents.members = config.INTENT_MEMBERS
        super().__init__(command_prefix="!", intents=intents)
        self._synced = False

    async def setup_hook(self) -> None:
        global _BOT
        _BOT = self
        # bot.start() ka retry (login block hone par) dobara invoke kar sakta
        # hai — cogs/views sirf EK baar register hon.
        if getattr(self, "_hooked", False):
            return
        self._hooked = True
        await self.add_cog(Commands(self))
        keys = all_panel_keys()
        self.add_view(PanelView(keys=keys))
        _PANEL_REGISTERED.update(keys)
        self.add_view(TicketControlView())

        # baaki 22 modules (welcome, automod, leveling, giveaways...)
        import features

        await features.register(self)
        self._features = features

        # state ko baar-baar flush karo (pehle sirf shutdown par save hota tha)
        self._autosave_task = asyncio.create_task(self._autosave())

        # NOTE: web server ab main() me login SE PEHLE start hota hai —
        # Render health check tab bhi pass hota hai jab Discord login
        # Cloudflare (429/1015) se block ho.

    async def _autosave(self) -> None:
        """Har 5 second par dirty state JSON me likh deta hai."""
        while not self.is_closed():
            await asyncio.sleep(5)
            try:
                store.save()
            except Exception as exc:  # noqa: BLE001
                log.warning("autosave failed: %s", exc)

    async def on_ready(self) -> None:
        if self._synced:
            log.info("Logged in as %s (id=%s)", self.user, self.user.id)
            return
        log.info("Logged in as %s (id=%s)", self.user, self.user.id)
        log.info("Guilds: %s", [(g.id, g.name) for g in self.guilds])
        if config.GUILD_ID:
            guild = discord.Object(id=config.GUILD_ID)
            await self.tree.sync(guild=guild)
            log.info("Synced commands to guild %s", config.GUILD_ID)
        else:
            synced = await self.tree.sync()
            log.info("Synced %d command(s) globally", len(synced))
        # sirf success ke baad — fail ho to reconnect par dobara try hoga
        self._synced = True

        import features

        for guild in self.guilds:
            # panels (verify / reactionroles / customroles / giveaway) wapas jodo
            try:
                await features.sync_guild(guild)
            except Exception:  # noqa: BLE001
                log.exception("feature sync fail in %s", getattr(guild, "name", "?"))
            # restart ke baad stickies wapas lao (persistOnRestart ON ho to)
            try:
                count = await refresh_stickies(guild, on_restart=True)
                if count:
                    log.info("sticky: %d message(s) wapas post hue in %s", count, guild.name)
            except Exception:  # noqa: BLE001
                log.exception("sticky refresh fail in %s", getattr(guild, "name", "?"))

    async def on_raw_message_delete(self, payload: discord.RawMessageDeleteEvent) -> None:
        """Kisi ne sticky delete kar diya -> 2 sec me wapas post kar do.

        RAW event use karte hain kyunki discord.py `message_delete` sirf tab
        dispatch karta hai jab message is session ke CACHE me ho — boot ke
        baad purana sticky kabhi cache me nahi hota, isliye handler chalta hi
        nahi tha. `raw_message_delete` hamesha aata hai.
        """
        if payload.guild_id is None or payload.message_id in _STICKY_DELETING:
            return
        if store.sticky_find_msg(payload.guild_id, payload.message_id) is None:
            return
        guild = self.get_guild(payload.guild_id)
        if guild is None:
            return
        log.info("sticky: post delete hua, %s sec me wapas aa raha hai", 2)
        await asyncio.sleep(2)
        try:
            await refresh_stickies(guild)
        except Exception:  # noqa: BLE001
            log.exception("sticky repost fail in %s", guild.name)

    async def on_error(self, event: str, *args, **kwargs) -> None:
        log.exception("Error in event %s", event)


# ==========================================================================
# Commands
# ==========================================================================
class Commands(commands.Cog):
    def __init__(self, bot: TicketBot) -> None:
        self.bot = bot

    # ------------------------------------------------------------------
    async def _find_ticket(self, guild_id: int, user: discord.Member) -> dict | None:
        items = store.open_for_user(guild_id, user.id)
        return items[0] if items else None

    # ------------------------------------------------------------------
    @app_commands.command(
        name="setup",
        description="Ticket system set up karo (categories, panel, log channel)",
    )
    @app_commands.default_permissions(manage_channels=True)
    @app_commands.describe(
        staff_role="Staff role — ticket manage karne wali",
        support_role="Optional: ye role har ticket me auto milegi",
        max_open="Ek user ke max open tickets (default 3)",
        confirm="Agar pehle se setup hai to confirm=True daalo",
    )
    @app_commands.choices(
        max_open=[app_commands.Choice(name=str(n), value=n) for n in (1, 2, 3, 5, 10)],
    )
    async def setup(
        self,
        interaction: discord.Interaction,
        staff_role: discord.Role,
        support_role: discord.Role | None = None,
        max_open: int = 3,
        confirm: bool = False,
    ) -> None:
        guild = interaction.guild
        assert guild is not None
        await interaction.response.defer(ephemeral=True)

        existing = store.guild_config(guild.id)
        if store.is_setup(guild.id) and not confirm:
            await interaction.followup.send(
                "Ticket system pehle se setup hai. Dobara chalana hai to `confirm=True` daalo.",
                ephemeral=True,
            )
            return

        try:
            summary = await run_setup(guild, staff_role, support_role, max_open)
        except discord.Forbidden:
            await interaction.followup.send(
                "❌ Bot ke paas channels/categories banane ki permission nahi hai.",
                ephemeral=True,
            )
            return

        await interaction.followup.send(
            f"✅ **Setup complete!**\n"
            f"• Panel channel: #{summary['panel_channel_name']}\n"
            f"• Log channel: #{summary['log_channel_name']}\n"
            f"• Staff role: {staff_role.mention}\n"
            f"• Max open tickets/user: {max_open}\n\n"
            f"Ab `#{summary['panel_channel_name']}` me ticket open karo.",
            ephemeral=True,
        )

    # ------------------------------------------------------------------
    @app_commands.command(name="panel", description="Panel message dobara bhejo")
    @app_commands.default_permissions(manage_channels=True)
    async def panel(self, interaction: discord.Interaction) -> None:
        guild = interaction.guild
        assert guild is not None
        panel_id = store.guild_config(guild.id).get("panel_channel_id")
        channel = guild.get_channel(int(panel_id)) if panel_id else None
        if not isinstance(channel, discord.TextChannel):
            return await interaction.response.send_message(
                "Panel channel nahi mila — `/setup` chalayein.", ephemeral=True
            )
        await send_panel(channel)
        await interaction.response.send_message("Panel bhej diya.", ephemeral=True)

    # ------------------------------------------------------------------
    @app_commands.command(name="addstaff", description="Ek aur staff role add karo")
    @app_commands.default_permissions(manage_channels=True)
    async def addstaff(self, interaction: discord.Interaction, role: discord.Role) -> None:
        guild = interaction.guild
        assert guild is not None
        store.add_staff_role(guild.id, role.id)
        await interaction.response.send_message(f"Added {role.mention} as staff.", ephemeral=True)

    @app_commands.command(name="removestaff", description="Staff role hata do")
    @app_commands.default_permissions(manage_channels=True)
    async def removestaff(self, interaction: discord.Interaction, role: discord.Role) -> None:
        guild = interaction.guild
        assert guild is not None
        if not store.remove_staff_role(guild.id, role.id):
            return await interaction.response.send_message("Ye role staff me nahi tha.", ephemeral=True)
        await interaction.response.send_message(f"Removed {role.mention}.", ephemeral=True)

    # ------------------------------------------------------------------
    @app_commands.command(name="tickets", description="Open tickets dekho (staff only)")
    @app_commands.default_permissions(manage_channels=True)
    async def tickets(self, interaction: discord.Interaction) -> None:
        guild = interaction.guild
        assert guild is not None
        items = store.open_tickets(guild.id)
        if not items:
            return await interaction.response.send_message("Abhi koi open ticket nahi hai.", ephemeral=True)
        lines = [
            f"{type_label(t['type'], guild.id)} **#{t['number']}** — {mention(t['user_id'])} • "
            f"claim: {mention(t.get('claimed_by'))} • {channel_link(guild.id, int(t['channel_id']))}"
            for t in items[:25]
        ]
        await interaction.response.send_message(
            f"**{len(items)} open ticket(s):**\n" + "\n".join(lines), ephemeral=True
        )

    @app_commands.command(name="stats", description="Ticket stats (staff only)")
    @app_commands.default_permissions(manage_channels=True)
    async def stats(self, interaction: discord.Interaction) -> None:
        guild = interaction.guild
        assert guild is not None
        s = store.stats(guild.id)
        lines = "\n".join(
            f"• {type_label(k, guild.id)}: {v}" for k, v in sorted(s["by_type"].items())
        )
        await interaction.response.send_message(
            f"**Ticket stats**\n"
            f"• Open: {s['open']}\n"
            f"• Unclaimed: {s['unclaimed']}\n"
            f"• Closed: {s['closed']}\n"
            f"• Total created: {s['total_numbers']}\n{lines}",
            ephemeral=True,
        )

    # ------------------------------------------------------------------
    @app_commands.command(name="claim", description="Ticket claim karo")
    async def claim(self, interaction: discord.Interaction, ticket: discord.Member | None = None) -> None:
        guild = interaction.guild
        assert guild is not None
        if not is_staff(interaction.user, guild.id):
            return await interaction.response.send_message("Sirf staff claim kar sakta hai.", ephemeral=True)

        if interaction.channel and store.open_in_channel(interaction.channel.id):
            target = store.open_in_channel(interaction.channel.id)
        elif ticket:
            target = await self._find_ticket(guild.id, ticket)
        else:
            return await interaction.response.send_message("Kis user ka ticket claim karna hai? Mention karo.", ephemeral=True)

        if not target:
            return await interaction.response.send_message("Koi open ticket nahi mila.", ephemeral=True)
        if not store.claim(int(target["channel_id"]), interaction.user):  # type: ignore[arg-type]
            return await interaction.response.send_message("Ye ticket pehle se claimed hai.", ephemeral=True)
        channel = guild.get_channel(int(target["channel_id"]))
        if channel:
            await channel.send(f"\N{HANDSHAKE} **{interaction.user}** ne ye ticket claim kiya.")
        await interaction.response.send_message("Claim ho gaya.", ephemeral=True)

    @app_commands.command(name="unclaim", description="Claim hata do")
    async def unclaim(self, interaction: discord.Interaction, ticket: discord.Member | None = None) -> None:
        guild = interaction.guild
        assert guild is not None
        if not is_staff(interaction.user, guild.id):
            return await interaction.response.send_message("Sirf staff unclaim kar sakta hai.", ephemeral=True)
        target = store.open_in_channel(interaction.channel.id) if interaction.channel else None
        if not target and ticket:
            target = await self._find_ticket(guild.id, ticket)
        if not target:
            return await interaction.response.send_message("Koi claimed ticket nahi mila.", ephemeral=True)
        store.unclaim(int(target["channel_id"]))
        channel = guild.get_channel(int(target["channel_id"]))
        if channel:
            await channel.send(f"\N{WAVING WHITE FLAG} {interaction.user} ne claim hata diya.")
        await interaction.response.send_message("Unclaim ho gaya.", ephemeral=True)

    # ------------------------------------------------------------------
    @app_commands.command(name="close", description="Ticket close karo (+transcript)")
    @app_commands.describe(ticket="Optional: jiska ticket close karna hai", reason="Optional close reason")
    async def close(
        self,
        interaction: discord.Interaction,
        ticket: discord.Member | None = None,
        reason: str | None = None,
    ) -> None:
        guild = interaction.guild
        assert guild is not None
        target = store.open_in_channel(interaction.channel.id) if interaction.channel else None
        if not target and ticket:
            target = await self._find_ticket(guild.id, ticket)
        if not target:
            return await interaction.response.send_message("Koi open ticket nahi mila.", ephemeral=True)
        staff = is_staff(interaction.user, guild.id)
        if not (staff or str(interaction.user.id) == str(target.get("user_id"))):
            return await interaction.response.send_message("Sirf owner ya staff close kar sakta hai.", ephemeral=True)

        channel = guild.get_channel(int(target["channel_id"]))
        if not isinstance(channel, discord.TextChannel):
            return await interaction.response.send_message("Ticket channel nahi mila.", ephemeral=True)
        await interaction.response.defer()
        await finalize_close(guild, channel, target, interaction.user, reason)
        await interaction.followup.send("Ticket close kar diya.", ephemeral=True)

    # ------------------------------------------------------------------
    @app_commands.command(name="new", description="Bina button ke ticket kholo")
    @app_commands.describe(type="Ticket type (type karte waqt suggestions aayenge)")
    async def new(self, interaction: discord.Interaction, type: str) -> None:
        await handle_new_ticket(interaction, type)

    @new.autocomplete("type")
    async def new_autocomplete(
        self, interaction: discord.Interaction, current: str
    ) -> list[app_commands.Choice[str]]:
        # choices guild ke hisaab se badalte hain — isliye static list nahi
        gid = interaction.guild.id if interaction.guild else None
        cur = (current or "").strip().lower()
        out: list[app_commands.Choice[str]] = []
        for key, t in ticket_types(gid).items():
            name = f"{t.get('emoji') or ''} {t.get('label') or key}".strip()[:100]
            if not cur or cur in name.lower() or cur in key.lower():
                out.append(app_commands.Choice(name=name, value=key))
            if len(out) >= 25:
                break
        return out


# ==========================================================================
# Panel renderer
# ==========================================================================
async def run_setup(
    guild: discord.Guild,
    staff_role: discord.Role,
    support_role: discord.Role | None = None,
    max_open: int = 3,
) -> dict:
    """Categories + log/panel channels banao, config save karo, panel bhejo.

    `/setup` slash command aur dashboard (`POST /api/setup`) dono yahi
    chalate hain — taaki dono taraf same cheez bane.
    """
    categories: dict[str, int] = {}
    for key, t_cfg in ticket_types(guild.id).items():
        name = t_cfg["category"]
        category = discord.utils.get(guild.categories, name=name)
        if category is None:
            category = await guild.create_category(name=name)
        categories[key] = category.id

    log_channel = discord.utils.get(guild.text_channels, name="ticket-logs")
    if log_channel is None:
        log_channel = await guild.create_text_channel(
            name="ticket-logs",
            topic="Har ticket open/close ka record yahan aayega",
        )
        await log_channel.set_permissions(guild.default_role, view_channel=False)

    panel_channel = discord.utils.get(guild.text_channels, name="create-ticket")
    if panel_channel is None:
        panel_channel = await guild.create_text_channel(name="create-ticket")
        await panel_channel.set_permissions(guild.default_role, view_channel=True, send_messages=False)

    store.save_guild_config(
        guild.id,
        {
            "staff_role_ids": [staff_role.id],
            "support_role_id": support_role.id if support_role else None,
            "panel_channel_id": panel_channel.id,
            "log_channel_id": log_channel.id,
            "categories": categories,
            "max_open_tickets": max_open,
        },
    )

    await send_panel(panel_channel)
    return {
        "panel_channel_id": panel_channel.id,
        "panel_channel_name": panel_channel.name,
        "log_channel_id": log_channel.id,
        "log_channel_name": log_channel.name,
        "categories": categories,
        "max_open_tickets": max_open,
        "staff_role_ids": [staff_role.id],
        "support_role_id": support_role.id if support_role else None,
        "is_setup": True,
    }


def build_panel_embed(guild_id: int) -> discord.Embed:
    gcfg = store.guild_config(guild_id)
    staff_ids = gcfg.get("staff_role_ids") or []
    staff_mentions = ", ".join(f"<@&{r}>" for r in staff_ids) or "Staff"
    embed = discord.Embed(
        title="\U0001F6E0 Support Tickets",
        description=(
            "Koi bhi problem ho — niche button dabakar ticket kholo.\n"
            "Staff jald reply karega."
        ),
        color=0x5865F2,
    )
    for key, t_cfg in ticket_types(guild_id).items():
        embed.add_field(
            name=f"{t_cfg['emoji']} {t_cfg['label']}",
            value=t_cfg["description"],
            inline=False,
        )
    embed.add_field(
        name="\u2139\ufe0f Rules",
        value=(
            f"• Har user ke paas max **{gcfg.get('max_open_tickets', config.MAX_OPEN_TICKETS)}** open ticket ho sakte hain\n"
            f"• {staff_mentions} — help karenge\n"
            "• Ticket close karne par poora chat transcript save ho jayega"
        ),
        inline=False,
    )
    embed.set_footer(text="APEX Ticket Bot")
    return embed


async def send_panel(channel: discord.TextChannel) -> discord.Message:
    # purane panel messages hata do
    async for msg in channel.history(limit=20):
        if msg.author.id == channel.guild.me.id and msg.embeds and msg.embeds[0].title and "Support Tickets" in msg.embeds[0].title:
            try:
                await msg.delete()
            except discord.HTTPException:
                pass
    return await channel.send(embed=build_panel_embed(channel.guild.id), view=PanelView(channel.guild))


# ==========================================================================
# Sticky messages
#   Dashboard ka "Sticky Messages" module yahan ASLI me chalta hai:
#   config me jo likha hai wahi Discord par post hota hai, delete ho to
#   wapas aata hai, restart ke baad bhi wapas aata hai.
# ==========================================================================
STICKY_KEY = "stickymessages"

# Hum khud jo purana post delete karte hain, uspar on_message_delete
# dubara refresh chalane ki zaroorat nahi — isliye suppress karte hain.
_STICKY_DELETING: set[int] = set()


def _sticky_cfg(guild_id: int) -> dict[str, Any]:
    return store.module_cfg(guild_id, STICKY_KEY) or {}


def _sticky_entries(guild_id: int) -> list[dict[str, Any]]:
    """Sirf ON aur khali-content wale stickies."""
    if not store.module_enabled(guild_id, STICKY_KEY, default=False):
        return []
    out: list[dict[str, Any]] = []
    for item in _sticky_cfg(guild_id).get("messages") or []:
        if isinstance(item, dict) and item.get("on") and str(item.get("content") or "").strip():
            out.append(item)
    return out


def _resolve_sticky_channel(guild: discord.Guild, raw: Any) -> discord.TextChannel | None:
    """Dashboard se aaya channel id -> asli TextChannel.

    Order: asli snowflake -> dashboard ki Server Mapping (`c1`, `c5` jesi
    demo slots) -> naam se dhoondho. Mapping features.py me hai, taaki har
    module ek hi jagah resolve kare.
    """
    import features

    return features.resolve_channel(guild, raw)


def _sticky_text(template: str, trigger: Any) -> str:
    who = getattr(trigger, "mention", None)
    return str(template).replace("{user}", who if who else "@everyone")


async def _send_sticky(
    channel: discord.TextChannel, entry: dict[str, Any], trigger: Any
) -> discord.Message | None:
    try:
        return await channel.send(_sticky_text(str(entry.get("content") or ""), trigger))
    except discord.Forbidden:
        log.warning("sticky: %s me bhejne ki permission nahi hai", channel.id)
    except discord.HTTPException as exc:
        log.warning("sticky: bhejna fail hua (%s)", exc)
    return None


async def _drop_sticky(guild: discord.Guild, sticky_id: str, record: dict[str, Any]) -> None:
    """Discord ka purana sticky post hatao + tracking se utaaro."""
    # Pehle untrack — warna apne delete par khud ka on_message_delete dobara
    # refresh chalata hai aur loop ban jaata hai.
    store.sticky_untrack(guild.id, sticky_id)

    channel = guild.get_channel(int(record.get("channel") or 0))
    if not isinstance(channel, discord.TextChannel):
        return
    try:
        message = await channel.fetch_message(int(record.get("msg") or 0))
    except (discord.NotFound, ValueError):
        return
    except discord.HTTPException:
        return

    _STICKY_DELETING.add(message.id)
    try:
        await message.delete()
    except discord.HTTPException:
        pass
    finally:
        _STICKY_DELETING.discard(message.id)


async def _sticky_is_fresh(
    channel: discord.TextChannel, record: dict[str, Any], template: str
) -> bool:
    """Purana post ab bhi zinda hai, sahi jagah hai aur wahi content hai?"""
    if str(record.get("channel")) != str(channel.id):
        return False
    if str(record.get("tpl")) != str(template):
        return False
    try:
        await channel.fetch_message(int(record.get("msg") or 0))
    except (discord.NotFound, ValueError):
        return False
    except discord.HTTPException:
        return True  # rate-limit wagarah — toda mat, agli baar theek hoga
    return True


async def refresh_stickies(
    guild: discord.Guild, *, trigger: Any = None, on_restart: bool = False
) -> int:
    """Config ke hisaab se Discord ko match karwata hai.

    Returns kitne naye post bane.
    """
    cfg = _sticky_cfg(guild.id)

    # module hi band hai -> agar "Delete when disabled" ON hai, sab hata do
    if not store.module_enabled(guild.id, STICKY_KEY, default=False):
        if cfg.get("create", True):
            for sid, rec in list(store.sticky_posts_for(guild.id).items()):
                await _drop_sticky(guild, sid, rec)
        return 0

    if on_restart and not cfg.get("persistOnRestart", True):
        return 0

    wanted = _sticky_entries(guild.id)
    wanted_ids = {str(item.get("id")) for item in wanted}
    tracked = store.sticky_posts_for(guild.id)
    posted = 0

    # 1) jo config se nikal gaye (band ya delete) — Discord se mita do
    for sid, rec in list(tracked.items()):
        if sid not in wanted_ids:
            await _drop_sticky(guild, sid, rec)

    # 2) jo chahiye — post, ya content/channel badla hai to dobara post
    for entry in wanted:
        sid = str(entry.get("id"))
        template = str(entry.get("content") or "")
        channel = _resolve_sticky_channel(guild, entry.get("channel"))
        if channel is None:
            log.warning(
                "sticky %s: channel %r resolve nahi hua (guild=%s)",
                sid, entry.get("channel"), guild.id,
            )
            continue

        record = tracked.get(sid)
        if record and await _sticky_is_fresh(channel, record, template):
            continue
        if record:
            await _drop_sticky(guild, sid, record)

        message = await _send_sticky(channel, entry, trigger)
        if message is not None:
            store.sticky_track(
                guild.id, sid,
                msg_id=message.id, channel_id=channel.id, template=template,
            )
            posted += 1

    return posted


# ==========================================================================
# Entry point
# ==========================================================================
INTENTS_ERROR = """
=========================================================================
  Privileged Intents chahiye — Developer Portal me enable karo:
  
  1.  https://discord.com/developers/applications
  2.  Apna application kholo
  3.  **Bot** section (left menu)
  4.  Neeche **Privileged Gateway Intents** kholo
  5.  **MESSAGE CONTENT INTENT** → ON  (transcripts ke liye zaroori)
  6.  **SERVER MEMBERS INTENT**   → ON  (Welcome + Join DM ke liye zaroori —
                                      warna naye member ka event aata hi nahi)
  
  7.  Save Changes dabao
  
  Agar chhoda rakhna hai to `.env` me:
       INTENT_MESSAGE_CONTENT=false   (transcripts me message text khali)
       INTENT_MEMBERS=false           (welcome + join DM bilkul band)
  likh do — bot chalega, par wo features kaam nahi karenge.
=========================================================================
"""


def main() -> None:
    if not config.TOKEN:
        print(MISSING_TOKEN)
        raise SystemExit(1)

    async def _amain() -> None:
        bot = TicketBot()

        # Web server PEHLE start — Render ka health check turant pass hota
        # hai, chahe Discord login Cloudflare (429/1015) se block hi kyun na
        # ho. Dashboard + OAuth isi se chalte hain; bot connect hote hi
        # ticket/setup/panel sab live ho jayenge.
        if config.WEB_ENABLED:
            import web as webmod

            webmod.set_callbacks(
                close=finalize_close,
                setup=run_setup,
                panel=send_panel,
                sticky=refresh_stickies,
            )
            await webmod.start(bot)

        # Discord ka Cloudflare kabhi-kabhi datacenter IP ka login rate-limit
        # kar deta hai (429 + error1015 HTML) — ruk-ruk ke dobara try karte
        # hain; block utarte hi bot apne aap connect ho jayega.
        delay = 20.0
        attempt = 0
        while True:
            attempt += 1
            try:
                await bot.start(config.TOKEN)
                return
            except discord.LoginFailure:
                print("❌ Token galat hai. Developer Portal se naya token copy karo.")
                return
            except discord.PrivilegedIntentsRequired:
                print(INTENTS_ERROR)
                raise SystemExit(1)
            except (discord.HTTPException, OSError) as exc:
                first = (str(exc).splitlines() or [repr(exc)])[0][:150]
                print(f"⏳ attempt {attempt}: {first} — {delay:.0f}s baad dobara")
                await asyncio.sleep(delay)
                # CF1015 sliding window hota hai — baar-baar hit karne se
                # limit khud extend hoti rehti hai. Thode quick retries ke
                # baad30 minute ka sukoon — window clear ho sake.
                delay = min(delay * 2, 1800.0)

    try:
        asyncio.run(_amain())
    except KeyboardInterrupt:
        print("\n👋 Bot band ho gaya.")
    finally:
        store.save()
        log.info("State saved to %s", config.STATE_FILE)


if __name__ == "__main__":
    main()
