export default function(RED) {
    class EvohomeIn {
        constructor(config) {
            RED.nodes.createNode(this, config);
            const node = this;
            node.server = RED.nodes.getNode(config.server);
            if (node.server) {
                node.log('ensuring connection');
                node.server.ensureConnection();
                node.server.on('evohome-msg', (line) => {
                    node.send({
                        timestamp: Date.now(),
                        payload: line.trim()
                    });
                });
                node.server.on('status', (status) => {
                    node.status(status);
                });
            }
        }
    }
    RED.nodes.registerType('evohome-in', EvohomeIn);
}
