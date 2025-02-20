import formatters from '../influxdb-formatters';

export default function(RED) {
    class EvohomeInfluxDbFormatter {
        constructor(config) {
            RED.nodes.createNode(this, config);
            const node = this;
            node.on('input', (msg) => {
                if (!msg.payload.decoded) return;
                const type = msg.payload.decoded.type;  // eslint-disable-line prefer-destructuring
                const formatter = formatters[type];

                if (!formatter) {
                    msg.payload = {
                        error: `Failed to format InfluxDB data point from Evohome message type ${type}`,
                        original: msg.payload
                    };
                    node.send([null, msg]);
                } else {
                    const formatted = formatter(msg.payload.decoded);
                    if (formatted) {
                        msg.measurement = formatted.measurement;
                        msg.payload = [formatted.values, formatted.tags];
                        node.send([msg, null]);
                    }
                }
            });
        }
    }
    RED.nodes.registerType('evohome-influxdb-formatter', EvohomeInfluxDbFormatter);
}
