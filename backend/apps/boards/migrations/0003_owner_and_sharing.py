from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("boards", "0002_delete_ownerless_boards"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="board",
            name="owner",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="boards",
                to=settings.AUTH_USER_MODEL,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="board",
            name="edit_token",
            field=models.CharField(blank=True, max_length=40, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="board",
            name="view_token",
            field=models.CharField(blank=True, max_length=40, null=True, unique=True),
        ),
        migrations.CreateModel(
            name="BoardMember",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(choices=[("edit", "Écriture"), ("view", "Lecture")], max_length=4)),
                ("joined_at", models.DateTimeField(auto_now_add=True)),
                ("board", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="members", to="boards.board")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="board_memberships", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["joined_at"]},
        ),
        migrations.AddConstraint(
            model_name="boardmember",
            constraint=models.UniqueConstraint(fields=("board", "user"), name="unique_board_member"),
        ),
    ]
