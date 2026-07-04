/**
 * Shared category label map — the 12 real values from Person 4's
 * day1_enriched_submissions.json. Used by Badge.tsx (display) and
 * mockData.ts (grouping submissions into priorities).
 *
 * If Person 3/Person 4 change this taxonomy, update it here once —
 * every component that shows a category reads from this file.
 */
export const CATEGORY_LABELS: Record<string, string> = {
  "Mobility - Roads, Footpaths and Infrastructure": "Roads & Footpaths",
  "Water Supply and Services": "Water Supply",
  "Garbage and Unsanitary Practices": "Garbage",
  Pollution: "Pollution",
  "Traffic and Road Safety": "Traffic Safety",
  PWD: "Public Works",
  Streetlights: "Street Lights",
  Sanitation: "Sanitation",
  "Electricity and Power Supply": "Electricity",
  "Crime and Safety": "Crime & Safety",
  "Animal Husbandry": "Animal Husbandry",
  "Yellow Spot": "Yellow Spot",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

const URGENCY_WEIGHT: Record<string, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

export function urgencyWeight(level: string): number {
  return URGENCY_WEIGHT[level] ?? 1;
}
