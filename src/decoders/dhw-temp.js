module.exports = function(m) {
    if (!m.addr[0].isSiteController() || !m.isReply() || m.length !== 3) { return null; }

    const result = {
        decoded: {
            type: 'DHW_TEMP',
            device: m.addr[0].describe()
        }
    };

    m.skip(1);

    const temperature = m.getUInt16();
    if (temperature !== 0x7FFF) {
        result.decoded.temperature = temperature / 100;
    } else {
        return null;
    }

    // Don't dedupe. These only come every 5 minutes or so, and the temperature changes
    // so slowly that deduping means there can be big gaps in graphs
    // result.deduplication = {
    //     key: `DHW_TEMP;${m.addr[0].toString()}`,
    //     value: result.decoded.temperature,
    //     seconds: 3600
    // };

    return result;
};
