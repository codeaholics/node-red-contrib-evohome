const formatters = require('../influxdb-formatters');

module.exports = function(RED) {
    function EvohomeInfluxDbFormatter(config) {
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
                    // Stamp the point with the single receipt timestamp carried on
                    // the message (set upstream from the MQTT `ts`), so the live
                    // write and the backfill land on the same time. The `time` key
                    // in the fields is consumed as the point timestamp by
                    // node-red-contrib-influxdb (with msg.precision). This lives in
                    // the node, not the pure formatters in src/influxdb-formatters —
                    // those stay time-agnostic so the backfill can supply its own.
                    const values = {...formatted.values, time: msg.timestamp};
                    msg.precision = 'ms';
                    msg.payload = [values, formatted.tags];
                    node.send([msg, null]);
                }
            }
        });
    }
    RED.nodes.registerType('evohome-influxdb-formatter', EvohomeInfluxDbFormatter);
};
