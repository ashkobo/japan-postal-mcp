#!/usr/bin/env node
// (c) 2026 Ash
// SPDX-License-Identifier: MIT
// server.js
// ---------------------------------------------------------------------------
// MCP server over stdio. The postal data ships with the package: no network, no API keys.
// Each tool is a thin wrapper over the library in index.js.

import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { asOf, lookup, search } from "./index.js";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const READ_ONLY = { readOnlyHint: true, openWorldHint: false };

// HELPERS
// ---------------------------------------------------------------------------

// A bad input comes back as a tool error instead of crashing the server.
function reply(fn) {
  return async (args) => {
    try {
      const result = { ...fn(args), dataAsOf: asOf() };
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: err.message }] };
    }
  };
}

// TOOLS
// ---------------------------------------------------------------------------

const server = new McpServer({ name: "japan-postal-mcp", version });

server.registerTool(
  "japan_postal_lookup",
  {
    title: "Japanese postal code to address",
    description:
      "Address for a Japanese postal code (郵便番号), e.g. 100-0005 → 東京都千代田区丸の内. " +
      "Also finds the codes of companies and offices (事業所の個別郵便番号). " +
      "Returns prefecture, city, town, reading in katakana and the JIS city code. " +
      "A note such as 1〜19丁目 or 5階 tells which part of the town the code covers.",
    inputSchema: {
      code: z.string().describe('7 digits, with or without "-" and 〒, e.g. "100-0005".'),
    },
    annotations: READ_ONLY,
  },
  reply(({ code }) => lookup(code)),
);

server.registerTool(
  "japan_postal_search",
  {
    title: "Find a Japanese postal code from an address",
    description:
      "Postal code (郵便番号) for a Japanese address, e.g. 東京都千代田区丸の内2-7-2 → 100-0005. " +
      "Give the address as written; the prefecture can be left out. " +
      "Street numbers, building names and floors are used to pick the right code when the town is split. " +
      'match: "town" = found, "city" = only the city matched (the general code for the city), ' +
      '"partial" = the text appears in these addresses, "none" = not found.',
    inputSchema: {
      address: z.string().describe('Japanese address, e.g. "札幌市中央区大通西5丁目".'),
      limit: z.number().int().min(1).max(100).optional().describe("Max results. Default 10."),
    },
    annotations: READ_ONLY,
  },
  reply(({ address, limit }) => search(address, { limit })),
);

await server.connect(new StdioServerTransport());
