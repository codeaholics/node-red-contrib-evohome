// DHW target temperature and reheat differential. The parallel to Setpoint for
// the hot-water subsystem.
module.exports = function(d) {
    const result = {
        measurement: 'DHWSetpoint',
        tags: {
        },
        values: {
            setpoint: d.setpoint,
            differential: d.differential
        }
    };

    function putTag(tag, value) {
        if (value === null || value === undefined) return;
        result.tags[tag] = value;
    }

    putTag('device', d.device.addr);
    putTag('deviceType', d.device.type);
    putTag('deviceName', d.device.name);

    return result;
};
