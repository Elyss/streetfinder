from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserChangeForm as BaseUserChangeForm
from django.contrib.auth.forms import UserCreationForm as BaseUserCreationForm

from .models import User


# The default forms are bound to auth.User and its "username" field
class UserCreationForm(BaseUserCreationForm):
    class Meta(BaseUserCreationForm.Meta):
        model = User
        fields = ["email", "first_name", "last_name"]


class UserChangeForm(BaseUserChangeForm):
    class Meta(BaseUserChangeForm.Meta):
        model = User
        fields = "__all__"


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    ordering = ["last_name", "first_name"]
    list_display = ["email", "first_name", "last_name", "is_admin", "is_activated_by_admin", "is_active"]
    list_filter = ["is_admin", "is_activated_by_admin", "is_active", "is_staff"]
    search_fields = ["email", "first_name", "last_name"]
    fieldsets = [
        (None, {"fields": ["email", "password"]}),
        ("Identité", {"fields": ["first_name", "last_name"]}),
        ("Delay Lama", {"fields": ["is_admin", "is_activated_by_admin"]}),
        ("Django", {"fields": ["is_active", "is_staff", "is_superuser", "groups", "user_permissions"]}),
        ("Dates", {"fields": ["last_login", "date_joined"]}),
    ]
    add_fieldsets = [
        (None, {"classes": ["wide"], "fields": ["email", "first_name", "last_name", "password1", "password2"]}),
    ]
