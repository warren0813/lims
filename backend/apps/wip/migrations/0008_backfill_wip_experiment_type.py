# Data migration: populate WIP.experiment_type from each WIP's first
# dispatch (the chat-design model treats experiment_type as a property of
# the WIP, not the dispatch). Fallback: pick any experiment_type that the
# samples' parent requests have in request_experiments.
#
# Reverse is a no-op — clearing experiment_type is safe because the
# previous migration left it nullable.

from django.db import migrations


def forwards(apps, schema_editor):
    WIP = apps.get_model("wip", "WIP")
    Dispatch = apps.get_model("wip", "Dispatch")
    RequestExperiment = apps.get_model("commissions", "RequestExperiment")

    for wip in WIP.objects.all():
        # Prefer the first dispatch's experiment_type.
        first_dispatch = (
            Dispatch.objects.filter(wip=wip).order_by("created_at", "pk").first()
        )
        if first_dispatch and first_dispatch.experiment_type_id:
            wip.experiment_type_id = first_dispatch.experiment_type_id
            wip.save(update_fields=["experiment_type_id", "updated_at"])
            continue

        # Fallback: any experiment_type from the samples' parent requests.
        sample_request_ids = list(
            wip.samples.values_list("request_id", flat=True).distinct()
        )
        if not sample_request_ids:
            continue
        re = RequestExperiment.objects.filter(request_id__in=sample_request_ids).first()
        if re:
            wip.experiment_type_id = re.experiment_type_id
            wip.save(update_fields=["experiment_type_id", "updated_at"])


def backwards(apps, schema_editor):
    WIP = apps.get_model("wip", "WIP")
    WIP.objects.update(experiment_type=None)


class Migration(migrations.Migration):
    dependencies = [
        ("wip", "0007_add_wip_experiment_type_nullable"),
        ("commissions", "0006_merge_20260520_0640"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
