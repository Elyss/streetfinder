"""Account e-mails: new registration (to admins), account activated, invitation, password reset.

A failed notification is logged without being raised: it must never make the registration
or the activation itself fail. The invitation is the exception (see send_invitation).
"""
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils.html import escape

from . import mail


def _send(user, subject, html, text):
    try:
        mail.send_email(user.email, user.full_name, subject, html, text)
    except Exception as e:
        print(f"Échec de l'envoi du mail « {subject} » à {user.email} : {e}", flush=True)


def notify_new_registration(new_user):
    admins = get_user_model().objects.filter(is_active=True, is_admin=True).exclude(pk=new_user.pk)
    name = new_user.full_name
    link = f"{settings.FRONTEND_URL}/utilisateurs"
    subject = f"Nouvelle inscription à valider : {name}"

    for admin in admins:
        html = mail.document(subject, "".join([
            mail.title(f"Bonjour {escape(admin.first_name)},"),
            mail.paragraphs(
                f"<b>{escape(name)}</b> ({escape(new_user.email)}) vient de créer un compte sur Delay Lama.",
                "Pour lui donner accès à l'application, activez son compte depuis la gestion des utilisateurs&nbsp;:",
            ),
            mail.button(link, "Gérer les utilisateurs"),
            mail.fallback_link(link),
            mail.note("Tant que son compte n'est pas activé, cette personne n'a accès à aucune fonctionnalité."),
        ]))
        text = (
            f"Bonjour {admin.first_name},\n\n"
            f"{name} ({new_user.email}) vient de créer un compte sur Delay Lama.\n"
            f"Pour lui donner accès à l'application, activez son compte : {link}\n"
        )
        _send(admin, subject, html, text)


def notify_account_activated(user):
    link = f"{settings.FRONTEND_URL}/login"
    subject = "Votre compte Delay Lama est activé"
    html = mail.document(subject, "".join([
        mail.title(f"Bonjour {escape(user.first_name)},"),
        mail.paragraphs("Bonne nouvelle : un administrateur a activé votre compte. Vous avez désormais accès à Delay Lama."),
        mail.button(link, "Se connecter"),
        mail.note(f"Votre identifiant de connexion est votre adresse e-mail : {escape(user.email)}"),
    ]))
    text = (
        f"Bonjour {user.first_name},\n\n"
        "Bonne nouvelle : un administrateur a activé votre compte. Vous avez désormais accès à Delay Lama.\n\n"
        f"Se connecter : {link}\n\nVotre identifiant de connexion est votre adresse e-mail : {user.email}"
    )
    _send(user, subject, html, text)


def send_invitation(user, link):
    """Invitation of an account created by an admin: link to choose a password.

    Unlike the other notifications, a failure is raised: without this mail the person
    has no way to access the account, so its creation must be rolled back.
    """
    role = " en tant qu'<b>administrateur</b>" if user.is_admin else ""
    role_text = " en tant qu'administrateur" if user.is_admin else ""
    subject = "Votre compte Delay Lama a été créé"
    html = mail.document(subject, "".join([
        mail.title(f"Bonjour {escape(user.first_name)},"),
        mail.paragraphs(
            f"Un compte Delay Lama vient de vous être créé{role}.",
            "Pour y accéder, choisissez votre mot de passe en cliquant sur le bouton ci-dessous. "
            "Vous serez ensuite directement connecté.",
        ),
        mail.button(link, "Choisir mon mot de passe"),
        mail.fallback_link(link),
        mail.note(f"Ce lien est valable 3 jours. Votre identifiant de connexion est votre adresse e-mail : {escape(user.email)}"),
    ]))
    text = (
        f"Bonjour {user.first_name},\n\n"
        f"Un compte Delay Lama vient de vous être créé{role_text}.\n"
        "Pour y accéder, choisissez votre mot de passe avec le lien suivant. Vous serez ensuite directement connecté.\n\n"
        f"{link}\n\nCe lien est valable 3 jours. Votre identifiant de connexion est votre adresse e-mail : {user.email}"
    )
    mail.send_email(user.email, user.full_name, subject, html, text)


def send_password_reset(user, link):
    subject = "Réinitialisation de votre mot de passe"
    html = mail.document(subject, "".join([
        mail.title(f"Bonjour {escape(user.first_name)},"),
        mail.paragraphs(
            "Vous avez demandé à réinitialiser votre mot de passe. "
            "Cliquez sur le bouton ci-dessous pour en choisir un nouveau&nbsp;:"
        ),
        mail.button(link, "Choisir un nouveau mot de passe"),
        mail.fallback_link(link),
        mail.note("Si vous n’êtes pas à l’origine de cette demande, ignorez simplement cet e-mail : "
                  "votre mot de passe reste inchangé."),
    ]))
    text = (
        f"Bonjour {user.first_name},\n\n"
        "Vous avez demandé à réinitialiser votre mot de passe.\n"
        f"Cliquez sur le lien suivant pour en choisir un nouveau :\n\n{link}\n\n"
        "Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail."
    )
    _send(user, subject, html, text)
