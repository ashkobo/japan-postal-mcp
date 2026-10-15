<img src=".github/assets/ash.png" alt="" width="110" align="right">

# japan-postal-mcp

**Give your AI agent the Japanese postal code book.** An MCP server for 郵便番号: postal code → address, and address → postal code.

- Offline — the whole Japan Post data ships with the package. No network, no API keys.
- All 124,000+ area codes and 22,000+ company / office codes (事業所の個別郵便番号).
- Reads addresses as people write them: with or without the prefecture or 郡, 霞ヶ関 / 霞が関, full-width digits, 丁目 and 番地, building names and floors, Kyoto street names (烏丸通二条下る).
- Works with Claude Code, Codex, Claude Desktop, Cursor and any MCP client.

LLMs often guess postal codes, and get them almost right — which is worse than wrong on a form or a shipping label.

## Install

Claude Code:

```sh
claude mcp add japan-postal -- npx -y japan-postal-mcp
```

Codex:

```sh
codex mcp add japan-postal -- npx -y japan-postal-mcp
```

Claude Desktop / Cursor (`mcpServers` in the config file):

```json
{
  "mcpServers": {
    "japan-postal": { "command": "npx", "args": ["-y", "japan-postal-mcp"] }
  }
}
```

Requires Node.js 18 or later.

## Tools

| Tool | What it does | Example |
|---|---|---|
| `japan_postal_lookup` | Address for a postal code, with katakana reading and JIS city code. Also company / office codes. | `100-0005` → 東京都千代田区丸の内 |
| `japan_postal_search` | Postal code for an address | `札幌市中央区大通西5丁目` → `060-0042` |

Where Japan Post splits a town, the number, building and floor in the address pick the right code:

| Address | Code |
|---|---|
| 東京都千代田区丸の内1-9-1 | 100-0005 |
| 東京都千代田区丸の内2-7-2 JPタワー 5階 | 100-7005 |
| 札幌市中央区大通西5丁目 | 060-0042 (1〜19丁目) |
| 札幌市中央区大通西20丁目 | 064-0820 (20〜28丁目) |
| 京都市中京区烏丸通二条下る秋野々町 | 604-0847 |

Each result carries `dataAsOf`, the date of the Japan Post data it was built from.

## As a library

<!-- readme-trial: library -->
```js
import assert from "node:assert/strict";
import { lookup, search } from "japan-postal-mcp";

assert.equal(lookup("100-0005").results[0].address, "東京都千代田区丸の内");
assert.equal(search("東京都千代田区霞ヶ関1-1-1").results[0].code, "100-0013");
```

## Try an address

After registering the server, ask: "Find the postal code for 東京都千代田区丸の内2-7-2 JPタワー 5階."
The agent should call `japan_postal_search` and return `100-7005` with a source date.
From a source checkout, `npm run demo` checks this address, a Sapporo 丁目 range and a Kyoto
street address, then prints the matched codes.

Use this for offline postal lookup and approximate address-to-code matching in an agent.
For an online master, consider the [Japan Post API](https://www.post.japanpost.jp/question/754.html).
For another offline MCP implementation, see
[jp-postal-mcp-server](https://github.com/h-kazuki-pixel/jp-postal-mcp-server).
Offline operation alone is not unique; choose by the matching behavior your addresses need.

This is not address existence verification, building validation or a delivery guarantee.
Check `match`, `total` and all returned candidates. `partial` is a text match, and a city-only
result does not identify a town. A guessed or misspelled address can match a plausible candidate.
Do not silently select the first candidate for an ambiguous shipping address.

## Data

From [Japan Post](https://www.post.japanpost.jp/zipcode/download.html) (日本郵便), who do not claim copyright on it. Japan Post updates it at the end of every month; `npm run data` rebuilds `data/` from the latest files.

## 日本語

AI エージェントに郵便番号簿を渡す MCP サーバーです。郵便番号から住所、住所から郵便番号を引けます。日本郵便のデータを丸ごと同梱しているので、ネットにつながず、API キーも要りません。

都道府県や郡の省略、「霞ヶ関／霞が関」のような表記ゆれ、丁目・番地、ビル名と階、京都の通り名にも対応しています。大企業や役所の個別郵便番号（事業所）も引けます。

## License

MIT. The postal data is from Japan Post.

## Verify and maintain

From a checkout, `npm run verify:package` checks a real tarball in a fresh consumer, including
MCP initialization and a lookup. `npm run data:check` validates the complete bundled dataset;
`npm run data:status` compares its source date with Japan Post without modifying files.
The weekly Data freshness workflow performs the same read-only check after it is pushed.
See [MAINTENANCE.md](MAINTENANCE.md) for monthly updates, regression checks and release steps.

If the client shows no tools, confirm Node.js 18+, recheck its `mcpServers` entry and restart it.
If no address matches, try the prefecture and municipality explicitly. Review `dataAsOf` before
using an answer for a recently changed address. The installed package does not update itself.
