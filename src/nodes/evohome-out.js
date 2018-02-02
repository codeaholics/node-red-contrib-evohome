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
        node.server.on('status', (status) => {
            node.status(status);
        });
    }
    RED.nodes.registerType('evohome-out', EvohomeOut);
};
