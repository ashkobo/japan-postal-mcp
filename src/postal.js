// (c) 2026 Ash
// SPDX-License-Identifier: MIT
// postal.js
// ---------------------------------------------------------------------------
// Postal code -> address, and address -> postal code.
//
// An address is matched from the left: prefecture (optional), city, then the
// longest town that starts the rest. Towns that Japan Post splits by 丁目,
// 番地, building or floor come back narrowed by the numbers in the address
// when they can be, otherwise all of them with their notes.

import { data } from "./data.js";

const KANJI_DIGITS = { 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

let index;

// PUBLIC
// ---------------------------------------------------------------------------

/**
 * Accepts "1000005", "100-0005", "〒100-0005" and full-width digits.
 * An unknown code returns an empty list, not an error.
 *
 * [Example]
 * lookup("100-0005").results[0].address // "東京都千代田区丸の内"
 */
export function lookup(code) {
  const digits = String(code)
    .normalize("NFKC")
    .replace(/[〒\s\-−‐ー]/g, "");
  if (!/^\d{7}$/.test(digits)) {
    throw new RangeError(`"${code}" is not a postal code (7 digits, e.g. 100-0005).`);
  }
  const rows = data().byCode.get(digits) ?? [];
  return { code: formatCode(digits), found: rows.length > 0, results: rows.map(format) };
}

/**
 * match is "town" (town found), "city" (only the city: the code for the rest of the city),
 * "partial" (the text appears inside addresses) or "none".
 *
 * [Example]
 * search("東京都千代田区丸の内1-9-1").results[0].code // "100-0005"
 * search("札幌市中央区大通西5丁目").results[0].code   // "060-0042"
 */
export function search(address, { limit = 10 } = {}) {
  const query = keyOf(String(address).replace(/^\s*〒?\s*\d{3}[-−‐ー]?\d{4}\s*/, ""));
  if (!query) throw new RangeError("Give an address, e.g. 東京都千代田区丸の内.");
  const { rows, match } = find(query);
  return {
    query: address,
    match,
    total: rows.length,
    results: rows.slice(0, limit).map(format),
  };
}

export function asOf() {
  return data().asOf;
}

// MATCHING
// ---------------------------------------------------------------------------

function find(query) {
  const { prefectures, cities, towns } = buildIndex();
  const pref = prefectures.find((p) => query.startsWith(p));
  const rest = pref ? query.slice(pref.length) : query;

  // City: the longest name that starts the rest (several when the name is shared)
  let best = 0;
  let hits = [];
  for (const c of cities) {
    if (pref && c.prefecture !== pref) continue;
    for (const key of c.keys) {
      if (!rest.startsWith(key) || key.length < best) continue;
      if (key.length > best) hits = [];
      best = key.length;
      hits.push(c);
    }
  }
  if (!hits.length) return partial(rest, pref, towns);

  const after = rest.slice(best);
  const rows = [...new Set(hits.flatMap((c) => c.towns))];
  const town = bestTown(rows, after);
  if (!town) return { match: "city", rows: rows.filter((r) => !r.town) };

  const same = rows.filter((r) => r.key === town.key);
  const tail = after.slice(after.indexOf(town.key) + town.key.length);
  return { match: "town", rows: narrow(same, rows, tail) };
}

// The longest town that starts the text, else the longest one inside it (京都: 通り names first).
function bestTown(rows, text) {
  let found;
  for (const r of rows) {
    if (!r.key || !text.includes(r.key)) continue;
    const score = [text.startsWith(r.key) ? 1 : 0, r.key.length, -text.indexOf(r.key)];
    if (!found || compare(score, found.score) > 0) found = { row: r, score };
  }
  return found?.row;
}

function narrow(same, all, tail) {
  // A building inside the town: 丸の内 + JPタワー -> 丸の内JPタワー, then the floor
  const base = same[0].key;
  const buildings = all.filter(
    (r) =>
      r.key.length > base.length &&
      r.key.startsWith(base) &&
      tail.includes(r.key.slice(base.length)),
  );
  if (buildings.length) return byFloor(buildings, tail);

  // 丁目 / 番地 ranges in the note
  const n = firstNumber(tail);
  if (n === undefined || same.length < 2) return same;
  const inRange = same.filter((r) => ranges(r.note)?.some(([a, b]) => n >= a && n <= b));
  if (inRange.length) return inRange;
  const others = same.filter((r) => !ranges(r.note));
  return others.length ? others : same;
}

function byFloor(rows, tail) {
  const m = /(地下|B)?(\d+)(?:階|F)/i.exec(tail);
  const floor = m && !m[1] ? `${Number(m[2])}階` : "地階・階層不明";
  const hit = rows.filter((r) => r.note === floor);
  return hit.length ? hit : rows;
}

function partial(text, pref, towns) {
  const rows = towns
    .filter((r) => (!pref || r.city.prefecture === pref) && r.fullKey.includes(text))
    .sort((a, b) => (b.key === text) - (a.key === text) || a.fullKey.length - b.fullKey.length);
  return { match: rows.length ? "partial" : "none", rows };
}

// HELPERS
// ---------------------------------------------------------------------------

function buildIndex() {
  if (index) return index;
  const { cities, towns } = data();
  const byCity = new Map([...cities.values()].map((c) => [c, []]));
  const rows = towns.map((t) => {
    const row = {
      ...t,
      key: keyOf(t.town),
      fullKey: keyOf(t.city.prefecture + t.city.city + t.town),
    };
    byCity.get(t.city).push(row);
    return row;
  });

  // Each city is found by its name, without its 郡, and (for wards) by the bare 市 name
  const list = [];
  for (const [c, cityTowns] of byCity) {
    const names = [c.city, c.city.replace(/^.+?郡/, "")];
    const ward = /^(.+?市).+区$/.exec(c.city);
    if (ward) names.push(ward[1]);
    const keys = [...new Set(names.map(keyOf))];
    list.push({ prefecture: c.prefecture, keys, towns: cityTowns });
  }
  const prefectures = [...new Set(list.map((c) => c.prefecture))];
  index = { prefectures, cities: list, towns: rows };
  return index;
}

// Spelling variants that people mix freely: 霞ヶ関 / 霞が関 / 霞ケ関, 丸ノ内 / 丸の内.
function keyOf(text) {
  return text
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[−‐－―]/g, "-")
    .replace(/(?<=\d)ー(?=\d)/g, "-")
    .replace(/ヶ/g, "ケ")
    .replace(/(?<=\p{Script=Han})[ケがガヵ](?=\p{Script=Han})/gu, "ケ")
    .replace(/(?<=\p{Script=Han})ノ(?=\p{Script=Han})/gu, "の");
}

