# Integrity calibration

`npm run calibrate -- path/to/consented-evaluation.jsonl` grid-searches conservative summary and preserve-zone thresholds while constraining the false-negative rate to 5% or less.

Each JSONL record must be independently reviewed and contain:

```json
{"sampleId":"opaque-id","expected":"fail","signals":{"summaryScore":0.74,"preserveZone":0.61,"alignmentReliable":true}}
```

Do not place images, names, emails, demographic labels, or provider URLs in this repository. Dataset governance must record consent, collection purpose, retention, annotator agreement, subgroup coverage chosen without sensitive-trait inference, and withdrawal handling. Generated profiles are immutable; the script refuses to overwrite an existing profile.
