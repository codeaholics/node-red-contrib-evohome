// DHW state request (0x1F41). The payload is a single domain selector byte,
// always 00 for DHW. Per-controller (not per-zone).
module.exports = function(controller, gateway) {
    return {
        type: 'RQ',
        addr: [gateway, controller, '--:------'],
        cmd: '1F41',
        payload: '00'
    };
};
