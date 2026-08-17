# Integrity Calibration Protocol

KeepMe’s calibration tool searches for conservative summary and preserve-zone thresholds using a governed, independently labeled JSONL dataset. It is tooling for threshold review—not evidence that the current product is calibrated for real-world automated decisions.

## Guardrails

The script enforces three basic constraints:

- at least 100 labeled examples;
- each row must be labeled `pass` or `fail` and include integrity signals;
- the selected profile must have a false-negative rate of 5% or less on the supplied dataset.

Among candidates that meet the false-negative constraint, the script chooses the profile with the highest F1 score. This optimization does not replace dataset review, holdout evaluation, subgroup analysis, or human approval.

## Input Format

Each line is one JSON object:

```json
{"sampleId":"opaque-id","expected":"fail","signals":{"summaryScore":0.74,"preserveZone":0.61,"alignmentReliable":true}}
```

Required fields:

| Field | Type | Meaning |
|---|---|---|
| `sampleId` | String | Opaque, non-identifying evaluation identifier |
| `expected` | `pass` or `fail` | Independently reviewed expected decision |
| `signals.summaryScore` | Number | Aggregate integrity score for the example |
| `signals.preserveZone` | Number | Preserve-zone stability score |
| `signals.alignmentReliable` | Boolean | Whether source/result alignment was reliable |

The tool treats an example as a predicted failure when the summary is below the candidate threshold, the preserve-zone score is below its candidate threshold, or alignment is unreliable.

## Run Calibration

```bash
npm run calibrate -- path/to/consented-evaluation.jsonl
```

The default output is `calibration/profile.generated.json`. Provide a second argument to choose another path:

```bash
npm run calibrate -- path/to/consented-evaluation.jsonl calibration/profile.2026-08.json
```

The script opens the output with exclusive creation and refuses to overwrite an existing profile.

## Output

The generated JSON records:

- a date-versioned profile name;
- dataset size and source path;
- selected summary-review and preserve-failure thresholds;
- confusion-matrix counts;
- precision, recall, false-negative rate, and F1 score;
- generation timestamp and consent-required marker.

Generated output must be reviewed before it is referenced by an application release. Keep the dataset itself outside the repository.

## Dataset Governance

Do not place images, names, email addresses, demographic labels, provider URLs, or other personal data in this repository. The dataset governance record must cover:

- documented consent and collection purpose;
- data controller/processor responsibilities;
- retention and withdrawal handling;
- independent labeling instructions and annotator agreement;
- coverage of expected garments, poses, lighting, occlusions, and failure severity;
- a train/calibration/holdout split that prevents evaluation leakage;
- review of false negatives, inconclusive outcomes, and repair safety;
- subgroup and scenario coverage chosen without inferring sensitive traits from images;
- dataset and labeling versioning with named approval owners.

## Review Before Adoption

Before changing production thresholds:

1. Freeze and hash the governed dataset version.
2. Run calibration on the approved calibration split.
3. Evaluate the candidate profile on a separate holdout split.
4. Review critical false negatives individually.
5. Compare inconclusive and repair-eligibility rates.
6. Run controlled fixtures and mutation/regression tests.
7. Record reviewer approval, profile hash, code commit, and rollback profile.
8. Roll out with review-only decisions before enabling any automated pass path.

## Limitations

- A 5% false-negative constraint on one dataset is not a universal safety guarantee.
- F1 optimization may hide scenario-specific weaknesses.
- Calibration quality cannot exceed label and measurement quality.
- Changes to provider models, worker code, image preprocessing, or signal definitions can invalidate a profile.
- Skin Analysis availability and eligibility must not silently alter the meaning of a pass.
- Real-world approval automation requires continued monitoring, incident review, and periodic recalibration.

## Related Documentation

- [Project overview](../README.md)
- [Architecture and integrity policy](../docs/architecture.md)
- [Privacy and data handling](../docs/privacy.md)
- [Requirements traceability](../docs/requirements-traceability.md)
- [Production runbook](../docs/production-runbook.md)
