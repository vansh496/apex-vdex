"""
JSON-backed persistence for the ticket bot.

Is project me SQLite nahi chahiye — saara state ek chhoti si JSON file me
rehta hai (`data/tickets.json`) aur har write atomic hai, taaki bot crash
ho jaaye to data na khoje.
"""

from __future__ import annotations

import json
import os
import tempfile
import threading
from datetime import datetime, timezone
from typing import Any

import config


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Store:
    """Thread-safe in-memory state + atomic JSON persistence."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self.tickets: dict[str, dict[str, Any]] = {}
        self.counters: dict[str, int] = {}
        self.guilds: dict[str, dict[str, Any]] = {}
        self.modules: dict[str, dict[str, Any]] = {}
        # Discord par post ho chuke sticky messages
        #   "guild_id:sticky_id" -> {"msg": str, "channel": str, "tpl": str}
        self.sticky_posts: dict[str, dict[str, Any]] = {}
        # Features ka runtime state — XP, counting, invite cache, backup info...
        self.kv: dict[str, Any] = {}
        self._dirty = False
        self.load()

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------
    def load(self) -> None:
        if not config.STATE_FILE.exists():
            return
        try:
            raw = json.loads(config.STATE_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            print(f"[storage] state file corrupt, backup bana raha hoon: {exc}")
            try:
                config.STATE_FILE.replace(config.STATE_FILE.with_suffix(".json.corrupt"))
            except OSError:
                pass
            return

        with self._lock:
            self.tickets = dict(raw.get("tickets") or {})
            self.counters = {k: int(v) for k, v in (raw.get("counters") or {}).items()}
            self.guilds = dict(raw.get("guilds") or {})
            # dashboard ke module settings: {guild: {module: {...}}}
            self.modules = dict(raw.get("modules") or {})
            self.sticky_posts = dict(raw.get("sticky_posts") or {})
            self.kv = dict(raw.get("kv") or {})

    def save(self) -> None:
        with self._lock:
            if not self._dirty:
                return
            payload = {
                "tickets": self.tickets,
                "counters": self.counters,
                "guilds": self.guilds,
                "modules": self.modules,
                "sticky_posts": self.sticky_posts,
                "kv": self.kv,
                "saved_at": now_iso(),
            }
            self._dirty = False

        config.STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        handle = tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            delete=False,
            dir=str(config.STATE_FILE.parent),
            prefix=".tickets-",
            suffix=".tmp",
        )
        try:
            with handle:
                json.dump(payload, handle, indent=2, ensure_ascii=False)
            os.replace(handle.name, config.STATE_FILE)
        except OSError as exc:
            print(f"[storage] save failed: {exc}")
            try:
                os.unlink(handle.name)
            except OSError:
                pass

    def touch(self) -> None:
        with self._lock:
            self._dirty = True

    # ------------------------------------------------------------------
    # Counters
    # ------------------------------------------------------------------
    def next_number(self, type_key: str) -> int:
        with self._lock:
            value = self.counters.get(type_key, 0) + 1
            self.counters[type_key] = value
            self._dirty = True
            return value

    # ------------------------------------------------------------------
    # Guild config
    # ------------------------------------------------------------------
    def guild_config(self, guild_id: int | None) -> dict[str, Any]:
        if not guild_id:
            return {}
        return self.guilds.get(str(guild_id)) or {}

    def is_setup(self, guild_id: int | None) -> bool:
        cfg = self.guild_config(guild_id)
        return bool(cfg.get("panel_channel_id")) and bool(cfg.get("categories"))

    def save_guild_config(self, guild_id: int, cfg: dict[str, Any]) -> None:
        with self._lock:
            self.guilds[str(guild_id)] = cfg
            self._dirty = True

    def update_guild_config(self, guild_id: int, **changes: Any) -> dict[str, Any]:
        with self._lock:
            cfg = dict(self.guilds.get(str(guild_id)) or {})
            cfg.update(changes)
            self.guilds[str(guild_id)] = cfg
            self._dirty = True
            return cfg

    def add_staff_role(self, guild_id: int, role_id: int) -> None:
        with self._lock:
            cfg = dict(self.guilds.get(str(guild_id)) or {})
            roles = list(cfg.get("staff_role_ids") or [])
            if role_id not in roles:
                roles.append(role_id)
            cfg["staff_role_ids"] = roles
            self.guilds[str(guild_id)] = cfg
            self._dirty = True

    def remove_staff_role(self, guild_id: int, role_id: int) -> bool:
        with self._lock:
            cfg = dict(self.guilds.get(str(guild_id)) or {})
            roles = list(cfg.get("staff_role_ids") or [])
            if role_id not in roles:
                return False
            roles.remove(role_id)
            cfg["staff_role_ids"] = roles
            self.guilds[str(guild_id)] = cfg
            self._dirty = True
            return True

    # ------------------------------------------------------------------
    # Tickets
    # ------------------------------------------------------------------
    def create_ticket(
        self,
        *,
        guild_id: int,
        channel_id: int,
        type_key: str,
        number: int,
        user,
        subject: str,
        details: str,
    ) -> dict[str, Any]:
        with self._lock:
            ticket = {
                "channel_id": str(channel_id),
                "guild_id": str(guild_id),
                "type": type_key,
                "number": number,
                "user_id": str(user.id),
                "user_tag": str(getattr(user, "name", user)),
                "user_display": str(getattr(user, "display_name", getattr(user, "name", user))),
                "subject": subject,
                "details": details,
                "claimed_by": None,
                "claimed_by_tag": None,
                "claimed_at": None,
                "status": "open",
                "created_at": now_iso(),
                "closed_at": None,
                "closed_by": None,
                "close_reason": None,
                "control_msg_id": None,
                "transcript_path": None,
                "participants": [str(user.id)],
            }
            self.tickets[str(channel_id)] = ticket
            self._dirty = True
            return ticket

    def get(self, channel_id: int | None) -> dict[str, Any] | None:
        if not channel_id:
            return None
        return self.tickets.get(str(channel_id))

    def set_control_message(self, channel_id: int, message_id: int) -> None:
        with self._lock:
            ticket = self.tickets.get(str(channel_id))
            if ticket:
                ticket["control_msg_id"] = str(message_id)
                self._dirty = True

    def claim(self, channel_id: int, staff) -> bool:
        with self._lock:
            ticket = self.tickets.get(str(channel_id))
            if not ticket or ticket.get("claimed_by"):
                return False
            ticket["claimed_by"] = str(staff.id)
            ticket["claimed_by_tag"] = str(staff)
            ticket["claimed_at"] = now_iso()
            self._dirty = True
            return True

    def unclaim(self, channel_id: int) -> bool:
        with self._lock:
            ticket = self.tickets.get(str(channel_id))
            if not ticket or not ticket.get("claimed_by"):
                return False
            ticket["claimed_by"] = None
            ticket["claimed_by_tag"] = None
            ticket["claimed_at"] = None
            self._dirty = True
            return True

    def add_participant(self, channel_id: int, user_id: int) -> None:
        with self._lock:
            ticket = self.tickets.get(str(channel_id))
            if not ticket:
                return
            members = list(ticket.get("participants") or [])
            if str(user_id) not in members:
                members.append(str(user_id))
                ticket["participants"] = members
                self._dirty = True

    def close(
        self,
        channel_id: int,
        *,
        closed_by,
        reason: str | None = None,
        transcript_path: str | None = None,
    ) -> dict[str, Any] | None:
        with self._lock:
            ticket = self.tickets.get(str(channel_id))
            if not ticket:
                return None
            ticket["status"] = "closed"
            ticket["closed_at"] = now_iso()
            ticket["closed_by"] = str(getattr(closed_by, "tag", closed_by)) if closed_by else "system"
            ticket["close_reason"] = reason
            ticket["transcript_path"] = transcript_path
            self._dirty = True
            return ticket

    def forget(self, channel_id: int) -> None:
        """Closed ticket ko history se hata deta hai (log channel me reh chuka hai)."""
        with self._lock:
            if self.tickets.pop(str(channel_id), None) is not None:
                self._dirty = True

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------
    def open_tickets(self, guild_id: int | None = None) -> list[dict[str, Any]]:
        items = [t for t in self.tickets.values() if t.get("status") == "open"]
        if guild_id:
            items = [t for t in items if t.get("guild_id") == str(guild_id)]
        return sorted(items, key=lambda t: t.get("created_at") or "")

    def open_for_user(self, guild_id: int | None, user_id: int) -> list[dict[str, Any]]:
        return [
            t
            for t in self.open_tickets(guild_id)
            if t.get("user_id") == str(user_id) or str(user_id) in (t.get("participants") or [])
        ]

    def open_in_channel(self, channel_id: int | None) -> dict[str, Any] | None:
        ticket = self.get(channel_id)
        if ticket and ticket.get("status") == "open":
            return ticket
        return None

    def stats(self, guild_id: int | None = None) -> dict[str, Any]:
        open_items = self.open_tickets(guild_id)
        closed = [
            t
            for t in self.tickets.values()
            if t.get("status") == "closed"
            and (not guild_id or t.get("guild_id") == str(guild_id))
        ]
        by_type: dict[str, int] = {}
        for ticket in open_items:
            by_type[ticket.get("type", "?")] = by_type.get(ticket.get("type", "?"), 0) + 1
        unclaimed = [t for t in open_items if not t.get("claimed_by")]
        return {
            "open": len(open_items),
            "closed": len(closed),
            "unclaimed": len(unclaimed),
            "by_type": by_type,
            "total_numbers": sum(self.counters.values()),
        }

    # ------------------------------------------------------------------
    # Dashboard module settings
    #   modules[guild_id][module_key] = {"enabled": bool, "cfg": {...}}
    # ------------------------------------------------------------------
    def _module_bucket(self, guild_id: int | None) -> dict[str, Any]:
        key = str(guild_id or "0")
        bucket = self.modules.get(key)
        if bucket is None:
            with self._lock:
                bucket = self.modules.setdefault(key, {})
        return bucket

    def module_enabled(self, guild_id: int | None, module_key: str, default: bool = True) -> bool:
        entry = self._module_bucket(guild_id).get(module_key)
        if not entry:
            return default
        return bool(entry.get("enabled", default))

    def set_module_enabled(self, guild_id: int | None, module_key: str, enabled: bool) -> bool:
        with self._lock:
            bucket = self._module_bucket(guild_id)
            entry = bucket.setdefault(module_key, {})
            changed = bool(entry.get("enabled")) != bool(enabled)
            entry["enabled"] = bool(enabled)
            self._dirty = True
        if changed:
            self.save()
        return bool(enabled)

    def module_cfg(self, guild_id: int | None, module_key: str) -> dict[str, Any]:
        """Sirf user-edited overrides. (Defaults JS side `data.js` me hain.)"""
        entry = self._module_bucket(guild_id).get(module_key) or {}
        return dict(entry.get("cfg") or {})

    def set_module_cfg(self, guild_id: int | None, module_key: str, cfg: dict[str, Any]) -> dict[str, Any]:
        """Partial update — sirf jo bheja gaya, baaki bacha rehta hai."""
        with self._lock:
            bucket = self._module_bucket(guild_id)
            entry = bucket.setdefault(module_key, {})
            entry.setdefault("enabled", True)
            current = entry.setdefault("cfg", {})
            current.update(cfg)
            self._dirty = True
        self.save()
        return dict(current)

    def reset_module(self, guild_id: int | None, module_key: str) -> None:
        with self._lock:
            bucket = self._module_bucket(guild_id)
            if module_key in bucket:
                del bucket[module_key]
                self._dirty = True
        self.save()

    def module_snapshot(self, guild_id: int | None) -> dict[str, Any]:
        """{module: {"enabled": bool, "cfg": {...}}} — dashboard ek call me le leta hai."""
        with self._lock:
            return json.loads(json.dumps(self._module_bucket(guild_id), ensure_ascii=False))

    # ------------------------------------------------------------------
    # Sticky messages — Discord par bheje gaye posts ka hisaab rakhta hai
    #   taaki restart ke baad bot pata sake ki purana sticky ab bhi zinda
    #   hai ya delete ho chuka hai.
    # ------------------------------------------------------------------
    @staticmethod
    def _sticky_key(guild_id: int | None, sticky_id: str) -> str:
        return f"{guild_id or 0}:{sticky_id}"

    def sticky_posts_for(self, guild_id: int | None) -> dict[str, dict[str, Any]]:
        prefix = f"{guild_id or 0}:"
        with self._lock:
            return {
                key[len(prefix):]: dict(val)
                for key, val in self.sticky_posts.items()
                if key.startswith(prefix)
            }

    def sticky_track(
        self,
        guild_id: int | None,
        sticky_id: str,
        *,
        msg_id: int,
        channel_id: int,
        template: str,
    ) -> None:
        with self._lock:
            self.sticky_posts[self._sticky_key(guild_id, sticky_id)] = {
                "msg": str(msg_id),
                "channel": str(channel_id),
                "tpl": str(template),
            }
            self._dirty = True
        self.save()

    def sticky_untrack(self, guild_id: int | None, sticky_id: str) -> None:
        with self._lock:
            if self.sticky_posts.pop(self._sticky_key(guild_id, sticky_id), None) is not None:
                self._dirty = True
        self.save()

    def sticky_find_msg(self, guild_id: int | None, msg_id: int) -> tuple[str, dict[str, Any]] | None:
        """Kisi deleted message ke liye uska sticky id dhoondta hai."""
        target = str(msg_id)
        prefix = f"{guild_id or 0}:"
        with self._lock:
            for key, val in self.sticky_posts.items():
                if str(val.get("msg")) == target and key.startswith(prefix):
                    return key[len(prefix):], dict(val)
        return None

    # ------------------------------------------------------------------
    # Generic key/value (features ka runtime state)
    #   jaise: xp, counting counter, invite cache, panel message ids
    # ------------------------------------------------------------------
    def kv_get(self, key: str, default: Any = None) -> Any:
        with self._lock:
            value = self.kv.get(key)
            if value is None:
                return default
            return json.loads(json.dumps(value, ensure_ascii=False))

    def kv_set(self, key: str, value: Any, *, save: bool = True) -> None:
        with self._lock:
            self.kv[key] = value
            self._dirty = True
        if save:
            self.save()

    def kv_update(self, key: str, patch: dict[str, Any]) -> Any:
        with self._lock:
            current = self.kv.get(key)
            if not isinstance(current, dict):
                current = {}
            current.update(patch)
            self.kv[key] = current
            self._dirty = True
        self.save()
        return dict(current)

    def kv_pop(self, key: str) -> None:
        with self._lock:
            if key in self.kv:
                del self.kv[key]
                self._dirty = True
        self.save()


store = Store()
