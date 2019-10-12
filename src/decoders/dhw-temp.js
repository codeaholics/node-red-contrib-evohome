module.exports = function(m) {
    if (!m.isReply() || m.length !== 3) { return null; }

    const result = {
        decoded: {
            type: 'DHW_TEMP',
            device: m.addr[1].describe()
        }
    };

    m.skip(1);

    const temperature = m.getUInt16();
    if (temperature !== 0x7FFF) {
        result.decoded.temperature = temperature / 100;
    } else {
        return null;
    }

    result.deduplication = {
        key: `DHW_TEMP;${m.addr[1].toString()}`,
        value: result.decoded.temperature,
        seconds: 3600
    };

    return result;
};
