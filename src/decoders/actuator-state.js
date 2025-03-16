module.exports = function(m) {
    if (m.isRequest()) { return null; }
    if (!((m.isReply() && m.addr[0].isOpenTherm() && m.addr[1].isSiteController()) ||
          (m.isInformation() && m.addr[0].isRelay() && m.addr[0].isConfigured()))) {
        return null;
    }
    if (m.length % 3 !== 0) { throw new Error('ACTUATOR_STATE payload length incorrect'); }

    function readBit(byte, bit) {
        // eslint-disable-next-line no-bitwise
        return (byte & (1 << bit)) >> bit;
    }

    const result = {
        decoded: {
            type: 'ACTUATOR_STATE',
            device: m.addr[0].describe()
        }
    };

    if (m.length >= 3) {
        m.skip(1);
        result.decoded.modulation = m.readUInt8() / 200;
        m.skip(1);
    }

    if (m.length >= 6) {
        const state = m.readUInt8();
        result.decoded.ch = readBit(state, 1) * 100;
        result.decoded.dhw = readBit(state, 2) * 100;
        result.decoded.flame = readBit(state, 3) * 100;
        result.decoded.cooling = readBit(state, 4) * 100;
        m.skip(2);
    }

    if (m.length >= 9) {
        result.decoded.chEnabled = readBit(m.readUInt8(), 0);
        result.decoded.chSetpoint = m.readUInt8();
        m.skip(1);
    }

    return result;
};
