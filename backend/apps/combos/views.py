from rest_framework import viewsets

from .models import Combo
from .serializers import ComboSerializer


class ComboViewSet(viewsets.ModelViewSet):
    """Combos of the current user only; ?character=<slug> filters on a character."""

    serializer_class = ComboSerializer

    def get_queryset(self):
        combos = Combo.objects.filter(owner=self.request.user)
        character = self.request.query_params.get("character")
        return combos.filter(character=character) if character else combos

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
