// (c) 2026 Ash
// SPDX-License-Identifier: MIT
// server.test.js
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "test", version: "0" });

before(async () => {
  const server = fileURLToPath(new URL("../src/server.js", import.meta.url));
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [server] }));
});
after(() => client.close());

async function call(name, args) {
  const res = await client.callTool({ name, arguments: args });
  return { ...res, json: res.isError ? null : JSON.parse(res.content[0].text) };
}

test("lists the tools", async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ["japan_postal_lookup", "japan_postal_search"]);
});

test("lookup and search", async () => {
  const lookup = (await call("japan_postal_lookup", { code: "100-0005" })).json;
  assert.equal(lookup.results[0].address, "東京都千代田区丸の内");
  assert.match(lookup.dataAsOf, /^\d{4}-\d{2}-\d{2}$/);

  const search = (await call("japan_postal_search", { address: "札幌市中央区大通西5丁目" })).json;
  assert.equal(search.match, "town");
  assert.equal(search.results[0].code, "060-0042");
});

test("bad input is a tool error, not a crash", async () => {
  const res = await call("japan_postal_lookup", { code: "12-34" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /not a postal code/);
});
