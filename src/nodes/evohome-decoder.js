const decode = require('../proto/hgi-decoder');
const Config = require('../config');

module.exports = function(RED) {
    function EvohomeDecoder(n) {
        RED.nodes.createNode(this, n);
        const node = this;

        const configNode = RED.nodes.getNode(n.config);
        node.config = new Config(JSON.parse(configNode.json));

        node.on('input', (msg) => {
            // The dedup cache lives in node context, persisting across messages.
            const cache = node.context().get('cache') || {};
            node.context().set('cache', cache);

            try {
                decode(msg.payload.parsed, node.config, {cache, now: Date.now()})
                    .forEach((decoded) => {
                        const clone = RED.util.cloneMessage(msg);
                        clone.payload.decoded = decoded;
                        node.send(clone);
                    });
            } catch (e) {
                node.error(`${msg.payload.parsed.cmd}: ${e.message} [${msg.payload.original}]`);
            }
        });
    }
    RED.nodes.registerType('evohome-decoder', EvohomeDecoder);
};
