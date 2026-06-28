// Factory for "request data for a single zone" builders, where the request
// payload is just the zone selector (e.g. zone temp 30C9, setpoint override 2349).
//
// addr[0] is the source (our gateway), addr[1] the destination (the controller).
// Zone numbers are 1-based throughout the site config, but the wire protocol uses
// a 0-based zone index in the payload, so we subtract 1.
module.exports = function(cmd) {
    return function(controller, zone, gateway) {
        return {
            type: 'RQ',
            addr: [gateway, controller, '--:------'],
            cmd,
            payload: (zone - 1).toString(16).toUpperCase().padStart(2, '0')
        };
    };
};
