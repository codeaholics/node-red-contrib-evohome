const Config = require('../config');
const requestZoneTemp = require('../requests/zone-temp');

// How often we drain one message from the queue onto the output. The radio is
// half-duplex and collision-prone, and a single poll cycle enqueues a burst
// (one request per zone), so we deliberately space emissions out rather than
// firing them all at once.
const PACE_MS = 1000;

module.exports = function(RED) {
    function EvohomeActive(n) {
        RED.nodes.createNode(this, n);
        const node = this;

        const configNode = RED.nodes.getNode(n.config);
        const config = new Config(JSON.parse(configNode.json));
        const gateway = n.gateway || '18:000730';
        const intervalMs = (Number(n.interval) || 5) * 60 * 1000;

        // Logic only ever enqueues; the paced drainer is the only thing that emits.
        node.queue = [];

        function enqueueZoneTempPolls() {
            config.controllers().forEach((controller) => {
                config.zones(controller).forEach((zone) => {
                    node.queue.push({payload: {parsed: requestZoneTemp(controller, zone, gateway)}});
                });
            });
            node.status({fill: 'green', shape: 'dot', text: `queued (${node.queue.length})`});
        }

        function drain() {
            if (node.queue.length === 0) return;
            node.send(node.queue.shift());
            node.status({fill: 'green', shape: 'ring', text: `sending (${node.queue.length} queued)`});
        }

        enqueueZoneTempPolls();
        node.pollTimer = setInterval(enqueueZoneTempPolls, intervalMs);
        node.drainTimer = setInterval(drain, PACE_MS);

        // Reserved: a future increment will observe decoded replies here to drive
        // adaptive polling (e.g. skip a zone whose temperature just arrived). Unused
        // for now, but the wiring seam exists.
        node.on('input', () => {});

        node.on('close', () => {
            clearInterval(node.pollTimer);
            clearInterval(node.drainTimer);
            node.queue = [];
        });
    }
    RED.nodes.registerType('evohome-active', EvohomeActive);
};
