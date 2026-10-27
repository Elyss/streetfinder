import uuid
from pathlib import Path

from django.conf import settings
from django.core.files.storage import default_storage
from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.accounts.permissions import is_activated

from . import store
from .access import EDIT, OWNER, VIEW, access_role, can_edit, role_of, share_role, visible_boards
from .models import Board, BoardMember, new_share_token
from .serializers import BoardSerializer

UPLOAD_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_IMPORT_ITEMS = 10_000


def share_payload(board):
    """Share settings, for the owner only."""
    return {
        "edit_token": board.edit_token,
        "view_token": board.view_token,
        "members": [
            {
                "id": m.user_id,
                "name": m.user.full_name or m.user.email,
                "email": m.user.email,
                "role": m.role,
            }
            for m in board.members.select_related("user")
        ],
    }


class BoardViewSet(viewsets.ModelViewSet):
    """
    Every board belongs to a user. The owner shares it with share links (write or
    read): opening a link makes the user a member of the board with that right.
    Without an account, the link token (?share=) gives access to the board itself:
    reading it, adding images, and the WebSocket (see consumers.py).
    Boards the user can't access answer 404, as if they did not exist.
    """

    serializer_class = BoardSerializer
    # Reachable with a share link only (the rights are checked by board_with_role)
    SHARED_ACTIONS = {"retrieve", "uploads", "join"}

    def get_permissions(self):
        if self.action in self.SHARED_ACTIONS:
            return [AllowAny()]
        return super().get_permissions()

    def get_queryset(self):
        return visible_boards(self.request.user).select_related("owner").annotate(item_count=Count("items", distinct=True))

    def board_with_role(self, minimum):
        try:
            pk = uuid.UUID(str(self.kwargs.get("pk")))
        except ValueError:
            raise NotFound()
        board = Board.objects.select_related("owner").annotate(item_count=Count("items", distinct=True)).filter(pk=pk).first()
        role = board and access_role(board, self.request.user, self.request.query_params.get("share"))
        if not role:
            raise NotFound()
        if minimum == OWNER and role != OWNER:
            raise PermissionDenied("Réservé au propriétaire du board.")
        if minimum == EDIT and not can_edit(role):
            raise PermissionDenied("Vous avez un accès en lecture seule à ce board.")
        return board, role

    def serialize(self, board, role):
        data = self.get_serializer(board).data
        data["role"] = role
        return data

    def list(self, request):
        boards = self.get_queryset()
        roles = dict(BoardMember.objects.filter(user=request.user).values_list("board_id", "role"))
        return Response([self.serialize(b, OWNER if b.owner_id == request.user.id else roles.get(b.id)) for b in boards])

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        response.data["role"] = OWNER
        return response

    def retrieve(self, request, pk=None):
        board, role = self.board_with_role(VIEW)
        data = self.serialize(board, role)
        data["items"] = store.get_items(board.id)
        if role == OWNER:
            data["share"] = share_payload(board)
        return Response(data)

    def update(self, request, *args, **kwargs):
        self.board_with_role(EDIT)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self.board_with_role(OWNER)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def uploads(self, request, pk=None):
        board, _ = self.board_with_role(EDIT)
        file = request.FILES.get("file")
        if file is None:
            raise ValidationError({"file": "Aucun fichier."})
        ext = Path(file.name).suffix.lower()
        if ext not in UPLOAD_EXTENSIONS:
            raise ValidationError({"file": "Format non supporté."})
        if file.size > MAX_UPLOAD_BYTES:
            raise ValidationError({"file": "Fichier trop volumineux (10 Mo max)."})
        name = default_storage.save(f"boards/{board.id}/{uuid.uuid4().hex}{ext}", file)
        return Response({"url": settings.MEDIA_URL + name}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        # Readers can duplicate too: the copy belongs to them
        board, _ = self.board_with_role(VIEW)
        copy = Board.objects.create(owner=request.user, title=f"{board.title} (copie)", background=board.background)
        store.apply_ops(copy.id, [{"op": "put", "item": item} for item in store.get_items(board.id)])
        return Response(self.serialize(self.get_queryset().get(id=copy.id), OWNER), status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="import")
    def import_board(self, request):
        """Recreates a board from an export (decoded by the client): a new board owned by the user."""
        items = request.data.get("items")
        if not isinstance(items, list) or len(items) > MAX_IMPORT_ITEMS:
            raise ValidationError({"error": "Contenu de board invalide."})
        ops = store.validate_ops([{"op": "put", "item": it} for it in items], limit=MAX_IMPORT_ITEMS)
        background = request.data.get("background")
        board = Board.objects.create(
            owner=request.user,
            title=(str(request.data.get("title") or "").strip()[:200] or "Board importé"),
            background=background if background in dict(Board.BACKGROUNDS) else "dots",
        )
        store.apply_ops(board.id, ops)
        return Response(self.serialize(self.get_queryset().get(id=board.id), OWNER), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def leave(self, request, pk=None):
        """A member removes the board from their list (the owner deletes it instead)."""
        board, role = self.board_with_role(VIEW)
        if role == OWNER:
            raise ValidationError({"error": "Le propriétaire ne peut pas quitter son board."})
        BoardMember.objects.filter(board=board, user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get", "post"])
    def share(self, request, pk=None):
        """
        Owner only. POST {"role": "edit"|"view", "enabled": bool, "regenerate": bool}
        enables, disables or renews a share link.
        """
        board, _ = self.board_with_role(OWNER)
        if request.method == "POST":
            field = {EDIT: "edit_token", VIEW: "view_token"}.get(request.data.get("role"))
            if field is None:
                raise ValidationError({"error": "Type de lien inconnu."})
            if not request.data.get("enabled", True):
                setattr(board, field, None)
            elif request.data.get("regenerate") or not getattr(board, field):
                setattr(board, field, new_share_token())
            board.save(update_fields=[field])
        return Response(share_payload(board))

    @action(detail=True, methods=["post"], url_path=r"members/(?P<user_id>\d+)")
    def member(self, request, pk=None, user_id=None):
        """Owner only. {"role": "edit"|"view"} changes a member's right, {"remove": true} removes them."""
        board, _ = self.board_with_role(OWNER)
        membership = get_object_or_404(BoardMember, board=board, user_id=user_id)
        if request.data.get("remove"):
            membership.delete()
        elif request.data.get("role") in (EDIT, VIEW):
            membership.role = request.data["role"]
            membership.save(update_fields=["role"])
        else:
            raise ValidationError({"error": "Action inconnue."})
        return Response(share_payload(board))

    @action(detail=False, methods=["post"])
    def join(self, request):
        """
        Opening a share link: an account becomes a member with the right of the link.
        Without an account, only the board and the right are returned: access then
        goes through the token, as long as the link stays enabled.
        """
        token = (request.data.get("token") or "").strip()
        board = Board.objects.filter(edit_token=token).first() if token else None
        role = EDIT
        if board is None and token:
            board = Board.objects.filter(view_token=token).first()
            role = VIEW
        if board is None:
            raise NotFound("Ce lien de partage est invalide ou a été désactivé.")

        if not is_activated(request.user):
            return Response({"id": board.id, "role": share_role(board, token), "member": False})

        current = role_of(board, request.user)
        if current is None:
            BoardMember.objects.create(board=board, user=request.user, role=role)
            current = role
        elif current == VIEW and role == EDIT:
            # A link never lowers a right already granted, but the write link raises it
            BoardMember.objects.filter(board=board, user=request.user).update(role=EDIT)
            current = EDIT
        return Response({"id": board.id, "role": current, "member": True})
