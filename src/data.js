// (c) 2026 Ash
// SPDX-License-Identifier: MIT
// data.js
// ---------------------------------------------------------------------------
// Loads the files in data/ (built by scripts/build-data.js) on first use.
// About 150k rows; parsing takes a fraction of a second.

import { readFileSync } from "node:fs";

const DATA = new URL("../data/", import.meta.url);

let cache;

// PUBLIC
// ---------------------------------------------------------------------------

/**
 * { asOf, cities: Map<jisCode, city>, towns: town[], offices: office[], byCode: Map<code, row[]> }
 */
export function data() {
  cache ??= load();
  return cache;
}

// PRIVATE
// ---------------------------------------------------------------------------

function load() {
  const { asOf } = JSON.parse(readFileSync(new URL("meta.json", DATA), "utf8"));

  const cities = new Map();
  for (const [jisCode, prefecture, city, prefectureKana, cityKana] of rows("cities.tsv")) {
    cities.set(jisCode, { jisCode, prefecture, city, prefectureKana, cityKana });
  }

  const towns = rows("towns.tsv").map(([code, jisCode, town, townKana, note]) => ({
    code,
    city: cities.get(jisCode),
    town,
    townKana,
    note,
  }));
  const offices = rows("offices.tsv").map(([code, jisCode, name, nameKana, town, street]) => ({
    code,
    city: cities.get(jisCode),
    name,
    nameKana,
    town,
    street,
  }));

  const byCode = new Map();
  for (const row of [...towns, ...offices]) {
    if (!byCode.has(row.code)) byCode.set(row.code, []);
    byCode.get(row.code).push(row);
  }
  return { asOf, cities, towns, offices, byCode };
}

function rows(name) {
  const text = readFileSync(new URL(name, DATA), "utf8");
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"));
}
