import { readFile, writeFile } from "node:fs/promises";

const [inputPath, outputPath = "calibration/profile.generated.json"] = process.argv.slice(2);
if (!inputPath) throw new Error("Usage: npm run calibrate -- consented-evaluation.jsonl [output.json]");
const rows = (await readFile(inputPath, "utf8")).split(/\r?\n/).filter(Boolean).map((line, index) => {
  const row = JSON.parse(line);
  if (!["pass", "fail"].includes(row.expected) || !row.signals) throw new Error(`Invalid row ${index + 1}`);
  return row;
});
if (rows.length < 100) throw new Error("Calibration requires at least 100 consented, independently labeled examples.");

let best = null;
for (let summary = 0.72; summary <= 0.9; summary += 0.01) {
  for (let preserve = 0.6; preserve <= 0.82; preserve += 0.01) {
    let tp = 0, tn = 0, fp = 0, fn = 0;
    for (const row of rows) {
      const predictedFail = row.signals.summaryScore < summary || row.signals.preserveZone < preserve || row.signals.alignmentReliable === false;
      if (predictedFail && row.expected === "fail") tp += 1;
      else if (!predictedFail && row.expected === "pass") tn += 1;
      else if (predictedFail) fp += 1;
      else fn += 1;
    }
    const recall = tp / Math.max(1, tp + fn);
    const precision = tp / Math.max(1, tp + fp);
    const falseNegativeRate = fn / Math.max(1, tp + fn);
    const f1 = 2 * precision * recall / Math.max(0.0001, precision + recall);
    const candidate = { summary: Number(summary.toFixed(2)), preserve: Number(preserve.toFixed(2)), tp, tn, fp, fn, recall, precision, falseNegativeRate, f1 };
    if (falseNegativeRate <= 0.05 && (!best || candidate.f1 > best.f1)) best = candidate;
  }
}
if (!best) throw new Error("No threshold profile met the maximum 5% false-negative constraint.");
const profile = { version: `calibrated_${new Date().toISOString().slice(0, 10)}`, dataset: { examples: rows.length, source: inputPath, consentRequired: true }, thresholds: { summaryReview: best.summary, preserveFail: best.preserve }, metrics: best, generatedAt: new Date().toISOString() };
await writeFile(outputPath, `${JSON.stringify(profile, null, 2)}\n`, { flag: "wx" });
console.log(`Wrote ${outputPath}: F1=${best.f1.toFixed(3)}, FNR=${best.falseNegativeRate.toFixed(3)}`);
