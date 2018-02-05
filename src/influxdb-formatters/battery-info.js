module.exports = function(d) {
    return {
        measurement: 'BatteryInfo',
        tags: {
            device: d.device.addr || '',
            deviceType: d.device.type || '',
            deviceName: d.device.name || '',
            zone: d.device.zone || '',
            zoneName: d.device.zoneName || ''
        },
        values: {
            batteryLevel: d.batteryLevel
        }
    };
};
