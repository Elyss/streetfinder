from rest_framework.permissions import BasePermission


def is_activated(u):
    """Account activated by an admin; admins do not need it."""
    return bool(u and u.is_authenticated and u.is_active and (u.is_activated_by_admin or u.is_admin))


class IsActivated(BasePermission):
    message = "Votre compte est en attente d'activation par un administrateur."

    def has_permission(self, request, view):
        return is_activated(getattr(request, "user", None))


class IsAdmin(BasePermission):
    message = "Réservé aux administrateurs."

    def has_permission(self, request, view):
        u = getattr(request, "user", None)
        return bool(u and u.is_authenticated and u.is_active and u.is_admin)
