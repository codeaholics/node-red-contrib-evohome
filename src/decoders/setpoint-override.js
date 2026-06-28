// Setpoint override (0x2349): a zone's target temperature plus the override mode.
// Payload is 7 bytes, or 13 when a "temporary" override carries an until-time:
//   zone(1) setpoint(2) mode(1) FFFFFF(3) [until-datetime(6)]
// The until-time (13-byte form) is not yet decoded.
const OVERRIDE_MODES = {
    0: 'FollowSchedule',
    2: 'Permanent',
    4: 'Temporary'
};

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

    const mode = OVERRIDE_MODES[m.getUInt8()];
    if (mode === undefined) {
        throw new Error('SETPOINT_OVERRIDE unexpected mode');
    }

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

    return {
        decoded,
        deduplication: {
            // The controller multiplexes every zone onto its own address, so the
            // zone index is part of the identity. zoneName is deliberately absent
            // — renaming a zone must not reset dedup.
            key: `SETPOINT_OVERRIDE;${m.addr[0].toString()};${zone}`,
            // Both fields are emit-worthy: a mode change at the same temperature
            // (or vice versa) must still pass through, so combine them. An absent
            // setpoint (follow-schedule) renders as an empty leading segment.
            value: [decoded.setpoint, mode].join(';'),
            seconds: 3600
        }
    };
};
