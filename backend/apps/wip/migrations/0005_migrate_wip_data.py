# Data migration: populate new fields from old ones.
# - WIP.sample (OneToOne) → WIPSample (M2M through)
# - Dispatch.equipment → WIP.equipment (inferred from first dispatch)

from django.db import migrations


def forwards(apps, schema_editor):
    WIP = apps.get_model("wip", "WIP")
    WIPSample = apps.get_model("wip", "WIPSample")
    Dispatch = apps.get_model("wip", "Dispatch")

    for wip in WIP.objects.all():
        # Copy WIP.sample → WIPSample entry.
        if wip.sample_id:
            WIPSample.objects.get_or_create(wip=wip, sample_id=wip.sample_id)

        # Infer equipment from dispatches.
        first_dispatch = Dispatch.objects.filter(wip=wip).first()
        if first_dispatch and first_dispatch.equipment_id:
            wip.equipment_id = first_dispatch.equipment_id
            wip.save(update_fields=["equipment_id"])


def backwards(apps, schema_editor):
    # Reverse is best-effort: copy first WIPSample back to WIP.sample.
    WIP = apps.get_model("wip", "WIP")
    WIPSample = apps.get_model("wip", "WIPSample")

    for wip in WIP.objects.all():
        first_ws = WIPSample.objects.filter(wip=wip).first()
        if first_ws:
            wip.sample_id = first_ws.sample_id
            wip.save(update_fields=["sample_id"])


class Migration(migrations.Migration):
    dependencies = [
        ("wip", "0004_sampleexperimentstatus_wipsample_and_more"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
