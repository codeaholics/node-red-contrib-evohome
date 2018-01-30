var net = require('net');

module.exports = function(RED) {
    function EvohomeTCPConnection(n) {
        RED.nodes.createNode(this, n);
        var node = this;

        node.host = n.host;
        node.port = n.port;

        node.ensureConnection = function() {
            if (node.socket) return node.socket;

            node.log('connecting');
            node.socket = net.connect(node.port, node.host);
            node.socket.setEncoding('binary');  // not UTF-8, not ASCII

            node.socket.on('error', function(err) {
                node.error(err);
            });

            node.socket.on('connect', function() {
                node.log('connected');
            });

            node.socket.on('close', function() {
                if (!node.socket) return;

                node.log('closed');
                node.socket.unref();
                node.socket = null;
            });

            return node.socket;
        }

        node.on('close', function() {
            if (!node.socket) return;

            node.log('closing');
            node.socket.end();
            node.socket.unref();
            node.socket = null;
        });
    }
    RED.nodes.registerType('evohome-tcp-connection', EvohomeTCPConnection);

    function EvohomeIn(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var context = node.context();

        node.server = RED.nodes.getNode(config.server);
        if (node.server) {
            node.log('ensuring connection');
            var socket = node.server.ensureConnection();
            socket.on('data', function(buf) {
                var buffer = context.get('buffer') || '';
                buffer += buf.toString();
                lines = buffer.split(/\n/);
                context.set('buffer', lines.pop());
                lines.forEach(function(line) {
                    node.send({
                        timestamp: Date.now(),
                        payload: line.trim()
                    });
                });
            });
        }
    }
    RED.nodes.registerType('evohome-in', EvohomeIn);

    function EvohomeOut(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.server = RED.nodes.getNode(config.server);
        if (node.server) {
            node.log('ensuring connection');
            node.server.ensureConnection();
        }
    }
    RED.nodes.registerType('evohome-out', EvohomeOut);
}
