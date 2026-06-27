module.exports = function(RED) {
    function EvohomeOut(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.server = RED.nodes.getNode(config.server);
        node.on('input', (msg) => {
            if (node.server) {
                node.server.send(msg.payload);
            }
        });
        if (node.server) {
            const onStatus = (status) => {
                node.status(status);
            };
            node.server.on('status', onStatus);
            node.on('close', () => {
                node.server.removeListener('status', onStatus);
            });
        }
    }
    RED.nodes.registerType('evohome-out', EvohomeOut);
};
