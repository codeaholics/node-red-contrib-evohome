// DHW state (0x1F41): the hot-water on/off state plus its override mode.
//   domain(1) state(1) mode(1) FFFFFF(3) [until-datetime(6)]
// 6 bytes, or 12 when a "temporary" override carries an until-time. The DHW
// override acts on on/off — there is no DHW setpoint override (that target is
// the separate 10A0 message).
const overrideTrailer = require('./utils/override-trailer');

const DHW_STATES = {
    0: 'off',
    1: 'on'
};

module.exports = function(m) {
    // Only broadcasts (I) and poll replies (RP) carry the state with the
    // controller as the source in addr0; requests/writes do not.
    if (!m.isInformation() && !m.isReply()) { return null; }
    if (!m.addr[0].isController()) { return null; }

    if (m.length !== 6 && m.length !== 12) {
        throw new Error('DHW_STATE incorrect payload length');
    }

    m.skip(1);  // domain, always 0 for DHW

    const stateByte = m.getUInt8();
    if (stateByte === 0xFF) { return null; }  // DHW not installed
    const state = DHW_STATES[stateByte];
    if (state === undefined) {
        throw new Error('DHW_STATE unexpected state');
    }

    const {mode, until} = overrideTrailer(m);

    const decoded = {
        type: 'DHW_STATE',
        device: m.addr[0].describe(),
        state,
        mode
    };
    if (until) {
        decoded.until = until;
    }

    return {
        decoded,
        // One DHW per controller, so the controller address alone is the key.
        deduplication: {
            key: `DHW_STATE;${m.addr[0].toString()}`,
            value: [state, mode, until].join(';'),
            seconds: 3600
        }
    };
};
