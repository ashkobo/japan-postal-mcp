// (c) 2026 Ash
// SPDX-License-Identifier: MIT
// check-data.js
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const directory = new URL("../data/", import.meta.url);
const meta = JSON.parse(await readFile(new URL("meta.json", directory), "utf8"));
assert.match(meta.asOf, /^\d{4}-\d{2}-\d{2}$/, "Data needs an ISO source date.");
assert.equal(new Date(`${meta.asOf}T00:00:00Z`).toISOString().slice(0, 10), meta.asOf);
const cities = await rows("cities.tsv", 5);
const towns = await rows("towns.tsv", 5);
const offices = await rows("offices.tsv", 6);
assert.ok(
  cities.length > 1000 && towns.length > 100000 && offices.length > 20000,
  "Unexpectedly small dataset: investigate the download before releasing.",
);
const codes = new Set(cities.map((row) => row[0]));
assert.equal(codes.size, cities.length, "Duplicate city codes.");
for (const city of cities) assert.match(city[0], /^\d{5}$/);
for (const row of [...towns, ...offices]) {
  assert.match(row[0], /^\d{7}$/, "Postal codes must retain leading zeros.");
  assert.ok(codes.has(row[1]), "Unknown city reference.");
}

const report = {
  dataAsOf: meta.asOf,
  cities: cities.length,
  towns: towns.length,
  offices: offices.length,
};
if (process.argv.includes("--remote")) {
  const response = await fetch(
    "https://www.post.japanpost.jp/service/search/zipcode/download/utf-zip.html",
    { signal: AbortSignal.timeout(20000) },
  );
  if (!response.ok) throw new Error(`Upstream returned HTTP ${response.status}.`);
  const page = await response.text();
  const match = /(\d{4})年(\d{1,2})月(\d{1,2})日更新/.exec(page);
  if (!match) throw new Error("Cannot read the official update date; review the upstream format.");
  const latest = match
    .slice(1)
    .map((part) => part.padStart(2, "0"))
    .join("-");
  report.upstreamAsOf = latest;
  console.log(JSON.stringify(report));
  if (latest !== meta.asOf)
    throw new Error("Data update needed. Follow MAINTENANCE.md before release.");
} else {
  console.log(JSON.stringify(report));
}

async function rows(name, columns) {
  const text = await readFile(new URL(name, directory), "utf8");
  const result = text
    .replace(/\r?\n$/, "")
    .split("\n")
    .map((line) => line.split("\t"));
  assert.ok(
    result.every((row) => row.length === columns),
    `${name}: unexpected column count.`,
  );
  return result;
}
