import parse from '../proto/hgi-parser';

export default function(RED) {
    function EvohomeHGIParser(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.on('input', (msg) => {
            try {
                msg.payload = parse(msg.payload);
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
}
