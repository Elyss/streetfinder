from django.conf                                import settings
from django.contrib.auth                        import get_user_model
from django.contrib.auth.password_validation    import validate_password
from django.contrib.auth.tokens                 import default_token_generator
from django.core.exceptions                     import ValidationError
from django.core.validators                     import validate_email
from django.db                                  import transaction
from django.utils.encoding                      import force_bytes, force_str
from django.utils.http                          import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework                             import status
from rest_framework.decorators                  import api_view, permission_classes, throttle_classes
from rest_framework.permissions                 import AllowAny, IsAuthenticated
from rest_framework.response                    import Response
from rest_framework.throttling                  import AnonRateThrottle
from rest_framework_simplejwt.tokens            import RefreshToken

from .notifications import notify_account_activated, notify_new_registration, send_invitation, send_password_reset
from .models        import pseudo_error
from .permissions   import IsActivated, IsAdmin

User = get_user_model()


def user_payload(u):
    return {
        "id": u.id,
        "email": u.email,
        "pseudo": u.pseudo,
        "is_admin": u.is_admin,
        "is_activated_by_admin": u.is_activated_by_admin,
        "date_joined": u.date_joined,
    }


def tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


def password_errors(password, user=None):
    """Password rules not met (empty if the password is valid)."""
    try:
        validate_password(password, user=user)
        return []
    except ValidationError as e:
        return list(e.messages)


def link_for(user, page):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f"{settings.FRONTEND_URL}/{page}/{uid}/{token}"


def user_from_link(uid, token):
    """User of a reset / invitation link, or None if the link is invalid or expired."""
    try:
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(uid)), is_active=True)
    except Exception:
        return None
    if not default_token_generator.check_token(user, token):
        return None
    return user


def managed_user(request, user_id):
    """Account an admin acts upon, never their own (they would lock themselves out)."""
    user = User.objects.filter(pk=user_id).first()
    if user is None:
        return None, Response({"error": "Utilisateur introuvable."}, status=404)
    if user.id == request.user.id:
        return None, Response({"error": "Vous ne pouvez pas modifier vos propres droits."}, status=403)
    return user, None


# ------------------------------------------------------------------ own account

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(user_payload(request.user))


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AnonRateThrottle])
def register(request):
    email = (request.data.get("email") or "").strip().lower()
    password = request.data.get("password") or ""
    pseudo = (request.data.get("pseudo") or "").strip()

    if not email or not password or not pseudo:
        return Response({"error": "Tous les champs sont requis."}, status=400)
    if error := pseudo_error(pseudo):
        return Response({"error": error}, status=400)
    try:
        validate_email(email)
    except ValidationError:
        return Response({"error": "L'adresse e-mail n'est pas valide."}, status=400)
    if User.objects.filter(email=email).exists():
        return Response({"error": "Un utilisateur avec cet e-mail existe déjà."}, status=400)

    errors = password_errors(password, User(email=email, pseudo=pseudo))
    if errors:
        return Response({"error": " ".join(errors)}, status=400)

    user = User.objects.create_user(email=email, pseudo=pseudo, password=password)

    # Admins are told about the new account (active right away)
    notify_new_registration(user)

    # Logged in right away
    return Response(tokens_for(user), status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsActivated])
def update_profile(request):
    pseudo = (request.data.get("pseudo") or "").strip()
    user = request.user
    if not pseudo:
        return Response({"error": "Le pseudo est requis."}, status=400)
    if error := pseudo_error(pseudo, user):
        return Response({"error": error}, status=400)

    user.pseudo = pseudo
    user.save(update_fields=["pseudo"])
    return Response(user_payload(user))


# ------------------------------------------------------------------ passwords

@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AnonRateThrottle])
def forgot_password(request):
    email = (request.data.get("email") or "").strip().lower()
    user = User.objects.filter(email=email, is_active=True).first()
    # Same answer whether the account exists or not, so as not to reveal registered addresses
    if user:
        send_password_reset(user, link_for(user, "reset-password"))
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([AllowAny])
def check_link(request):
    user = user_from_link(request.query_params.get("uid"), request.query_params.get("token"))
    if user is None:
        return Response({"error": "Lien invalide ou expiré."}, status=400)
    return Response({"pseudo": user.pseudo})


@api_view(["POST"])
@permission_classes([AllowAny])
def reset_password(request):
    """End of a reset link or of an invitation: the person chooses a password and is logged in."""
    password = request.data.get("password") or ""
    user = user_from_link(request.data.get("uid"), request.data.get("token"))
    if user is None:
        return Response({"error": "Lien invalide ou expiré."}, status=400)

    errors = password_errors(password, user)
    if errors:
        return Response({"error": " ".join(errors)}, status=400)

    # Changing the password also invalidates the link, which depends on its hash
    user.set_password(password)
    user.save()
    return Response(tokens_for(user))


# ------------------------------------------------------------------ user management (admins)

@api_view(["GET", "POST"])
@permission_classes([IsAdmin])
def users(request):
    if request.method == "GET":
        return Response([user_payload(u) for u in User.objects.filter(is_active=True)])

    # An admin creates an already activated account; the person receives a link to choose a password
    email = (request.data.get("email") or "").strip().lower()
    pseudo = (request.data.get("pseudo") or "").strip()
    is_admin = request.data.get("is_admin") in (True, "true", "1", 1)

    if not email or not pseudo:
        return Response({"error": "Tous les champs sont requis."}, status=400)
    if error := pseudo_error(pseudo):
        return Response({"error": error}, status=400)
    try:
        validate_email(email)
    except ValidationError:
        return Response({"error": "L'adresse e-mail n'est pas valide."}, status=400)
    if User.objects.filter(email=email).exists():
        return Response({"error": "Un utilisateur avec cet e-mail existe déjà."}, status=400)

    try:
        # Without the invitation the account would be unreachable: roll back if sending fails
        with transaction.atomic():
            user = User.objects.create_user(
                email=email,
                pseudo=pseudo,
                password=None,  # unusable until the person chooses one
                is_admin=is_admin,
                is_activated_by_admin=True,
            )
            send_invitation(user, link_for(user, "definir-mot-de-passe"))
    except Exception as e:
        print(f"Échec de la création de {email} (invitation non envoyée) : {e}", flush=True)
        return Response({"error": "L'e-mail d'invitation n'a pas pu être envoyé : le compte n'a pas été créé."}, status=502)

    return Response(user_payload(user), status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAdmin])
def toggle_activation(request, user_id):
    user, error = managed_user(request, user_id)
    if error:
        return error
    user.is_activated_by_admin = not user.is_activated_by_admin
    user.save(update_fields=["is_activated_by_admin"])
    # Tell the person only when the account has just been activated
    if user.is_activated_by_admin:
        notify_account_activated(user)
    return Response(user_payload(user))


@api_view(["POST"])
@permission_classes([IsAdmin])
def toggle_admin(request, user_id):
    user, error = managed_user(request, user_id)
    if error:
        return error
    user.is_admin = not user.is_admin
    user.save(update_fields=["is_admin"])
    return Response(user_payload(user))


@api_view(["DELETE"])
@permission_classes([IsAdmin])
def delete_user(request, user_id):
    user, error = managed_user(request, user_id)
    if error:
        return error
    user.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
