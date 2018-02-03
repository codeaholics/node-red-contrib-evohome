module.exports = function(RED) {
    function EvohomeHGIParser(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.on('input', (msg) => {
            // For the time being, ignore messages with *ERR in them as there are quite a lot of them
            if (msg.payload.indexOf('*ERR') !== -1) return;

            const fields = msg.payload.split(/\s+/);
            if (fields.length !== 9) {
                node.warn(`Failed to parse HGI80 format message: ${msg.payload}`);
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
            node.send(msg);
        });
    }
    RED.nodes.registerType('evohome-hgi-parser', EvohomeHGIParser);
};
