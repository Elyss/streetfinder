from rest_framework import serializers

from .models import Board


class BoardSerializer(serializers.ModelSerializer):
    item_count = serializers.IntegerField(read_only=True)
    owner_name = serializers.SerializerMethodField()

    class Meta:
        model = Board
        fields = ["id", "title", "background", "created_at", "updated_at", "item_count", "owner_name"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_owner_name(self, board):
        return board.owner.full_name or board.owner.email
