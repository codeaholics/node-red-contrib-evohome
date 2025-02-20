export default function(str) {
    function ensure(b, e) {
        if (!b) throw new Error(e);
    }

    // codeaholics firmware uses tab char as error indicator. Reading the
    // Domoticz code suggests a genuine HGI80 might use 0x11, but it's not
    // immediately clear. Need an HGI80 to play with. Unfortunately,
    // Domoticz squashes any messages with 0x11, so other HGI80 users may
    // not be able to help with logs to investigate further.
    ensure(str.indexOf('\t') === -1, 'malformed message');

    const fields = str.split(/\s+/).map(s => s.toUpperCase());
    ensure(fields.length === 9, 'incorrect number of fields');

    const [rssi, type, unk1, addr0, addr1, addr2, cmd, len, payload] = fields;

    ensure(rssi.match(/^(\d+|-+)$/), 'rssi incorrect format');
    ensure(type.match(/^(I|W|RQ|RP)$/), 'unknown message type');
    ensure(addr0.match(/^(\d\d:\d{6}|--:------)$/), 'address 0 incorrect format');
    ensure(addr1.match(/^(\d\d:\d{6}|--:------)$/), 'address 1 incorrect format');
    ensure(addr2.match(/^(\d\d:\d{6}|--:------)$/), 'address 2 incorrect format');
    ensure(cmd.match(/^[0-9A-F]{4}$/), 'unrecognised command format');
    ensure(len.match(/^\d{3}$/), 'badly formatted length');
    ensure(payload.match(/^[0-9A-F]*$/), 'badly formatted payload');
    ensure(payload.length === (len * 2), 'payload length does not match declared length');

    return {
        original: str,
        parsed: {
            rssi,
            type,
            unk1,
            addr: [
                addr0,
                addr1,
                addr2
            ],
            cmd,
            len: +len,
            payload
        }
    };
}
