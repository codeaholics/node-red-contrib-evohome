var decoders = require('../decoders');
var Message = require('../message');

module.exports = function(RED) {
    function EvohomeDecoder(n) {
        RED.nodes.createNode(this, n);
        var node = this;

        var configNode = RED.nodes.getNode(n.config);
        node.config = JSON.parse(configNode.json);

        node.on('input', function(msg) {
            msg.payload.decoded = {};

            decoder = decoders[msg.payload.parsed.cmd];
            if (!decoder) {
                msg.payload.decoded = {
                    type: 'UNKNOWN'
                }
                node.send(msg);
            } else {
                try {
                    var m = new Message(msg.payload.parsed, node.config);
                    var decoded = decoder(m);
                    if (decoded) {
                        msg.payload.decoded = decoded;
                        node.send(msg);
                    }
                } catch(e) {
                    node.error(msg.payload.parsed.cmd + ': ' + e.message + ' [' + msg.payload.original + ']');
                }
            }
        });
    }
    RED.nodes.registerType('evohome-decoder', EvohomeDecoder);
}
