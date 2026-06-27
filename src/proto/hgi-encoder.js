// Inverse of hgi-parser: turns a structured message into an HGI80 wire line.
//
// On a received line the first field is the RSSI and the third is a flag whose
// meaning we don't yet understand. Neither is meaningful when we're the sender,
// so we emit '---' for both. The resulting line round-trips through hgi-parser.
// This single assembly is the one thing to verify against real hardware.
module.exports = function(parsed) {
    function ensure(b, e) {
        if (!b) throw new Error(e);
    }

    const {type, addr} = parsed;
    const cmd = String(parsed.cmd).toUpperCase();
    const payload = String(parsed.payload || '').toUpperCase();

    ensure(/^(I|W|RQ|RP)$/.test(type), 'unknown message type');
    ensure(Array.isArray(addr) && addr.length === 3, 'expected exactly 3 addresses');
    addr.forEach((a) => ensure(/^(\d\d:\d{6}|--:------)$/.test(a), 'address incorrect format'));
    ensure(/^[0-9A-F]{4}$/.test(cmd), 'unrecognised command format');
    ensure(/^([0-9A-F]{2})*$/.test(payload), 'badly formatted payload');

    const len = String(payload.length / 2).padStart(3, '0');

    return ['---', type, '---', addr[0], addr[1], addr[2], cmd, len, payload].join(' ');
};
