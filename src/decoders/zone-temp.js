module.exports = function(m, config) {
    if (m.length < 3) { throw new Error('ZONE_TEMP payload too short'); }
    if ((m.length % 3) !== 0) { throw new Error('ZONE_TEMP payload invalid length'); }

    if (!m.addr[0].isController() && m.length !== 3) { throw new Error('ZONE_TEMP incorrect payload length'); }

    const results = [];

    while (!m.isEOF()) {
        const result = {
            decoded: {
                type: 'ZONE_TEMP',
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

        const temperature = m.getUInt16();
        if (temperature !== 0x7FFF) {
            result.decoded.temperature = temperature / 100;
            results.push(result);
        }
    }

    return results;
};
