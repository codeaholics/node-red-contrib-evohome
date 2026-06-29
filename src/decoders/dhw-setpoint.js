// DHW setpoint (0x10A0): the hot-water target temperature and reheat
// differential.
//   devno(1) setpoint(2) overrun(1) differential(2)   (6 bytes)
// Passive only — the cylinder sensor polls the controller for this; we just
// decode the broadcasts (I) and replies (RP) we hear. Domoticz never decoded it.
module.exports = function(m) {
    if (!m.isInformation() && !m.isReply()) { return null; }
    if (!m.addr[0].isController()) { return null; }

    if (m.length !== 6) {
        throw new Error('DHW_SETPOINT incorrect payload length');
    }

    m.skip(1);  // devno, always 0 for DHW
    const setpoint = m.getUInt16() / 100;
    m.skip(1);  // overrun, purpose unconfirmed
    const differential = m.getUInt16() / 100;

    return {
        decoded: {
            type: 'DHW_SETPOINT',
            device: m.addr[0].describe(),
            setpoint,
            differential
        },
        deduplication: {
            key: `DHW_SETPOINT;${m.addr[0].toString()}`,
            value: [setpoint, differential].join(';'),
            seconds: 3600
        }
    };
};
