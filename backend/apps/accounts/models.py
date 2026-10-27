import re

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone

PSEUDO_MIN, PSEUDO_MAX = 2, 30
PSEUDO_PATTERN = re.compile(r"^[\w .-]+$")


class UserManager(BaseUserManager):
    def create_user(self, email, pseudo="", password=None, **extra_fields):
        if not email:
            raise ValueError("The Email field must be set")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, pseudo=pseudo.strip(), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, pseudo="", password=None, **extra_fields):
        # The first account (manage.py createsuperuser) is a platform admin, already activated
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_admin", True)
        extra_fields.setdefault("is_activated_by_admin", True)
        return self.create_user(email, pseudo, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    # The e-mail is the login
    email = models.EmailField(unique=True, max_length=255)
    # Name shown everywhere in the app; unique, case insensitive
    pseudo = models.CharField(max_length=PSEUDO_MAX)

    # Archived: no longer asked nor shown since the pseudo, kept for the existing accounts
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)

    # Manages the users of the platform.
    # Not to be confused with is_superuser, which gives every right in the Django admin.
    is_admin = models.BooleanField(default=False)
    # New accounts (self-registered or invited) are active right away;
    # an admin can deactivate one, which then loses access to everything
    is_activated_by_admin = models.BooleanField(default=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["pseudo"]

    class Meta:
        ordering = [Lower("pseudo")]
        constraints = [
            models.UniqueConstraint(Lower("pseudo"), name="unique_pseudo_case_insensitive"),
        ]

    def __str__(self):
        return self.pseudo or self.email


def pseudo_error(pseudo, user=None):
    """Why a pseudo can't be used (None if it can), user being the account that would take it."""
    if not PSEUDO_MIN <= len(pseudo) <= PSEUDO_MAX:
        return f"Le pseudo doit faire entre {PSEUDO_MIN} et {PSEUDO_MAX} caractères."
    if not PSEUDO_PATTERN.match(pseudo):
        return "Le pseudo ne peut contenir que des lettres, des chiffres, des espaces et . _ -"
    taken = User.objects.filter(pseudo__iexact=pseudo)
    if user is not None and user.pk:
        taken = taken.exclude(pk=user.pk)
    if taken.exists():
        return "Ce pseudo est déjà pris."
    return None
