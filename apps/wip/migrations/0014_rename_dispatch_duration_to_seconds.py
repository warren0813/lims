# Rename Dispatch.estimated_duration_minutes -> estimated_duration_seconds
# and convert existing values from minutes to seconds.
#
# RenameField preserves the column data; the RunPython step then
# multiplies surviving values by 60. AlterField is a no-op at the
# database level (only help_text changed) but keeps Django's model
# state in sync with the new help_text.

from django.db import migrations, models


def minutes_to_seconds(apps, schema_editor):
    Dispatch = apps.get_model("wip", "Dispatch")
    Dispatch.objects.filter(estimated_duration_seconds__isnull=False).update(
        estimated_duration_seconds=models.F("estimated_duration_seconds") * 60
    )


def seconds_to_minutes(apps, schema_editor):
    Dispatch = apps.get_model("wip", "Dispatch")
    Dispatch.objects.filter(estimated_duration_seconds__isnull=False).update(
        estimated_duration_seconds=models.F("estimated_duration_seconds") / 60
    )


class Migration(migrations.Migration):
    dependencies = [
        ("wip", "0013_add_dispatch_estimated_duration"),
    ]

    operations = [
        migrations.RenameField(
            model_name="dispatch",
            old_name="estimated_duration_minutes",
            new_name="estimated_duration_seconds",
        ),
        migrations.RunPython(minutes_to_seconds, seconds_to_minutes),
        migrations.AlterField(
            model_name="dispatch",
            name="estimated_duration_seconds",
            field=models.PositiveIntegerField(
                blank=True, help_text="預估執行秒數", null=True
            ),
        ),
    ]
