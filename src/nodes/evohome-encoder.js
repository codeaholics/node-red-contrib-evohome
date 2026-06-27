const encode = require('../proto/hgi-encoder');

module.exports = function(RED) {
    function EvohomeEncoder(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.on('input', (msg) => {
            try {
                msg.payload = encode(msg.payload.parsed);
                node.send(msg);
            } catch (e) {
                node.error(`Failed to encode HGI80 format message: ${e.message}`, msg);
            }
        });
    }
    RED.nodes.registerType('evohome-encoder', EvohomeEncoder);
};
