module.exports = function(options) {
    return function(m, config) {
        if (m.isRequest() && m.length === 1) { return null; }
        if (m.length < 3) { throw new Error(`${options.type} payload too short`); }
        if ((m.length % 3) !== 0) { throw new Error(`${options.type} payload invalid length`); }

        if (!m.addr[0].isController() && m.length !== 3) {
            throw new Error(`${options.type} incorrect payload length`);
        }

        const results = [];

        while (!m.isEOF()) {
            const result = {
                decoded: {
                    type: options.type,
                    device: m.addr[0].describe()
                }
            };

            if (m.addr[0].isController()) {
                result.decoded.zone = m.getUInt8() + 1;
                result.decoded.zoneName = config.findZoneName(m.addr[0], result.decoded.zone);
            } else {
                m.skip(1);
                result.decoded.zone = result.decoded.device.zone;
                result.decoded.zoneName = result.decoded.device.zoneName;
            }

            const temperature = m.getUInt16();
            if (temperature !== 0x7FFF) {
                result.decoded[options.field] = temperature / 100;
                results.push(result);
            }
        }

        return results;
    };
};
