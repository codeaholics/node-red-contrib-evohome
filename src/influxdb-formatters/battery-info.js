module.exports = function(d) {
    return {
        measurement: 'battery-info',
        tags: {
            type: d.type,
            device: d.device.addr,
            deviceType: d.device.type,
            deviceName: d.device.name,
            zone: d.device.zone,
            zoneName: d.device.zoneName
        },
        values: {
            batteryLevel: d.batteryLevel
        }
    };
};
