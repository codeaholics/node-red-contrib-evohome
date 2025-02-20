import {connect} from 'net';

export default function(RED) {
    class EvohomeTCPConnection {
        constructor(n) {
            RED.nodes.createNode(this, n);
            const node = this;

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

            node.ensureConnection = () => {
                if (node.socket) return;

                node.log('connecting');
                node.socket = connect(node.port, node.host);
                node.socket.setEncoding('binary'); // not UTF-8, not ASCII

                node.emit('status', {
                    fill: 'green',
                    shape: 'ring',
                    text: 'connecting'
                });

                node.socket.on('error', (err) => {
                    node.error(err);
                });

                node.socket.on('connect', () => {
                    node.log('connected');
                    node.emit('status', {
                        fill: 'green',
                        shape: 'dot',
                        text: 'connected'
                    });
                });

                node.socket.on('data', (buf) => {
                    node.buffer += buf.toString();
                    const lines = node.buffer.split(/\n/);
                    node.buffer = lines.pop();
                    lines.forEach((line) => {
                        node.emit('evohome-msg', line);
                    });
                });

                node.socket.on('end', () => {
                    if (node.buffer.length > 0) {
                        const line = node.buffer;
                        node.buffer = '';
                        node.emit('evohome-msg', line);
                    }
                });

                node.socket.on('close', () => {
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
            };

            node.send = (line) => {
                node.ensureConnection();
                node.socket.write(`${line}\n`, 'binary');
            };

            node.on('close', () => {
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
    }
    RED.nodes.registerType('evohome-tcp-connection', EvohomeTCPConnection);
}
