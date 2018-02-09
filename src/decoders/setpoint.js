module.exports = function(m, config) {
    if (m.isRequest() && m.length === 1) { return null; }
    if (m.length < 3) { throw new Error('SETPOINT payload too short'); }
    if ((m.length % 3) !== 0) { throw new Error('SETPOINT payload invalid length'); }

    if (!m.addr[0].isController() && m.length !== 3) { throw new Error('SETPOINT incorrect payload length'); }

    const results = [];

    while (!m.isEOF()) {
        const result = {
            decoded: {
                type: 'SETPOINT',
                device: m.addr[0].describe()
            }
        };

        if (m.addr[0].isController()) {
            result.decoded.zone = m.getUInt8() + 1;
            result.decoded.zoneName = config.zones[result.decoded.zone];
        } else {
            m.skip(1);
            result.decoded.zone = result.decoded.device.zone;
            result.decoded.zoneName = result.decoded.device.zoneName;
        }

        const setpoint = m.getUInt16();
        if (setpoint !== 0x7FFF) {
            result.decoded.setpoint = setpoint / 100;
            results.push(result);
        }
    }

    return results;
};
