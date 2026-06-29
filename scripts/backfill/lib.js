/* eslint-disable no-restricted-syntax */
// Pure, testable helpers for the backfill script. No I/O here — see influx.js
// for the HTTP read/write and backfill.js for the wiring.
// for-of / for-await-of are intentional here (generators, async iteration).

const DURATION_UNITS = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000
};

// "7d" / "24h" / "30m" / "90s" / "2w" -> milliseconds.
function parseDuration(s) {
    const match = /^(\d+)([smhdw])$/.exec(String(s));
    if (!match) throw new Error(`invalid duration: ${s} (expected e.g. 7d, 24h, 30m)`);
    return Number(match[1]) * DURATION_UNITS[match[2]];
}

// Resolve the replay window from CLI args. `from` is required; the end is `to`,
// else `from + duration`, else `now`.
function resolveWindow({
    from, to, duration, now = Date.now()
}) {
    if (!from) throw new Error('--from is required');
    const fromMs = Date.parse(from);
    if (Number.isNaN(fromMs)) throw new Error(`invalid --from: ${from}`);

    let toMs;
    if (to !== undefined) {
        toMs = Date.parse(to);
        if (Number.isNaN(toMs)) throw new Error(`invalid --to: ${to}`);
    } else if (duration !== undefined) {
        toMs = fromMs + parseDuration(duration);
    } else {
        toMs = now;
    }

    if (toMs <= fromMs) throw new Error('window end must be after --from');
    return {fromMs, toMs};
}

// An InfluxDB 1.x chunked /query response object -> flat row objects keyed by
// column name. Throws if the query itself errored.
function* flattenInfluxResult(obj) {
    const results = obj.results || [];
    for (const result of results) {
        if (result.error) throw new Error(`influx query error: ${result.error}`);
        for (const series of result.series || []) {
            const {columns} = series;
            for (const tuple of series.values) {
                const row = {};
                columns.forEach((col, i) => { row[col] = tuple[i]; });
                yield row;
            }
        }
    }
}

// A flat row -> the parsed-level message hgi-decoder expects. Missing address
// tags coalesce to the unused-address sentinel rather than crashing a long run.
function rowToParsed(row) {
    return {
        type: row.type,
        addr: [row.addr0, row.addr1, row.addr2].map((a) => a || '--:------'),
        cmd: row.cmd,
        len: row.len,
        payload: row.payload
    };
}

// --- InfluxDB line protocol -------------------------------------------------

function escapeMeasurement(s) { return String(s).replace(/([,\s])/g, '\\$1'); }
function escapeKeyOrTag(s) { return String(s).replace(/([,=\s])/g, '\\$1'); }
function escapeStringField(s) { return String(s).replace(/(["\\])/g, '\\$1'); }

function formatFieldValue(v) {
    if (typeof v === 'number') return String(v); // unsuffixed => float, matching the live writes
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return `"${escapeStringField(v)}"`;
}

function joinPairs(obj, valueFn) {
    return Object.entries(obj)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `${escapeKeyOrTag(k)}=${valueFn(v)}`)
        .join(',');
}

// {measurement, tags, values} + ms timestamp -> a line protocol string.
function toLineProtocol({measurement, tags, values}, timestampMs) {
    const tagStr = joinPairs(tags || {}, escapeKeyOrTag);
    const fieldStr = joinPairs(values || {}, formatFieldValue);
    if (!fieldStr) throw new Error(`no fields to write for measurement ${measurement}`);
    const key = tagStr ? `${escapeMeasurement(measurement)},${tagStr}` : escapeMeasurement(measurement);
    return `${key} ${fieldStr} ${timestampMs}`;
}

// Returns a function that rewrites a point's measurement (for testing into a
// scratch measurement). `name` forces an exact name; `suffix` appends.
function measurementRewriter({name, suffix} = {}) {
    return (point) => {
        if (name) return {...point, measurement: name};
        if (suffix) return {...point, measurement: point.measurement + suffix};
        return point;
    };
}

// The InfluxDB series identity of a point: measurement + its (non-empty) tag
// set, order-independent. Two points sharing this AND a timestamp overwrite each
// other on write. Field values are irrelevant to identity, so they're excluded.
function seriesKey({measurement, tags}) {
    const tagPart = Object.entries(tags || {})
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `${k}=${String(v)}`)
        .sort()
        .join(',');
    return tagPart ? `${measurement},${tagPart}` : measurement;
}

// Counts write collisions — points that overwrite an earlier point because they
// share a series and timestamp (e.g. two sub-millisecond messages truncated to
// the same ms). Relies on the input being time-ordered, so it holds only the
// last timestamp per series: O(distinct series), not O(points).
function createCollisionTracker() {
    const lastTs = new Map();
    let collisions = 0;
    return {
        record(point, timestampMs) {
            const key = seriesKey(point);
            if (lastTs.get(key) === timestampMs) collisions += 1;
            lastTs.set(key, timestampMs);
        },
        get collisions() { return collisions; },
        get series() { return lastTs.size; }
    };
}

// InfluxQL to delete a measurement and all its data. The name is a
// double-quoted identifier; any embedded double-quote is escaped.
function dropMeasurementStatement(name) {
    return `DROP MEASUREMENT "${String(name).replace(/"/g, '\\"')}"`;
}

// Groups an async iterable into arrays of up to `size`. The trailing `if`
// flushes the final partial batch — the guarantee that nothing is left unwritten.
async function* batch(source, size) {
    let buf = [];
    for await (const item of source) {
        buf.push(item);
        if (buf.length >= size) {
            yield buf;
            buf = [];
        }
    }
    if (buf.length) yield buf;
}

module.exports = {
    parseDuration,
    resolveWindow,
    flattenInfluxResult,
    rowToParsed,
    toLineProtocol,
    measurementRewriter,
    seriesKey,
    createCollisionTracker,
    dropMeasurementStatement,
    batch
};