// "5丁目", "5-1", "五丁目" -> 5
function firstNumber(text) {
  const m = /^(\d+|[〇一二三四五六七八九十]+)(?:丁目|番|-|$)/.exec(text);
  if (!m) return undefined;
  if (/^\d/.test(m[1])) return Number(m[1]);
  const [tens, ones] = m[1].includes("十") ? m[1].split("十") : ["", m[1]];
  const ten = m[1].includes("十") ? (KANJI_DIGITS[tens] ?? 1) : 0;
  return ten * 10 + (KANJI_DIGITS[ones] ?? 0);
}

// "1〜19丁目" -> [[1, 19]], "1、3丁目" -> [[1, 1], [3, 3]]; other notes -> undefined
function ranges(note) {
  const m = /^([\d〜、・]+)(?:丁目|番地|番)$/.exec(note);
  if (!m) return undefined;
  return m[1].split(/[、・]/).map((part) => {
    const [a, b] = part.split("〜").map(Number);
    return [a, b ?? a];
  });
}

function compare(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

function formatCode(digits) {
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

function format(row) {
  const { city } = row;
  const common = {
    code: formatCode(row.code),
    prefecture: city.prefecture,
    prefectureCode: city.jisCode.slice(0, 2),
    city: city.city,
    jisCode: city.jisCode,
    town: row.town,
  };
  if (row.name !== undefined) {
    return {
      kind: "office",
      ...common,
      name: row.name,
      nameKana: row.nameKana,
      street: row.street,
      address: city.prefecture + city.city + row.town + row.street,
    };
  }
  return {
    kind: "area",
    ...common,
    ...(row.note && { note: row.note }),
    address: city.prefecture + city.city + row.town,
    kana: city.prefectureKana + city.cityKana + row.townKana,
  };
}
