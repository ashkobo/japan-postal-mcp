#!/usr/bin/env node
// (c) 2026 Ash
// SPDX-License-Identifier: MIT
// build-data.js
// ---------------------------------------------------------------------------
// Downloads the postal code data from Japan Post and writes the compact files
// in data/. Run with `npm run data`. Japan Post publishes an update at the end
// of every month, and does not claim copyright on this data.
//
//   cities.tsv   jisCode  prefecture  city  prefectureKana  cityKana
//   towns.tsv    code  jisCode  town  townKana  note
//   offices.tsv  code  jisCode  name  nameKana  town  street

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

const BASE = "https://www.post.japanpost.jp/service/search/zipcode/download";
const DATA = new URL("../data/", import.meta.url);
const CACHE = new URL("../.cache/", import.meta.url);

// MAIN
// ---------------------------------------------------------------------------

const page = await download("utf-zip.html", "utf-zip.html");
const updated = /(\d{4})年(\d{1,2})月(\d{1,2})日更新/.exec(page.toString("utf8"));
if (!updated) throw new Error("Cannot find the update date on the download page.");
const asOf = updated
  .slice(1)
  .map((v) => v.padStart(2, "0"))
  .join("-");

const ken = parseCsv(
  new TextDecoder("utf-8").decode(unzip(await download("utf/zip/utf_ken_all.zip", "ken.zip"))),
);
const office = parseCsv(
  new TextDecoder("shift_jis").decode(
    unzip(await download("office/zip/jigyosyo.zip", "jigyosyo.zip")),
  ),
);

// Cities and towns
const cities = new Map();
const towns = [];
for (const r of ken) {
  const [jis, , code, prefKana, cityKana, townKana, pref, city, town] = r.map(clean);
  cities.set(jis, [jis, pref, city, prefKana, cityKana]);
  towns.push([code, jis, ...splitTown(town, townKana, city)]);
}

// Offices (事業所の個別郵便番号)
const offices = office.map((r) => {
  const [jis, nameKana, name, , , town, street, code] = r.map(clean);
  return [code, jis, name, nameKana.replace(/\s+/g, ""), town, street];
});

mkdirSync(DATA, { recursive: true });
writeTsv("cities.tsv", [...cities.values()]);
writeTsv("towns.tsv", towns);
writeTsv("offices.tsv", offices);
writeFileSync(
  new URL("meta.json", DATA),
  `${JSON.stringify({ asOf, source: "Japan Post (日本郵便) postal code data" }, null, 2)}\n`,
);
console.log(
  `asOf ${asOf}: ${cities.size} cities, ${towns.length} towns, ${offices.length} offices`,
);

// PRIVATE
// ---------------------------------------------------------------------------

// With --cached, reuses the files of the last download (.cache/) while working on this script.
async function download(path, name) {
  const file = new URL(name, CACHE);
  if (process.argv.includes("--cached") && existsSync(file)) return readFileSync(file);
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${BASE}/${path}`);
  const body = Buffer.from(await res.arrayBuffer());
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(file, body);
  return body;
}

// Reads the first file of a zip archive through its central directory.
function unzip(zip) {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("Not a zip file.");
  const cd = zip.readUInt32LE(eocd + 16);
  const method = zip.readUInt16LE(cd + 10);
  const size = zip.readUInt32LE(cd + 20);
  const local = zip.readUInt32LE(cd + 42);
  const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const body = zip.subarray(start, start + size);
  return method === 0 ? body : inflateRawSync(body);
}

function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const fields = [];
    const re = /"([^"]*(?:""[^"]*)*)"|([^,]*)/g;
    for (let m = re.exec(line); m; m = re.exec(line)) {
      fields.push(m[1] === undefined ? m[2] : m[1].replaceAll('""', '"'));
      if (re.lastIndex >= line.length) break;
      re.lastIndex++; // skip the comma
    }
    rows.push(fields);
  }
  return rows;
}

// Full-width digits and letters, half-width kana -> NFKC; dashes -> "-".
function clean(value) {
  return value
    .normalize("NFKC")
    .replace(/[−‐－―]/g, "-")
    .replace(/　/g, " ")
    .trim();
}

// The town field mixes the town name with notes. Returns [town, kana, note].
//   以下に掲載がない場合            -> the rest of the city
//   利島村一円                      -> the whole village
//   川口町の次に番地がくる場合      -> the city followed directly by a lot number
//   大通西(1〜19丁目)               -> town 大通西, note 1〜19丁目
function splitTown(town, kana, city) {
  if (town === "以下に掲載がない場合") return ["", "", town];
  if (/の次に.*番地.*がくる場合/.test(town)) return ["", "", town];
  if (town.length > 2 && town.endsWith("一円") && city.endsWith(town.slice(0, -2))) {
    return ["", "", "一円"];
  }

  const m = /^(.*?)\((.*)\)$/.exec(town);
  if (!m) return [town, kana, ""];
  return [m[1], kana.replace(/\(.*\)$/, ""), m[2]];
}

function writeTsv(name, rows) {
  const text = rows.map((r) => r.join("\t")).join("\n");
  writeFileSync(new URL(name, DATA), `${text}\n`);
}
