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
    // Request form (and the echo of our own request) is a single zone byte.
    if (m.isRequest() && m.length === 1) { return null; }

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

    return {decoded};
};
