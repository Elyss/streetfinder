"""Item persistence shared by the WebSocket consumer and the REST views."""
import json

from django.db import transaction
from django.utils import timezone

from .models import Board, BoardItem

MAX_ITEM_ID = 64
MAX_ITEM_BYTES = 200_000
MAX_OPS = 500


def get_items(board_id):
    return list(BoardItem.objects.filter(board_id=board_id).values_list("data", flat=True))


def validate_ops(ops, limit=MAX_OPS):
    """Return the well-formed ops, dropping anything malformed."""
    valid = []
    if not isinstance(ops, list):
        return valid
    for op in ops[:limit]:
        if not isinstance(op, dict):
            continue
        if op.get("op") == "put":
            item = op.get("item")
            if not isinstance(item, dict):
                continue
            item_id = item.get("id")
            if not isinstance(item_id, str) or not 0 < len(item_id) <= MAX_ITEM_ID:
                continue
            if len(json.dumps(item)) > MAX_ITEM_BYTES:
                continue
            valid.append({"op": "put", "item": item})
        elif op.get("op") == "del":
            item_id = op.get("id")
            if isinstance(item_id, str) and 0 < len(item_id) <= MAX_ITEM_ID:
                valid.append({"op": "del", "id": item_id})
    return valid


@transaction.atomic
def apply_ops(board_id, ops):
    # Last op wins when the same item appears several times in one batch
    puts, dels = {}, set()
    for op in ops:
        if op["op"] == "put":
            puts[op["item"]["id"]] = op["item"]
            dels.discard(op["item"]["id"])
        else:
            dels.add(op["id"])
            puts.pop(op["id"], None)

    if puts:
        BoardItem.objects.bulk_create(
            [BoardItem(board_id=board_id, item_id=i, data=d) for i, d in puts.items()],
            update_conflicts=True,
            unique_fields=["board", "item_id"],
            update_fields=["data", "updated_at"],
        )
    if dels:
        BoardItem.objects.filter(board_id=board_id, item_id__in=dels).delete()
    Board.objects.filter(id=board_id).update(updated_at=timezone.now())
