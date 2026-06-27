module.exports = function(RED) {
    function EvohomeIn(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.server = RED.nodes.getNode(config.server);
        if (node.server) {
            node.log('ensuring connection');
            node.server.ensureConnection();

            const onMessage = (line) => {
                node.send({
                    timestamp: Date.now(),
                    payload: line.trim()
                });
            };
            const onStatus = (status) => {
                node.status(status);
            };

            node.server.on('evohome-msg', onMessage);
            node.server.on('status', onStatus);

            node.on('close', () => {
                node.server.removeListener('evohome-msg', onMessage);
                node.server.removeListener('status', onStatus);
            });
        }
    }
    RED.nodes.registerType('evohome-in', EvohomeIn);
};
