const decoders = require('../decoders');
const Message = require('../message');

module.exports = function(RED) {
    function EvohomeDecoder(n) {
        RED.nodes.createNode(this, n);
        const node = this;

        const configNode = RED.nodes.getNode(n.config);
        node.config = JSON.parse(configNode.json);

        node.on('input', (msg) => {
            const now = Date.now();
            msg.payload.decoded = {};

            const decoder = decoders[msg.payload.parsed.cmd];
            if (!decoder) {
                msg.payload.decoded = {
                    type: 'UNKNOWN'
                };
                node.send(msg);
            } else {
                try {
                    const m = new Message(msg.payload.parsed, node.config);
                    if (m.incorrectSite()) return;

                    const results = [].concat(decoder(m, node.config));
                    results.forEach((result) => {
                        if (!result) return;

                        function send() {
                            const clone = RED.util.cloneMessage(msg);
                            clone.payload.decoded = result.decoded;
                            node.send(clone);
                        }

                        if (!result.deduplication) {
                            // Decoder not participating in deduplication
                            send();
                            return;
                        }

                        const cache = node.context().get('cache') || {};
                        node.context().set('cache', cache);

                        const cacheEntry = cache[result.deduplication.key];
                        if (!cacheEntry ||   // No cache entry
                                cacheEntry.value !== result.deduplication.value ||  // Value has changed
                                cacheEntry.expiry < now) {  // Cache entry has expired
                            // Create or update the cache entry
                            cache[result.deduplication.key] = {
                                value: result.deduplication.value,
                                expiry: now + (result.deduplication.seconds * 1000)
                            };

                            send();
                        }
                    });
                } catch (e) {
                    node.error(`${msg.payload.parsed.cmd}: ${e.message} [${msg.payload.original}]`);
                }
            }
        });
    }
    RED.nodes.registerType('evohome-decoder', EvohomeDecoder);
};
