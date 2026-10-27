from django.db import migrations


def delete_boards(apps, schema_editor):
    # Boards created before accounts have no owner: they are removed
    apps.get_model("boards", "Board").objects.all().delete()


class Migration(migrations.Migration):
    """Separate from 0003: PostgreSQL refuses to alter a table in the transaction that deleted its rows."""

    dependencies = [
        ("boards", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(delete_boards, migrations.RunPython.noop),
    ]
