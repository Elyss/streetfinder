import re

import django.db.models.functions.text
from django.db import migrations, models


def fill_pseudos(apps, schema_editor):
    """Existing accounts: pseudo from the first name, or else from the e-mail, made unique."""
    User = apps.get_model("accounts", "User")
    taken = set()
    for user in User.objects.order_by("id"):
        base = re.sub(r"[^\w .-]", "", user.first_name or user.email.split("@")[0]).strip()[:26]
        if len(base) < 2:
            base = "Joueur"
        pseudo, n = base, 2
        while pseudo.lower() in taken:
            pseudo = f"{base}{n}"
            n += 1
        taken.add(pseudo.lower())
        user.pseudo = pseudo
        user.save(update_fields=["pseudo"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_alter_user_is_activated_by_admin"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="pseudo",
            field=models.CharField(default="", max_length=30),
            preserve_default=False,
        ),
        migrations.RunPython(fill_pseudos, migrations.RunPython.noop),
        migrations.AlterModelOptions(
            name="user",
            options={"ordering": [django.db.models.functions.text.Lower("pseudo")]},
        ),
        migrations.AddConstraint(
            model_name="user",
            constraint=models.UniqueConstraint(django.db.models.functions.text.Lower("pseudo"), name="unique_pseudo_case_insensitive"),
        ),
    ]
