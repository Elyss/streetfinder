"""Who can do what on a board. Single rule for the REST API and the WebSocket.

- The owner can do everything, including sharing and deleting the board.
- A member with "edit" (joined through the write link) edits the content.
- A member with "view" (joined through the read link) only sees it.
- Anyone else does not see the board at all.
"""
from django.db.models import Q

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


def can_edit(role):
    return role in (OWNER, EDIT)
