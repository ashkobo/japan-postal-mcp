// (c) 2026 Ash
// SPDX-License-Identifier: MIT
// demo.js
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { lookup, search } from "japan-postal-mcp";

assert.equal(lookup("100-0005").results[0].address, "東京都千代田区丸の内");
for (const [address, expected] of [
  ["東京都千代田区丸の内2-7-2 JPタワー 5階", "100-7005"],
  ["札幌市中央区大通西5丁目", "060-0042"],
  ["京都市中京区烏丸通二条下る秋野々町", "604-0847"],
  ["滋賀県犬上郡多賀町一円", "522-0317"],
]) {
  const result = search(address);
  assert.ok(
    result.results.some((row) => row.code === expected),
    address,
  );
  console.log(`${address} -> ${expected} (${result.match})`);
}
