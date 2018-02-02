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

        function disconnected() {
            node.emit('status', {
                fill: 'red',
                shape: 'dot',
                text: 'disconnected'
            });
        }

        disconnected();

        node.ensureConnection = function() {
            if (node.socket) return;

            node.log('connecting');
            node.socket = net.connect(node.port, node.host);
            node.socket.setEncoding('binary');  // not UTF-8, not ASCII

            node.emit('status', {
                fill: 'green',
                shape: 'ring',
                text: 'connecting'
            });

            node.socket.on('error', function(err) {
                node.error(err);
            });

            node.socket.on('connect', function() {
                node.log('connected');
                node.emit('status', {
                    fill: 'green',
                    shape: 'dot',
                    text: 'connected'
                });
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
                disconnected();

                if (!node.closing) {
                    node.log('scheduling reconnect attempt');
                    node.reconnectTimeout = setTimeout(node.ensureConnection, 5000);
                }
            });
        }

        node.send = function(line) {
            node.ensureConnection();
            node.socket.write(line + '\n', 'binary');
        }

        node.on('close', function() {
            node.log('closing');
            node.closing = true;
            clearTimeout(node.reconnectTimeout);
            disconnected();

            if (node.socket) {
                node.socket.end();
                node.socket.unref();
                node.socket = null;
            }
        });
    }
    RED.nodes.registerType('evohome-tcp-connection', EvohomeTCPConnection);
}
