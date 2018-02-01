module.exports = function(m) {
    // TODO https://github.com/codeaholics/node-red-contrib-evohome/issues/2

    if (!m.addr[0].isSensor() && !m.addr[2].isSiteController()) { return; }

    if (m.length !== 3) { throw new Error('BATTERY_INFO payload length incorrect'); }

    var zone = m.getUInt8() + 1;
    var battery = m.getUInt8();
    var batteryOK = m.getUInt8();

    // 255 is full battery; otherwise, battery level is reported on a scale of 0-200
    if (batteryOK === 0) {
        battery = 0;
    } else if (battery === 255) {
        battery = 100;
    } else {
        battery = battery / 2;
    }

    return {
        type: 'BATTERY_INFO',
        sender: m.addr[0].toString(),
        zone: zone,
        batteryLevel: battery
    };
}
