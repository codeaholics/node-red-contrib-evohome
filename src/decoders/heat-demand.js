const SUBSYSTEMS = {
    249: 'ch',
    250: 'dhw',
    252: 'boiler'
};

module.exports = function(m) {
    // TODO https://github.com/codeaholics/node-red-contrib-evohome/issues/2
    if (!m.addr[0].isSiteController() && !m.addr[2].isSiteController()) { return null; }

    if (m.length !== 2) { throw new Error('HEAT_DEMAND payload length incorrect'); }

    const zone = m.getUInt8();
    const demand = m.getUInt8() / 2;

    const subsystem = zone < 12 ? 'zone' : SUBSYSTEMS[zone] || `unknown ${zone}`;

    // Domoticz does a "RequestDHWState" in here somewhere. Do we need it?

    return {
        // deduplication: {
        //     key: `HEAT_DEMAND;${m.addr[0].toString()};${subsystem}`,  // Include subsystem because the controller sends messages for all BDRs
        //     value: demand,
        //     seconds: 3600
        // },
        decoded: {
            type: 'HEAT_DEMAND',
            device: m.addr[0].describe(),
            subsystem,
            demand
        }
    };
};
