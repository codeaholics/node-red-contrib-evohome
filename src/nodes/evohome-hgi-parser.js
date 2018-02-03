module.exports = function(RED) {
    function EvohomeHGIParser(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.on('input', (msg) => {
            function ensure(b, e) {
                if (!b) throw new Error(e);
            }

            try {
                // codeaholics firmware uses tab char as error indicator. Reading the
                // Domoticz code suggests a genuine HGI80 might use 0x11, but it's not
                // immediately clear. Need an HGI80 to play with. Unfortunately,
                // Domoticz squashes any messages with 0x11, so other HGI80 users may
                // not be able to help with logs to investigate further.
                ensure(msg.payload.indexOf('\t') === -1, 'malformed message');

                const fields = msg.payload.split(/\s+/).map(s => s.toUpperCase());
                ensure(fields.length === 9, 'incorrect number of fields');

                const [unk0, type, unk1, addr0, addr1, addr2, cmd, len, payload] = fields;

                ensure(type.match(/^(I|W|RQ|RP)$/), 'unknown message type');
                ensure(addr0.match(/^(\d\d:\d{6}|--:------)$/), 'address 0 incorrect format');
                ensure(addr1.match(/^(\d\d:\d{6}|--:------)$/), 'address 1 incorrect format');
                ensure(addr2.match(/^(\d\d:\d{6}|--:------)$/), 'address 2 incorrect format');
                ensure(cmd.match(/^[0-9A-F]{4}$/), 'unrecognised command format');
                ensure(len.match(/^\d{3}$/), 'badly formatted length');
                ensure(payload.match(/^[0-9A-F]*$/), 'badly formatted payload');
                ensure(payload.length === (len * 2), 'payload length does not match declared length');

                msg.payload = {
                    original: msg.payload,
                    parsed: {
                        unk0,
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
                node.send([msg, null]);
            } catch (e) {
                msg.payload = {
                    error: `Failed to parse HGI80 format message: ${e.message}`,
                    original: msg.payload
                };
                node.send([null, msg]);
            }
        });
    }
    RED.nodes.registerType('evohome-hgi-parser', EvohomeHGIParser);
};
