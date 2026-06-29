// Setpoint override (0x2349): a zone's target temperature plus the override mode.
//   zone(1) setpoint(2) mode(1) FFFFFF(3) [until-datetime(6)]
// 7 bytes, or 13 when a "temporary" override carries an until-time.
const overrideTrailer = require('./utils/override-trailer');

module.exports = function(m, config) {
    // A reading only arrives as a broadcast (I) or a reply to a poll (RP). A
    // request (RQ) carries the gateway in addr0, not a reading, and a write (W)
    // is a command whose result we pick up via the subsequent RP — so neither
    // should be decoded. This makes "addr0 is the source" true by construction.
    if (!m.isInformation() && !m.isReply()) { return null; }

    // Only the controller reports setpoint overrides.
    if (!m.addr[0].isController()) { return null; }

    if (m.length !== 7 && m.length !== 13) {
        throw new Error('SETPOINT_OVERRIDE incorrect payload length');
    }

    const zone = m.getUInt8() + 1;
    const setpoint = m.getUInt16();
    const {mode, until} = overrideTrailer(m);

    const decoded = {
        type: 'SETPOINT_OVERRIDE',
        device: m.addr[0].describe(),
        zone,
        zoneName: config.findZoneName(m.addr[0], zone),
        mode
    };

    // A zone following its schedule reports 0x7FFF (no override value): record
    // the mode but omit the setpoint, so a cleared override still refreshes the
    // mode rather than going stale. The scheduled value comes from 2309.
    if (setpoint !== 0x7FFF) {
        decoded.setpoint = setpoint / 100;
    }
    if (until) {
        decoded.until = until;
    }

    return {
        decoded,
        deduplication: {
            // The controller multiplexes every zone onto its own address, so the
            // zone index is part of the identity. zoneName is deliberately absent
            // — renaming a zone must not reset dedup.
            key: `SETPOINT_OVERRIDE;${m.addr[0].toString()};${zone}`,
            // Every field is emit-worthy: a change to setpoint, mode or until
            // must pass through, so combine them. Absent fields render empty.
            value: [decoded.setpoint, mode, until].join(';'),
            seconds: 3600
        }
    };
};
