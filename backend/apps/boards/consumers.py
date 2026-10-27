import json
import uuid
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.permissions import is_activated

from . import store
from .access import can_edit, role_of
from .models import Board

MAX_PRESENCE_BYTES = 4_000


@database_sync_to_async
def board_role(board_id, user):
    """Role of the user on the board, or None (no access, or unknown board)."""
    board = Board.objects.filter(id=board_id).first()
    return role_of(board, user) if board else None


@database_sync_to_async
def get_meta(board_id):
    return Board.objects.filter(id=board_id).values("title", "background").first()


@database_sync_to_async
def user_from_token(raw):
    """Activated user of a JWT access token, or None."""
    try:
        token = AccessToken(raw)
    except TokenError:
        return None
    user = get_user_model().objects.filter(pk=token.get("user_id")).first()
    return user if is_activated(user) else None


@database_sync_to_async
def update_meta(board_id, meta):
    Board.objects.filter(id=board_id).update(**meta)


class BoardConsumer(AsyncJsonWebsocketConsumer):
    """
    Real-time channel of a board.

    client -> server : ops (persisted then acked), presence, meta
    server -> client : init (full snapshot), ops, ack, presence, join, leave, meta

    Readers ("view" role) receive everything and share their presence, but their
    changes are refused (acked without being applied).
    """

    async def connect(self):
        # Browsers cannot set headers on a WebSocket: the access token comes in the query string
        raw = parse_qs(self.scope["query_string"].decode()).get("token", [""])[0]
        self.user = await user_from_token(raw)
        if self.user is None:
            # Accepted then closed, so that the client receives the code and refreshes its token
            await self.accept()
            await self.close(code=4401)
            return
        try:
            self.board_id = uuid.UUID(self.scope["url_route"]["kwargs"]["board_id"])
        except ValueError:
            await self.close()
            return
        role = await board_role(self.board_id, self.user)
        if role is None:
            await self.close()
            return

        self.client_id = uuid.uuid4().hex[:8]
        self.group = f"board_{self.board_id.hex}"
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

        items = await database_sync_to_async(store.get_items)(self.board_id)
        board = await get_meta(self.board_id)
        await self.send_json({"type": "init", "you": self.client_id, "role": role, "items": items, "board": board})
        await self.broadcast({"type": "join", "client": self.client_id})

    async def disconnect(self, code):
        if hasattr(self, "group"):
            await self.broadcast({"type": "leave", "client": self.client_id})
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive_json(self, content, **kwargs):
        kind = content.get("type")

        # Checked on every change: a member removed or demoted meanwhile cannot write anymore
        if kind in ("ops", "meta") and not can_edit(await board_role(self.board_id, self.user)):
            if kind == "ops":
                await self.send_json({"type": "ack", "seq": content.get("seq"), "rejected": True})
            return

        if kind == "ops":
            ops = store.validate_ops(content.get("ops"))
            if ops:
                await database_sync_to_async(store.apply_ops)(self.board_id, ops)
                await self.broadcast({"type": "ops", "ops": ops})
            await self.send_json({"type": "ack", "seq": content.get("seq")})

        elif kind == "presence":
            data = content.get("data")
            if isinstance(data, dict) and len(json.dumps(data)) <= MAX_PRESENCE_BYTES:
                await self.broadcast({"type": "presence", "client": self.client_id, "data": data})

        elif kind == "meta":
            meta = {}
            title = content.get("title")
            if isinstance(title, str):
                meta["title"] = title.strip()[:200] or "Sans titre"
            if content.get("background") in dict(Board.BACKGROUNDS):
                meta["background"] = content["background"]
            if meta:
                await update_meta(self.board_id, meta)
                await self.broadcast({"type": "meta", **meta})

    async def broadcast(self, message):
        await self.channel_layer.group_send(
            self.group,
            {"type": "board.event", "sender": self.channel_name, "message": message},
        )

    async def board_event(self, event):
        # Senders already applied their own changes locally
        if event["sender"] != self.channel_name:
            await self.send_json(event["message"])
