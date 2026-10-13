// (c) 2026 Ash
// SPDX-License-Identifier: MIT
// postal.test.js
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";
import { data } from "../src/data.js";
import { lookup, search } from "../src/index.js";

const code = (address) => search(address).results.map((r) => r.code);

test("lookup accepts the usual ways of writing a code", () => {
  for (const input of ["1000005", "100-0005", "〒100-0005", "１００－０００５"]) {
    const { results } = lookup(input);
    assert.equal(results[0].address, "東京都千代田区丸の内", input);
    assert.equal(results[0].kana, "トウキョウトチヨダクマルノウチ");
    assert.equal(results[0].jisCode, "13101");
  }
});

test("lookup finds office codes", () => {
  const [office] = lookup("163-8001").results;
  assert.equal(office.kind, "office");
  assert.equal(office.name, "東京都庁");
  assert.equal(office.address, "東京都新宿区西新宿2丁目8-1");
});

test("lookup of an unknown or malformed code", () => {
  assert.deepEqual(lookup("000-0000"), { code: "000-0000", found: false, results: [] });
  assert.throws(() => lookup("12345"), /not a postal code/);
});

test("search: town, with and without the prefecture", () => {
  assert.deepEqual(code("東京都千代田区丸の内1-9-1"), ["100-0005"]);
  assert.deepEqual(code("府中市宮西町"), ["183-0022"]);
  assert.deepEqual(code("与那国町与那国"), ["907-1801"]); // 八重山郡 left out
});

test("search: spelling variants", () => {
  assert.deepEqual(code("東京都千代田区霞ヶ関1-1-1"), ["100-0013"]);
  assert.deepEqual(code("東京都千代田区霞ケ関1-1-1"), ["100-0013"]);
  assert.deepEqual(code("東京都　千代田区　丸ノ内"), ["100-0005"]);
});

test("search: 丁目 ranges in the note", () => {
  assert.deepEqual(code("札幌市中央区大通西5丁目"), ["060-0042"]);
  assert.deepEqual(code("札幌市中央区大通西5-1"), ["060-0042"]);
  assert.deepEqual(code("北海道札幌市中央区大通西二十丁目"), ["064-0820"]);
});

test("search: buildings and floors", () => {
  assert.deepEqual(code("東京都千代田区丸の内2-7-2 JPタワー 5階"), ["100-7005"]);
  assert.deepEqual(code("千代田区大手町1-3-1 JAビル"), ["100-6890"]); // floor unknown
  assert.deepEqual(code("大阪市北区中之島3-3-23 中之島ダイビル 地下1階"), ["530-6190"]);
});

test("search: Kyoto street names before the town", () => {
  assert.deepEqual(code("京都市中京区烏丸通二条下る秋野々町"), ["604-0847"]);
});

test("search: city only, partial and none", () => {
  const city = search("東京都利島村");
  assert.equal(city.match, "city");
  assert.equal(city.results[0].code, "100-0301");

  const part = search("丸の内");
  assert.equal(part.match, "partial");
  assert.ok(part.total > 10);
  assert.equal(part.results.length, 10);

  assert.equal(search("xyz").match, "none");
  assert.throws(() => search(" "), /Give an address/);
});

// Every town of the Japan Post data must be found again from its own address.
test("search finds every town from its address", () => {
  const missed = [];
  for (const t of data().towns) {
    const address = t.city.prefecture + t.city.city + t.town;
    const found = search(address, { limit: 1000 }).results.map((r) => r.code.replace("-", ""));
    if (!found.includes(t.code)) missed.push(`${t.code} ${address}`);
  }
  assert.deepEqual(missed, []);
});
