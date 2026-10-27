import secrets
import uuid

from django.conf import settings
from django.db import models


def new_share_token():
    return secrets.token_urlsafe(18)


class Board(models.Model):
    BACKGROUNDS = [("plain", "Uni"), ("dots", "Points"), ("grid", "Quadrillage")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="boards", on_delete=models.CASCADE)
    title = models.CharField(max_length=200, default="Sans titre")
    background = models.CharField(max_length=10, choices=BACKGROUNDS, default="dots")
    # Share links, enabled by the owner: whoever opens one becomes a member with that right.
    # Empty: link disabled. Regenerating a token invalidates the previous link.
    edit_token = models.CharField(max_length=40, unique=True, null=True, blank=True)
    view_token = models.CharField(max_length=40, unique=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.title


class BoardMember(models.Model):
    """User who joined a board through a share link."""

    EDIT = "edit"
    VIEW = "view"
    ROLES = [(EDIT, "Écriture"), (VIEW, "Lecture")]

    board = models.ForeignKey(Board, related_name="members", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="board_memberships", on_delete=models.CASCADE)
    role = models.CharField(max_length=4, choices=ROLES)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["joined_at"]
        constraints = [
            models.UniqueConstraint(fields=["board", "user"], name="unique_board_member"),
        ]


class BoardItem(models.Model):
    """One object of the canvas (shape, sticky, connector...). `data` is opaque to the backend."""

    board = models.ForeignKey(Board, related_name="items", on_delete=models.CASCADE)
    item_id = models.CharField(max_length=64)
    data = models.JSONField()
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["board", "item_id"], name="unique_board_item"),
        ]
