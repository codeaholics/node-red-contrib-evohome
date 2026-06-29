const Config = require('../config');
const requestZoneTemp = require('../requests/zone-temp');
const requestSetpointOverride = require('../requests/setpoint-override');
const requestDhwState = require('../requests/dhw-state');

// The per-zone requests issued every poll cycle. Add a builder here to poll
// another datum for every zone.
const ZONE_REQUESTS = [requestZoneTemp, requestSetpointOverride];

// How often we drain one message from the queue onto the output. The radio is
// half-duplex and collision-prone, and a single poll cycle enqueues a burst
// (several requests per zone), so we deliberately space emissions out rather
// than firing them all at once.
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

        function enqueuePolls() {
            config.controllers().forEach((controller) => {
                config.zones(controller).forEach((zone) => {
                    ZONE_REQUESTS.forEach((build) => {
                        node.queue.push({payload: {parsed: build(controller, zone, gateway)}});
                    });
                });
                // DHW state is per-controller, and only for controllers with a
                // DHW relay configured.
                if (config.hasDhw(controller)) {
                    node.queue.push({payload: {parsed: requestDhwState(controller, gateway)}});
                }
            });
            node.status({fill: 'green', shape: 'dot', text: `queued (${node.queue.length})`});
        }

        function drain() {
            if (node.queue.length === 0) return;
            node.send(node.queue.shift());
            node.status({fill: 'green', shape: 'ring', text: `sending (${node.queue.length} queued)`});
        }

        enqueuePolls();
        node.pollTimer = setInterval(enqueuePolls, intervalMs);
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
