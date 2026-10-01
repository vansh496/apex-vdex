"""Ticket transcript generator — plain HTML, no external dependency."""

from __future__ import annotations

import html
from datetime import datetime, timedelta, timezone
from pathlib import Path

import config

IST = timezone(timedelta(hours=5, minutes=30), "IST")

CSS = """
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body {
  margin: 0; padding: 32px 20px;
  background: #0f1115; color: #e6e8ec;
  font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 15px; line-height: 1.6;
}
.wrap { max-width: 900px; margin: 0 auto; }
.head {
  background: linear-gradient(135deg, #1b1f27, #232833);
  border: 1px solid #2c3240; border-radius: 14px;
  padding: 24px 26px; margin-bottom: 22px;
}
.head h1 { margin: 0 0 6px; font-size: 22px; letter-spacing: .2px; }
.head .sub { color: #99a1b3; font-size: 13px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px 18px; margin-top: 18px; }
.grid div { font-size: 13px; color: #99a1b3; }
.grid b { color: #e6e8ec; font-weight: 600; }
.details {
  margin-top: 18px; padding: 14px 16px; border-left: 3px solid #4a7cf7;
  background: #161a22; border-radius: 0 8px 8px 0; white-space: pre-wrap; color: #cdd3df;
}
.msgs { display: flex; flex-direction: column; gap: 14px; }
.msg { display: flex; gap: 12px; }
.av {
  width: 40px; height: 40px; flex: 0 0 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: #2b3242; color: #fff; font-weight: 600; font-size: 15px;
}
.body { flex: 1; min-width: 0; }
.meta { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.author { font-weight: 600; }
.bot { background: #4a7cf7; color: #fff; font-size: 10px; padding: 1px 6px; border-radius: 999px; text-transform: uppercase; }
.stamp { color: #6f7789; font-size: 12px; }
.text { margin-top: 3px; white-space: pre-wrap; word-wrap: break-word; color: #dde1e9; }
.attachments { margin-top: 7px; }
.attachments a { color: #6f9dff; font-size: 13px; display: block; }
.embed {
  margin-top: 7px; border-left: 3px solid #3a4256; background: #151922;
  border-radius: 0 6px 6px 0; padding: 8px 12px; color: #aeb5c4; font-size: 13px;
}
.foot { margin-top: 26px; text-align: center; color: #6f7789; font-size: 12px; }
.system { text-align: center; color: #6f7789; font-size: 12px; padding: 6px 0; }
.system span { background: #1b1f27; border: 1px solid #2c3240; border-radius: 999px; padding: 4px 12px; }
"""


def _fmt(dt: datetime | None, fallback: str = "-") -> str:
    if not dt:
        return fallback
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST).strftime("%d %b %Y, %I:%M %p IST")


def _parse(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _initial(name: str) -> str:
    clean = "".join(ch for ch in name if ch.isalnum())
    return (clean[0].upper() if clean else "?")


def build_html(ticket: dict, messages: list, closed_by: str, close_reason: str | None = None) -> str:
    try:
        from bot import resolve_type  # circular import se bachne ke liye andar
        gid = int(ticket.get("guild_id") or 0) or None
        t_cfg = resolve_type(gid, ticket.get("type", ""))
    except Exception:  # noqa: BLE001
        t_cfg = config.TICKET_TYPES.get(ticket.get("type", ""), {})
    label = t_cfg.get("label", ticket.get("type", "ticket"))
    emoji = t_cfg.get("emoji", "\N{TICKET}")
    number = ticket.get("number", 0)

    created = _parse(ticket.get("created_at"))
    closed = _parse(ticket.get("closed_at"))

    rows = "".join(
        f"<div><b>{html.escape(str(k))}</b> — {v}</div>"
        for k, v in (
            ("Type", f"{emoji} {html.escape(label)}"),
            ("Ticket", f"#{number}"),
            ("Opened by", html.escape(ticket.get("user_tag", "unknown"))),
            ("Subject", html.escape(ticket.get("subject", "-") or "-")),
            ("Claimed by", html.escape(ticket.get("claimed_by_tag") or "Not claimed")),
            ("Created", _fmt(created)),
            ("Closed", _fmt(closed)),
            ("Closed by", html.escape(closed_by or "system")),
        )
    )

    body: list[str] = []
    if ticket.get("details"):
        body.append(
            f'<div class="details"><b>Original request:</b>\n{html.escape(ticket["details"])}</div>'
        )

    body.append('<div class="msgs">')
    for message in messages:
        if getattr(message, "author", None) is None:
            continue
        author = message.author
        stamp = _fmt(getattr(message, "created_at", None))
        content = getattr(message, "content", "") or ""
        is_bot = getattr(author, "bot", False)

        files = getattr(message, "attachments", []) or []
        attach_html = ""
        if files:
            links = "".join(
                f'<a href="{html.escape(getattr(f, "url", "#"))}">{html.escape(getattr(f, "filename", "file"))}</a>'
                for f in files
            )
            attach_html = f'<div class="attachments">{links}</div>'

        embeds = getattr(message, "embeds", []) or []
        embed_html = ""
        if embeds and not content:
            parts = []
            for emb in embeds:
                title = getattr(emb, "title", None)
                desc = getattr(emb, "description", None)
                if title or desc:
                    parts.append(
                        (f"<b>{html.escape(title)}</b>\n" if title else "")
                        + html.escape(desc or "")
                    )
            if parts:
                embed_html = f'<div class="embed">{"<hr>".join(parts)}</div>'

        text_html = f'<div class="text">{html.escape(content)}</div>' if content else ""
        badge = '<span class="bot">bot</span>' if is_bot else ""

        body.append(
            f'<div class="msg"><div class="av">{_initial(str(author))}</div>'
            f'<div class="body"><div class="meta">'
            f'<span class="author">{html.escape(str(author))}</span>{badge}'
            f'<span class="stamp">{stamp}</span></div>'
            f"{text_html}{embed_html}{attach_html}</div></div>"
        )
    body.append("</div>")

    if close_reason:
        body.append(
            f'<div class="system"><span>Close reason: {html.escape(close_reason)}</span></div>'
        )

    total = len(messages)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ticket #{number} — {html.escape(label)} transcript</title>
<style>{CSS}</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <h1>{emoji} Ticket #{number} — {html.escape(label)}</h1>
    <div class="sub">Chat transcript · {total} message(s)</div>
    <div class="grid">{rows}</div>
  </div>
  {''.join(body)}
  <div class="foot">Generated by APEX Ticket Bot</div>
</div>
</body>
</html>"""


def save(ticket: dict, messages: list, closed_by: str, close_reason: str | None = None) -> Path:
    """Transcript likhta hai aur file ka path return karta hai."""
    number = ticket.get("number", 0)
    type_key = ticket.get("type", "ticket")
    stamp = datetime.now(IST).strftime("%Y%m%d-%H%M%S")
    filename = f"{type_key}-{number:0{config.COUNTER_PAD}d}-{stamp}.html"

    folder = config.TRANSCRIPT_DIR / str(ticket.get("guild_id", "unknown"))
    folder.mkdir(parents=True, exist_ok=True)

    path = folder / filename
    path.write_text(build_html(ticket, messages, closed_by, close_reason), encoding="utf-8")
    return path
