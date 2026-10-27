from django.conf import settings
from django.db import models


class Combo(models.Model):
    """
    Sequence of inputs saved by a user for a character.

    steps: [{"motion": [2, 3, 6], "buttons": ["LP"], "label": "Hadoken"}, ...]
    motion uses the numpad notation, seen from a character facing right.
    """

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="combos", on_delete=models.CASCADE)
    character = models.CharField(max_length=50)  # slug of the character
    name = models.CharField(max_length=100)
    steps = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.name
