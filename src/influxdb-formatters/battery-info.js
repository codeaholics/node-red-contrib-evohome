module.exports = function(d) {
    return [{
        nValue: d.batteryLevel
    }, {
        type: d.type,
        device: d.device.addr,
        deviceType: d.device.type,
        deviceName: d.device.name,
        zone: d.device.zone,
        zoneName: d.device.zoneName
    }];
};
