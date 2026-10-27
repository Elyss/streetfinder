from django.contrib import admin

from .models import Board


@admin.register(Board)
class BoardAdmin(admin.ModelAdmin):
    list_display = ["title", "background", "updated_at"]
    search_fields = ["title"]
