# Data migration: populate Dispatch.equipment from the parent WIP's
# equipment (the chat-design pivot moves equipment from WIP back to
# Dispatch). The next reshape commit drops WIP.equipment entirely;
# this migration preserves that information on the dispatch row before
# the column goes away.
#
# Reverse is a no-op — clearing equipment is safe because the previous
# migration left it nullable.

from django.db import migrations


def forwards(apps, schema_editor):
    Dispatch = apps.get_model("wip", "Dispatch")

    for dispatch in Dispatch.objects.select_related("wip").iterator():
        wip_equipment_id = getattr(dispatch.wip, "equipment_id", None)
        if wip_equipment_id and dispatch.equipment_id != wip_equipment_id:
            dispatch.equipment_id = wip_equipment_id
            dispatch.save(update_fields=["equipment_id", "updated_at"])


def backwards(apps, schema_editor):
    Dispatch = apps.get_model("wip", "Dispatch")
    Dispatch.objects.update(equipment=None)


class Migration(migrations.Migration):
    dependencies = [
        ("wip", "0009_add_dispatch_equipment_nullable"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
