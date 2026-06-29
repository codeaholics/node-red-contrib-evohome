# Backfilling history by replaying parsed messages

We have ~90,000,000 parsed messages in InfluxDB (`ParsedRadioMessages`, columns:
`type, len, cmd, addr0, addr1, addr2, payload`) going back almost a decade —
logged raw since before most decoders existed. As decoders/formatters graduate
from stub to real, we want to **replay** that history through the pipeline so a
decade of each signal materialises in the decoded measurements.

See also: [vertical-slices.md](vertical-slices.md),
[../docs/message-formats.md](../docs/message-formats.md).

## Short version: reuse the code, not the runtime

Node-RED is the wrong tool for a 90M-row backfill — but the decoders/formatters
aren't really Node-RED, they're plain Node modules. Leverage *those*.

## Why not Node-RED for this

Node-RED is built for live event streams, not bulk batch:

- Per-message object overhead × 90M (each `msg` cloned through the flow) — slow
  and memory-hungry.
- No native batched read or batched write; you'd hand-roll backpressure.
- Awkward to checkpoint/resume a multi-hour job.
- **The killer:** the influxdb-out node timestamps points at write time. For
  replay we *must* write each decoded point with its **original** timestamp,
  which the live wiring doesn't do.

Keep Node-RED for the live tap. Do history with a script.

## The key move: extract the decode orchestration into a shared module

The individual decoders are already pure and reusable. But the *orchestration* —
pick decoder by cmd, `incorrectSite()` skip, dedup caching, multi-result
fan-out — currently lives **inside** `evohome-decoder.js`. If the backfill script
reimplements that, the two will drift.

So factor that inner logic into a plain module, e.g. `src/decode-message.js`,
taking a `parsed` object + config and returning decoded results (applying
site-filter + dedup). Then **both** the Node-RED node and the backfill script
call it. One source of truth; replay is guaranteed identical to live.

(Precedent: the parser was already extracted from its node — it was useful for
tests. Same pattern, now with a second consumer.)

## The backfill script shape

A standalone Node script (~100 lines) that:

1. **Reads `ParsedRadioMessages` in time-ordered, cmd-filtered chunks** (e.g. per
   week) via the Influx query API — never pull 90M at once.
2. Reconstructs `parsed = {type, addr:[addr0,addr1,addr2], cmd, len, payload}`
   directly from the columns. Skips `hgi-parser` entirely — it's already parsed.
3. Runs it through the shared `decode-message` module, then the matching
   formatter.
4. Emits **line protocol with the original nanosecond timestamp**, batched
   (~5k points/write).

Most rows have no decoder or are OpenTherm/unhandled → skipped cheaply.
Realistically a few-hours one-off.

## ETL details that matter

- **Timestamp preservation** — the whole point. Carry the source ns timestamp
  onto every output point.
- **Idempotency** — Influx overwrites on identical (measurement, tags,
  timestamp, field), so re-running a window is safe... *unless a decoder change
  alters tags*, which creates new series alongside the old. So: when re-filling
  after changing a decoder, **drop the target measurement first**, then rebuild.
- **Dedup in time order** — since we read chronologically, the dedup cache works
  exactly as live. Keep it on: it matches go-forward data *and* slashes write
  volume (step-function data like setpoints collapses to changes + heartbeat —
  often 100× fewer points). Make it a flag.
- **Per-message error isolation** — some decoders throw on malformed payloads
  (the live node catches and logs). Wrap per-message, count failures, continue —
  don't let one bad row kill a 90M run.
- **Resumability** — log the last completed time window; on crash, resume from
  there (safe because writes are idempotent).

## The practical workflow

Don't reprocess all 90M every time a decoder changes. **Backfill selectively by
cmd:** when the DHW decoder is enriched, replay only `cmd =~ /1F41|10A0/` over the
range. The cmd filter in the source query cuts the work enormously, and the
dedup/overwrite semantics make it safe to re-run.

So the model: each time a decoder/formatter graduates from stub to real (the
Phase B work), run the backfill for just that command — and a decade of that
signal appears in the decoded measurements. Every decoder we add isn't just
go-forward; it unlocks ~10 years of history for that signal.

## Suggested order

1. Extract `src/decode-message.js` from `evohome-decoder.js` (good refactor on its
   own merits; prerequisite for clean replay). Node + script both call it.
2. Write the backfill script against the Influx setup.
3. Run it per-command as decoders mature.
