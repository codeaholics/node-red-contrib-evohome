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

            const fields = msg.payload.split(/\s+/);
            if (fields.length !== 9) {
                err('Failed to parse HGI80 format message: incorrect number of fields');
                return;
            }

            // TODO https://github.com/codeaholics/node-red-contrib-evohome/issues/1

            msg.payload = {
                original: msg.payload,
                parsed: {
                    unk0: fields[0],
                    type: fields[1],
                    unk1: fields[2],
                    addr: [
                        fields[3],
                        fields[4],
                        fields[5]
                    ],
                    cmd: fields[6],
                    len: +fields[7],
                    payload: fields[8]
                }
            };
            node.send([msg, null]);
        });
    }
    RED.nodes.registerType('evohome-hgi-parser', EvohomeHGIParser);
};
