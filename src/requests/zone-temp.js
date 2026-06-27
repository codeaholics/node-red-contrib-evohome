// Builds a structured ZONE_TEMP (0x30C9) request for a single zone.
//
// addr[0] is the source (our gateway), addr[1] the destination (the controller).
// Zone numbers are 1-based throughout the site config, but the wire protocol
// uses a 0-based zone index in the payload, so we subtract 1.
module.exports = function(controller, zone, gateway) {
    return {
        type: 'RQ',
        addr: [gateway, controller, '--:------'],
        cmd: '30C9',
        payload: (zone - 1).toString(16).toUpperCase().padStart(2, '0')
    };
};
