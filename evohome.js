var net = require('net');
var decoders = require('./decoders');
var Message = require('./message');

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

    function EvohomeOut(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.server = RED.nodes.getNode(config.server);
        node.on('input', function(msg) {
            if (node.server) {
                node.server.send(msg.payload);
            }
        });
        node.server.on('status', function(status) {
            node.status(status);
        });
    }
    RED.nodes.registerType('evohome-out', EvohomeOut);

    function EvohomeHGIParser(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.on('input', function(msg) {
            const fields = msg.payload.split(/\s+/);
            if (fields.length != 9) {
                node.warn('Failed to parse HGI80 format message: ' + msg.payload);
                return;
            }

            msg.payload = {
                original: msg.payload,
                parsed: {
                    unk0: fields[0],
                    type: fields[1],
                    unk1: fields[2],
                    addr: [
                        fields[3],
                        fields[4],
                        fields[5]
                    ],
                    cmd: fields[6],
                    len: +fields[7],
                    payload: {
                        raw: fields[8],
                        bytes: Buffer.from(fields[8], 'hex')
                    }
                }
            };
            node.send(msg);
        });
    }
    RED.nodes.registerType('evohome-hgi-parser', EvohomeHGIParser);

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

    function EvohomeSiteConfiguration(n) {
        RED.nodes.createNode(this, n);
        var node = this;

        node.json = n.json;
    }
    RED.nodes.registerType('evohome-site-configuration', EvohomeSiteConfiguration);
}
