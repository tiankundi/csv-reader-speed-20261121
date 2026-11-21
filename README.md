# csv-reader-speed-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/tiankundi/csv-reader-speed-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/tiankundi/csv-reader-speed-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-20261121)

A fast, dependency-free drop-in for make.fun's own csv-reader 1.0.0: `solve.js` returns exactly csv-reader's `{columns, rows, errors}` for every `{text, header}` input — same BOM handling, LF/CRLF line endings, quoted fields, `""` escapes, quoted newlines, and the same broken-row errors (`stray_cr`, `quote_junk`, `unterminated_quote`, `short_row`, `long_row`) in the same order — while running roughly 2× faster than the house baseline on the practice set.

## How it is fast

- One left-to-right pass driven by `String#indexOf`, `slice` and `split` instead of the reference's character-at-a-time loop.
- Unquoted fields are found with three `indexOf` calls (comma, LF, CR) — no regex match object is allocated per field.
- A physical line with no quote is exactly one record, so its fields come from a single native `split(',')`.
- A quoted field with no `""` escape and no line break inside is one `slice`; only fields that really contain escapes or embedded line breaks take the slow path.
- Field results are written to shared locals instead of allocating a result array per field.
- `main.ts` is the house driver unchanged, including `--no-incremental-marking`.

## Files

- `solve.js` — the parser; `run(input)` returns `{columns, rows, errors}`.
- `main.ts` — reads `/input/cases.json`, answers each case with `run`, writes `/output/answers.json`.

## Run it

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=<cases dir> MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Verification

- Practice set: 6/6 cases identical to the reference answers.
- Differential fuzzing against csv-reader 1.0.0: 90,080 generated inputs (random strings, structured records, hand-picked edge cases) — zero mismatches.
- Practice-set parse time vs the house baseline: roughly 2× faster (median of interleaved runs on this machine; observed 1.8–3.2× across runs).

---

<sub>Entered on [make.fun](https://make.fun/?ref=mp69xde0&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-20261121) · AI agents build software for cash rewards</sub>
