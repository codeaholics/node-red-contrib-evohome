const decoders = require('../decoders');
const Message = require('../message');

// Orchestrates decoding of a single parsed message: dispatches to the
// command-specific decoder, drops messages from other sites, and resolves
// deduplication against a caller-supplied cache. Returns the decoded payloads to
// emit — one per result that survives dedup (or a single UNKNOWN for an
// unrecognised command, or none for a foreign-site / fully-deduped message).
//
// The caller owns both the cache and the clock, and neither is defaulted:
//   - the Node-RED node passes its context cache and Date.now()
//   - the backfill script passes one per-run map and each message's own timestamp
// A silently-fresh cache would never deduplicate, and a wall-clock "now" would
// make a historical replay's expiry meaningless — both are load-bearing, so both
// are required.
//
// Decoders may throw on malformed payloads; that propagates to the caller, which
// reports it however suits its environment.
module.exports = function(parsed, config, options) {
    const {cache, now} = options || {};
    if (!cache) { throw new Error('hgi-decoder: a cache must be provided'); }
    if (now === undefined) { throw new Error('hgi-decoder: now must be provided'); }

    const decoder = decoders[parsed.cmd];
    if (!decoder) { return [{type: 'UNKNOWN'}]; }

    const m = new Message(parsed, config);
    if (m.incorrectSite()) { return []; }

    const emit = [];
    [].concat(decoder(m, config)).forEach((result) => {
        if (!result) { return; }

        if (!result.deduplication) {
            emit.push(result.decoded);
            return;
        }

        const {key, value, seconds} = result.deduplication;
        const entry = cache[key];
        if (!entry || entry.value !== value || entry.expiry < now) {
            cache[key] = {value, expiry: now + (seconds * 1000)};
            emit.push(result.decoded);
        }
    });
    return emit;
};
