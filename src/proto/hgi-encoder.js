// Inverse of hgi-parser: turns a structured message into an HGI80 wire line.
//
// The encoder is not a perfect mirror of the parser: a received line begins with
// an RSSI field, but that is added by the radio on receipt and must be omitted on
// a line we send. So a sent line has eight fields, not nine — it starts at the
// message type. The third field is a flag whose meaning we don't yet understand;
// it's present in both directions, and we emit '---' for it as the sender.
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

    return [type, '---', addr[0], addr[1], addr[2], cmd, len, payload].join(' ');
};
