"""Transactional e-mails, sent with Django's mailer (see the EMAIL_* settings).

Layout helpers: inline styles only (many mail clients ignore <style> tags). Functions
receiving HTML expect already escaped text; those receiving a link or a label escape it.
"""
from email.utils import formataddr

from django.core.mail import EmailMultiAlternatives
from django.utils.html import escape

ACCENT = "#5366ce"
TEXT = "#333333"
GREY = "#6b7280"


def send_email(to_email, to_name, subject, html_content, text_content):
    """Send an e-mail (text + HTML) from DEFAULT_FROM_EMAIL; raises if the mail server refuses it."""
    message = EmailMultiAlternatives(subject, text_content, to=[formataddr((to_name, to_email))])
    message.attach_alternative(html_content, "text/html")
    message.send()


def title(html):
    return f"""
    <tr><td style="padding-top:28px;padding-bottom:12px;font-size:21px;font-weight:700;color:{ACCENT};">{html}</td></tr>"""


def paragraphs(*parts_html):
    ps = "".join(f"""<p style="margin:0 0 16px;">{p}</p>""" for p in parts_html)
    return f"""
    <tr><td>{ps}</td></tr>"""


def button(link, label):
    return f"""
    <tr><td align="center" style="padding:20px 0;">
        <a href="{escape(link)}" style="display:inline-block;background:{ACCENT};color:#ffffff;text-decoration:none;
           font-weight:700;font-size:17px;padding:13px 40px;border-radius:8px;">{escape(label)}</a>
    </td></tr>"""


def fallback_link(link):
    """The link in clear under the button, for mail clients that block buttons."""
    link = escape(link)
    return f"""
    <tr><td style="font-size:13px;color:#111111;">
        <p style="margin:0 0 4px;font-weight:700;">Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :</p>
        <a href="{link}" style="color:{TEXT};word-break:break-all;">{link}</a>
    </td></tr>"""


def note(html):
    return f"""
    <tr><td style="padding-top:28px;font-size:13px;color:{GREY};">{html}</td></tr>"""


def document(page_title, rows):
    return f"""\
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(page_title)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
<tr><td align="center" style="padding:20px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="max-width:640px;font-family:Arial,Helvetica,sans-serif;color:{TEXT};font-size:15px;line-height:1.45;">
    <tr><td style="padding-bottom:20px;border-bottom:1px solid #e3e8ef;font-size:22px;font-weight:800;color:#2e333d;">
        Delay Lama
    </td></tr>
    {rows}
</table>
</td></tr>
</table>
</body>
</html>
"""
