module.exports = function(m) {
    // TODO https://github.com/codeaholics/node-red-contrib-evohome/issues/2
    if (!m.addr[0].isSensor() && !m.addr[2].isSiteController()) { return null; }

    if (m.length !== 3) { throw new Error('BATTERY_INFO payload length incorrect'); }

    m.skip(1);  // This is the zone on some messages, but not all. Just use the config for zone numbers.
    let battery = m.getUInt8();
    const batteryOK = m.getUInt8();

    // 255 is full battery; otherwise, battery level is reported on a scale of 0-200
    if (batteryOK === 0) {
        battery = 0;
    } else if (battery === 255) {
        battery = 100;
    } else {
        battery /= 2;
    }

    return {
        deduplication: {
            key: `BATTERY_INFO;${m.addr[0].toString()}`,
            value: battery,
            seconds: 3600
        },
        decoded: {
            type: 'BATTERY_INFO',
            device: m.addr[0].describe(),
            batteryLevel: battery
        }
    };
};
