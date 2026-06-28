module.exports = function(options) {
    return function(m, config) {
        // A reading only arrives as a broadcast (I) or a reply to a poll (RP); a
        // request (RQ) carries the gateway in addr0, not a reading. Whitelisting
        // the producing types makes "addr0 is the source" true by construction.
        if (!m.isInformation() && !m.isReply()) { return null; }
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
                // Opt-in dedup (e.g. setpoints, which are step functions). Temps
                // are a smooth curve and are left undeduped to avoid graph gaps.
                // The key mirrors the InfluxDB series (device addr + zone): addr0
                // is the source — either the controller (zones multiplexed onto
                // its address, so the index disambiguates) or an individual sensor
                // (its own unique address). zoneName is excluded so renames don't
                // reset dedup.
                if (options.dedupeSeconds) {
                    result.deduplication = {
                        key: `${options.type};${m.addr[0].toString()};${result.decoded.zone}`,
                        value: result.decoded[options.field],
                        seconds: options.dedupeSeconds
                    };
                }
                results.push(result);
            }
        }

        return results;
    };
};
