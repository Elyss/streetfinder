"""Who can do what on a board. Single rule for the REST API and the WebSocket.

- The owner can do everything, including sharing and deleting the board.
- A member with "edit" (joined through the write link) edits the content.
- A member with "view" (joined through the read link) only sees it.
- Anyone else does not see the board at all, unless they come with a share link:
  without an account, the token of the link gives its right for as long as the link is enabled.
"""
import secrets

from django.db.models import Q

from apps.accounts.permissions import is_activated

from .models import Board, BoardMember

OWNER = "owner"
EDIT = BoardMember.EDIT
VIEW = BoardMember.VIEW


def visible_boards(user):
    return Board.objects.filter(Q(owner=user) | Q(members__user=user)).distinct()


def role_of(board, user):
    if board.owner_id == user.id:
        return OWNER
    return BoardMember.objects.filter(board=board, user=user).values_list("role", flat=True).first()


def share_role(board, token):
    """Right given by a share link token, or None (unknown or disabled link)."""
    if not token:
        return None
    if board.edit_token and secrets.compare_digest(token, board.edit_token):
        return EDIT
    if board.view_token and secrets.compare_digest(token, board.view_token):
        return VIEW
    return None


def access_role(board, user, share=None):
    """Role of an account on the board, or else the right of the share link it came with."""
    role = role_of(board, user) if is_activated(user) else None
    return role or share_role(board, share)


def can_edit(role):
    return role in (OWNER, EDIT)
