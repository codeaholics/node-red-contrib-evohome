module.exports = function(RED) {
    function EvohomeHGIParser(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.on('input', function(msg) {
            const fields = msg.payload.split(/\s+/);
            if (fields.length != 9) {
                node.warn('Failed to parse HGI80 format message: ' + msg.payload);
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
                    payload: {
                        raw: fields[8],
                        bytes: Buffer.from(fields[8], 'hex')
                    }
                }
            };
            node.send(msg);
        });
    }
    RED.nodes.registerType('evohome-hgi-parser', EvohomeHGIParser);
}
