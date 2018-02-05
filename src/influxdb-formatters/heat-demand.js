module.exports = function(d) {
    return {
        measurement: 'HeatDemand',
        tags: {
            subsystem: d.subsystem || '',
            device: d.device.addr || '',
            deviceType: d.device.type || '',
            deviceName: d.device.name || '',
            zone: d.device.zone || '',
            zoneName: d.device.zoneName || ''
        },
        values: {
            demand: d.demand
        }
    };
};
