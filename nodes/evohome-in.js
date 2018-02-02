module.exports = function(RED) {
    function EvohomeIn(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.server = RED.nodes.getNode(config.server);
        if (node.server) {
            node.log('ensuring connection');
            node.server.ensureConnection();
            node.server.on('evohome-msg', function(line) {
                node.send({
                    timestamp: Date.now(),
                    payload: line.trim()
                });
            });
            node.server.on('status', function(status) {
                node.status(status);
            });
        }
    }
    RED.nodes.registerType('evohome-in', EvohomeIn);
}
