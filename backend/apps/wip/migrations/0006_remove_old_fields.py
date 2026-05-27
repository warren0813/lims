# Step 3: Remove old fields. WIP.equipment stays nullable at the schema level
# (per zero-downtime migration policy); business logic enforces presence
# before transitioning to in_progress.

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("wip", "0005_migrate_wip_data"),
    ]

    operations = [
        # Remove old WIP.sample OneToOneField.
        migrations.RemoveField(
            model_name="wip",
            name="sample",
        ),
        # Remove old Dispatch.equipment ForeignKey.
        migrations.RemoveIndex(
            model_name="dispatch",
            name="dispatch_equipme_a6bbd1_idx",
        ),
        migrations.RemoveField(
            model_name="dispatch",
            name="equipment",
        ),
    ]
