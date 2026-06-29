#!/usr/bin/env node
/* eslint-disable no-restricted-syntax, no-continue, no-await-in-loop, import/no-extraneous-dependencies */
// Replays ParsedRadioMessages through the decode/format pipeline and writes the
// decoded points back to InfluxDB, preserving each message's original time.
// Reuses the exact live modules (hgi-decoder + formatters) so there is no drift.
//
//   node scripts/backfill.js --config site.json --url http://localhost:8086 \
//       --db evohome --from 2017-01-01 --cmd 1F41,10A0 [--measurement-suffix _test] [--dry-run]
//
// --drop-measurement <names> deletes those measurements (all their data) before
// the run — for a clean rebuild from the raw log. The same --measurement /
// --measurement-suffix rewrite is applied, so it drops exactly what this run
// writes to (e.g. with --measurement-suffix _test it drops DHWSetpoint_test, not
// DHWSetpoint). DESTRUCTIVE: ensure the window covers everything you want to
// keep. Honoured only when not --dry-run.

const fs = require('node:fs');
const {parseArgs} = require('node:util');
const {pipeline} = require('node:stream/promises');
const cliProgress = require('cli-progress');

const decode = require('../src/proto/hgi-decoder');
const formatters = require('../src/influxdb-formatters');
const Config = require('../src/config');
const {
    resolveWindow, rowToParsed, toLineProtocol, measurementRewriter,
    createCollisionTracker, dropMeasurementStatement, batch
} = require('./backfill/lib');
const {queryRows, writeLines, execute} = require('./backfill/influx');

const MEASUREMENT = 'ParsedRadioMessages';

const {values: opts} = parseArgs({
    options: {
        'config': {type: 'string'},
        'url': {type: 'string'},
        'db': {type: 'string'},
        'user': {type: 'string'},
        'pass': {type: 'string'},
        'from': {type: 'string'},
        'to': {type: 'string'},
        'duration': {type: 'string'},
        'cmd': {type: 'string'},
        'measurement': {type: 'string'},
        'measurement-suffix': {type: 'string'},
        'drop-measurement': {type: 'string'},
        'batch-size': {type: 'string', default: '5000'},
        'chunk-size': {type: 'string', default: '10000'},
        'dry-run': {type: 'boolean', default: false},
        'strict': {type: 'boolean', default: false}
    }
});

function required(name) {
    if (!opts[name]) throw new Error(`--${name} is required`);
    return opts[name];
}

function buildQuery({fromMs, toMs, cmds}) {
    const fromIso = new Date(fromMs).toISOString();
    const toIso = new Date(toMs).toISOString();
    let where = `time >= '${fromIso}' AND time < '${toIso}'`;
    if (cmds.length) where += ` AND cmd =~ /^(${cmds.join('|')})$/`;
    return `SELECT * FROM "${MEASUREMENT}" WHERE ${where} ORDER BY time ASC`;
}

async function main() {
    const config = new Config(JSON.parse(fs.readFileSync(required('config'), 'utf8')));
    const baseUrl = required('url');
    const db = required('db');
    const auth = opts.user ? {user: opts.user, pass: opts.pass} : undefined;
    const {fromMs, toMs} = resolveWindow(opts);
    const cmds = (opts.cmd || '').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
    const rewrite = measurementRewriter({name: opts.measurement, suffix: opts['measurement-suffix']});
    const batchSize = Number(opts['batch-size']);
    const dryRun = opts['dry-run'];

    // Optional clean-rebuild: drop named measurements before writing. Destructive,
    // so it's skipped under --dry-run (we only report what would happen).
    const dropList = (opts['drop-measurement'] || '').split(',').map((m) => m.trim()).filter(Boolean);
    for (const name of dropList) {
        // Drop exactly what we'll write to: apply the same suffix/name rewrite the
        // points get, so --drop-measurement DHWSetpoint with --measurement-suffix
        // _test drops DHWSetpoint_test, never the real measurement.
        const target = rewrite({measurement: name}).measurement;
        if (dryRun) {
            process.stdout.write(`[dry-run] would drop measurement "${target}" (all its data)\n`);
        } else {
            process.stdout.write(`Dropping measurement "${target}" (all its data)...\n`);
            await execute({baseUrl, db, auth}, dropMeasurementStatement(target));
        }
    }

    const q = buildQuery({fromMs, toMs, cmds});

    // One cache for the whole run, threaded through every decode call so dedup
    // behaves exactly as the live node does over the stream.
    const cache = {};
    // Tracks points that overwrite an earlier one (same series + ms timestamp);
    // these explain any gap between points written and rows InfluxDB stores.
    const collisions = createCollisionTracker();
    const stats = {
        read: 0, written: 0, skipped: 0, errors: 0, batches: 0
    };

    const bar = new cliProgress.SingleBar({
        format: 'backfill [{bar}] {percentage}% | read {read} written {written} skipped {skipped} '
            + 'err {errors} | ETA {eta_formatted}',
        etaBuffer: 200
    }, cliProgress.Presets.shades_classic);
    bar.start(toMs - fromMs, 0, stats);

    let lastRender = 0;
    function progress(timeMs) {
        const nowWall = Date.now();
        if (nowWall - lastRender < 250) return;
        lastRender = nowWall;
        bar.update(Math.min(timeMs - fromMs, toMs - fromMs), stats);
    }

    async function* transform(rows) {
        for await (const row of rows) {
            stats.read += 1;
            const timeMs = row.time;
            progress(timeMs);

            let decoded;
            try {
                decoded = decode(rowToParsed(row), config, {cache, now: timeMs});
            } catch (e) {
                stats.errors += 1;
                if (opts.strict) throw e;
                continue;
            }

            for (const d of decoded) {
                const formatter = formatters[d.type];
                if (!formatter) { stats.skipped += 1; continue; }
                const point = rewrite(formatter(d));
                collisions.record(point, timeMs);
                stats.written += 1;
                yield toLineProtocol(point, timeMs);
            }
        }
    }

    await pipeline(
        queryRows({
            baseUrl, db, q, auth, chunkSize: Number(opts['chunk-size'])
        }),
        transform,
        (lines) => batch(lines, batchSize),
        async (batches) => {
            for await (const lines of batches) {
                if (!dryRun) await writeLines({baseUrl, db, auth}, lines);
                stats.batches += 1;
            }
        }
    );

    bar.update(toMs - fromMs, stats);
    bar.stop();
    const verb = dryRun ? 'would write' : 'wrote';
    const stored = stats.written - collisions.collisions;
    process.stdout.write(
        `\nDone. read ${stats.read}, ${verb} ${stats.written} points across ${collisions.series} series `
        + `in ${stats.batches} batches.\n`
        + `${collisions.collisions} ms-collisions (=> ~${stored} rows stored), `
        + `skipped ${stats.skipped}, errors ${stats.errors}.\n`
    );
}

main().catch((e) => {
    process.stderr.write(`\nbackfill failed: ${e.message}\n`);
    process.exitCode = 1;
});
