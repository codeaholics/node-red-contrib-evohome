var net = require('net');

module.exports = function(RED) {
    function EvohomeTCPConnection(n) {
        RED.nodes.createNode(this, n);
        var node = this;

        node.host = n.host;
        node.port = n.port;
        node.closing = false;
        node.reconnectTimeout = null;
        node.buffer = '';

        node.ensureConnection = function() {
            if (node.socket) return;

            node.log('connecting');
            node.socket = net.connect(node.port, node.host);
            node.socket.setEncoding('binary');  // not UTF-8, not ASCII

            node.socket.on('error', function(err) {
                node.error(err);
            });

            node.socket.on('connect', function() {
                node.log('connected');
            });

            node.socket.on('data', function(buf) {
                node.buffer += buf.toString();
                var lines = node.buffer.split(/\n/);
                node.buffer = lines.pop();
                lines.forEach(function(line) {
                    node.emit('evohome-msg', line);
                });
            });

            node.socket.on('end', function() {
                if (node.buffer.length > 0) {
                    var line = buffer;
                    buffer = '';
                    node.emit('evohome-msg', line);
                }
            });

            node.socket.on('close', function() {
                if (!node.socket) return;

                node.log('closed');
                node.socket.unref();
                node.socket = null;

                if (!node.closing) {
                    node.log('scheduling reconnect attempt');
                    node.reconnectTimeout = setTimeout(node.ensureConnection, 5000);
                }
            });
        }

        node.on('close', function() {
            node.log('closing');
            node.closing = true;
            clearTimeout(node.reconnectTimeout);

            if (node.socket) {
                node.socket.end();
                node.socket.unref();
                node.socket = null;
            }
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
            node.server.ensureConnection();
            node.server.on('evohome-msg', function(line) {
                node.send({
                    timestamp: Date.now(),
                    payload: line.trim()
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
