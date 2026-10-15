// (c) 2026 Ash
// SPDX-License-Identifier: MIT
// data-check.test.js
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

test("data release guard rejects truncated rows, invalid references and bad source dates", async () => {
  const root = await mkdtemp(join(tmpdir(), "data-guard-"));
  try {
    await mkdir(join(root, "scripts"));
    await writeFile(join(root, "package.json"), JSON.stringify({ type: "module" }));
    await cp(resolve("data"), join(root, "data"), { recursive: true });
    await cp(resolve("scripts/check-data.js"), join(root, "scripts/check-data.js"));
    const run = () =>
      spawnSync(process.execPath, [join(root, "scripts/check-data.js")], {
        encoding: "utf8",
        windowsHide: true,
        timeout: 10000,
      });
    assert.equal(run().status, 0);
    const file = join(root, "data", "towns.tsv");
    const original = await readFile(file, "utf8");
    await writeFile(file, original.replace(/^(\d{7})\t\d{5}\t/, "$1\t99999\t"));
    const unknown = run();
    assert.notEqual(unknown.status, 0);
    assert.match(unknown.stderr, /Unknown city reference/);
    await writeFile(file, "bad\n");
    assert.notEqual(run().status, 0);
    await writeFile(file, original);
    await writeFile(join(root, "data/meta.json"), JSON.stringify({ asOf: "not-a-source-date" }));
    assert.notEqual(run().status, 0);
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
