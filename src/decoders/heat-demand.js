const SUBSYSTEMS = {
    249: 'ch',
    250: 'dhw',
    252: 'boiler'
};

module.exports = function(m) {
    if (m.length !== 2) { throw new Error('HEAT_DEMAND payload length incorrect'); }

    const zone = m.getUInt8();
    const demand = m.getUInt8() / 2;

    let subsystem;
    if (zone < 12) {
        subsystem = 'zone';
    } else if (zone in SUBSYSTEMS) {
        subsystem = SUBSYSTEMS[zone];
    } else {
        subsystem = `unknown ${zone}`;
    }

    const result = {
        decoded: {
            type: 'HEAT_DEMAND',
            device: m.addr[0].describe(),
            subsystem,
            demand
        }
    };

    if (subsystem === 'zone') {
        result.deduplication = {
            key: `HEAT_DEMAND;${m.addr[0].toString()}`,
            value: demand,
            seconds: 120
        };
    }

    return result;
};
