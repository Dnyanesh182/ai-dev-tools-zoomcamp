# Generated manually for the initial homework model.
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Chore",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=120)),
                ("assignee", models.CharField(max_length=60)),
                ("due_date", models.DateField()),
                ("recurrence", models.CharField(choices=[("one-off", "One-off"), ("weekly", "Weekly"), ("monthly", "Monthly")], default="one-off", max_length=10)),
                ("completed_at", models.DateField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["due_date", "title"]},
        ),
    ]
