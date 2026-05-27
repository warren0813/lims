# Manual migration: simplify ExperimentResult + add per-wafer verdict.
#
# Order matters: add the new columns first, then run RunPython to
# carry data over from the about-to-be-dropped columns, then drop the
# old columns. Reversed for rollback so dropping the new columns
# doesn't leave the carry-over function with no place to write.
#
# Data preservation:
#   - ExperimentResult.summary + note are concatenated into the new
#     ExperimentResult.comment field (newline-separated when both
#     non-empty).
#   - The dispatch-level ExperimentResult.verdict ('pass' / 'fail')
#     fans out onto every SampleExperimentStatus row that references
#     this dispatch — that's the closest analogue under the new
#     per-wafer model. data and data_source are dropped (no analogue).

from django.db import migrations, models


def forwards(apps, schema_editor):
    ExperimentResult = apps.get_model("wip", "ExperimentResult")
    SampleExperimentStatus = apps.get_model("wip", "SampleExperimentStatus")

    for result in ExperimentResult.objects.all():
        parts = [p for p in (result.summary or "", result.note or "") if p]
        result.comment = "\n".join(parts)
        result.save(update_fields=["comment"])

        # Carry the dispatch-level verdict out to every SampleExperimentStatus
        # row attached to this dispatch.
        if result.verdict in ("pass", "fail"):
            SampleExperimentStatus.objects.filter(
                dispatch_id=result.dispatch_id
            ).update(verdict=result.verdict)


def backwards(apps, schema_editor):
    # Best-effort: copy comment back to summary so the schema rollback
    # doesn't lose operator text. note + data + data_source + verdict
    # can't be reconstructed.
    ExperimentResult = apps.get_model("wip", "ExperimentResult")
    for result in ExperimentResult.objects.all():
        if result.comment and not result.summary:
            result.summary = result.comment
            result.save(update_fields=["summary"])


class Migration(migrations.Migration):
    dependencies = [
        ("wip", "0014_rename_dispatch_duration_to_seconds"),
    ]

    operations = [
        # Step 1 — add the new columns (still nullable / blank-friendly).
        migrations.AddField(
            model_name="experimentresult",
            name="comment",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="sampleexperimentstatus",
            name="verdict",
            field=models.CharField(
                blank=True,
                choices=[("pass", "合格"), ("fail", "不合格")],
                help_text=(
                    "Per-wafer pass/fail outcome — null until record_result fills it."
                ),
                max_length=8,
                null=True,
            ),
        ),
        # Step 2 — carry data over before dropping the source columns.
        migrations.RunPython(forwards, backwards),
        # Step 3 — drop the now-unused columns.
        migrations.RemoveField(model_name="experimentresult", name="data"),
        migrations.RemoveField(model_name="experimentresult", name="data_source"),
        migrations.RemoveField(model_name="experimentresult", name="note"),
        migrations.RemoveField(model_name="experimentresult", name="summary"),
        migrations.RemoveField(model_name="experimentresult", name="verdict"),
    ]
