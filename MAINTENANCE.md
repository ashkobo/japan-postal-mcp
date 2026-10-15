# Maintaining japan-postal-mcp

Japan Post publishes a monthly dataset. The package is a snapshot; an installed copy does
not refresh itself. Treat source updates and validation as release work, not a silent change
to an installed user's answers.

## Weekly check and monthly update

`npm run data:status` validates the local files and compares `data/meta.json` with the official
source date. It performs no writes. The Data freshness workflow is read-only and runs weekly
once the workflow is published. A mismatch or an unreadable upstream format fails the check;
it does not publish or commit new data.

1. Run `npm run data:status` after the month-end publication, and before a data-dependent release.
2. If changed, run `npm run data` to download the current area and office data.
3. Run `npm run data:check`. It checks source date, row counts, code widths and city references.
   A reduced row count or format change requires investigation; do not lower guards just to pass.
4. Inspect `git diff --stat -- data` and `git diff -- data/meta.json`. Confirm additions and
   removals against the official source and keep the source date in the release notes.
5. Run `npm test`, `npm run lint`, `npm run demo` and `npm run verify:package`.
6. Review the candidate's CI results, version and packed files before the release approval.

If a download or validation fails, do not release the modified dataset. Compare against the
last known good version and fix the download/parser first. The official source date is not
the download time. Area and office feeds should be reviewed together for a data release.

## Precision and ambiguous input

The full-row round trip protects coverage of the source data. It does not measure the false
positive rate on arbitrary human addresses. For matching changes, include previously unseen
inputs, misspellings, omitted prefectures, shared city names, 丁目 boundaries, building floors,
Kyoto street names, and the real town named 一円 in 多賀町. Inspect all candidates, not just the first.
Address existence and deliverability are outside scope. Add a regression for each confirmed
matching defect and report uncertainty through `match`, `total` and notes.

## Sources and reports

- [Japan Post downloads](https://www.post.japanpost.jp/service/search/zipcode/download/)
- [Area data redistribution terms](https://www.post.japanpost.jp/service/search/zipcode/download/utf-readme.html)
- [Office data redistribution terms](https://www.post.japanpost.jp/service/search/zipcode/download/office/readme.html)

Ask for a public or synthetic address, expected code, data date and the returned candidates.
Do not ask a reporter to post their home address, customer list or a shipping label publicly.
