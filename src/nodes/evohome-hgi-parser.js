module.exports = function(RED) {
    function EvohomeHGIParser(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.on('input', (msg) => {
            function err(errorText) {
                msg.payload = {
                    error: errorText,
                    original: msg.payload
                };
                node.send([null, msg]);
            }

            // codeaholics firmware uses tab char as error indicator. Reading the
            // Domoticz code suggests a genuine HGI80 might use 0x11, but it's not
            // immediately clear. Need an HGI80 to play with. Unfortunately,
            // Domoticz squashes any messages with 0x11, so other HGI80 users may
            // not be able to help with logs to investigate further.
            if (msg.payload.indexOf('\t') !== -1) {
                err('Failed to parse HGI80 format message: malformed message');
                return;
            }

            const fields = msg.payload.split(/\s+/).map(s => s.toUpperCase());
            if (fields.length !== 9) {
                err('Failed to parse HGI80 format message: incorrect number of fields');
                return;
            }

            const [unk0, type, unk1, addr0, addr1, addr2, cmd, len, payload] = fields;

            function ensure(b, e) {
                if (!b) throw new Error(e);
            }

            try {
                ensure(type.match(/^(I|W|RQ|RP)$/), 'unknown message type');
                ensure(addr0.match(/^(\d\d:\d{6}|--:------)$/), 'address 0 incorrect format');
                ensure(addr1.match(/^(\d\d:\d{6}|--:------)$/), 'address 1 incorrect format');
                ensure(addr2.match(/^(\d\d:\d{6}|--:------)$/), 'address 2 incorrect format');
                ensure(cmd.match(/^[0-9A-F]{4}$/), 'unrecognised command format');
                ensure(len.match(/^\d{3}$/), 'badly formatted length');
                ensure(payload.match(/^[0-9A-F]*$/), 'badly formatted payload');
                ensure(payload.length === (len * 2), 'payload length does not match declared length');
            } catch (e) {
                err(`Failed to parse HGI80 format message: ${e.message}`);
                return;
            }

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
        });
    }
    RED.nodes.registerType('evohome-hgi-parser', EvohomeHGIParser);
};
