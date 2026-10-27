from rest_framework import serializers

from apps.characters.models import Character

from .models import Combo

BUTTONS = {"LP", "MP", "HP", "LK", "MK", "HK", "P", "K"}
MAX_STEPS = 100


class ComboSerializer(serializers.ModelSerializer):
    class Meta:
        model = Combo
        fields = ["id", "character", "name", "steps", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_character(self, value):
        if Character.get(value) is None:
            raise serializers.ValidationError("Personnage inconnu.")
        return value

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Le nom est requis.")
        return value

    def validate_steps(self, steps):
        if not isinstance(steps, list) or not 0 < len(steps) <= MAX_STEPS:
            raise serializers.ValidationError(f"Un combo compte de 1 à {MAX_STEPS} étapes.")
        clean = []
        for step in steps:
            motion = step.get("motion") if isinstance(step, dict) else None
            buttons = step.get("buttons") if isinstance(step, dict) else None
            if not isinstance(motion, list) or not isinstance(buttons, list):
                raise serializers.ValidationError("Étape invalide.")
            if len(motion) > 12 or any(not isinstance(d, int) or not 1 <= d <= 9 for d in motion):
                raise serializers.ValidationError("Direction invalide.")
            if len(buttons) > 4 or any(b not in BUTTONS for b in buttons):
                raise serializers.ValidationError("Bouton invalide.")
            if not motion and not buttons:
                raise serializers.ValidationError("Une étape doit contenir une direction ou un bouton.")
            clean.append({"motion": motion, "buttons": buttons, "label": str(step.get("label") or "")[:120]})
        return clean
