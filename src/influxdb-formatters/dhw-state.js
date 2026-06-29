// DHW on/off state with its override mode and optional until-time. The parallel
// to SetpointOverride for the hot-water subsystem (mode + until), but the
// controlled value is on/off, not a temperature.
module.exports = function(d) {
    const result = {
        measurement: 'DHWState',
        tags: {
        },
        values: {
        }
    };

    function putTag(tag, value) {
        if (value === null || value === undefined) return;
        result.tags[tag] = value;
    }

    function putValue(field, value) {
        if (value === null || value === undefined) return;
        result.values[field] = value;
    }

    putValue('state', d.state);
    putValue('on', d.state === 'on' ? 1 : 0);  // numeric for graphing
    putValue('mode', d.mode);
    putValue('until', d.until);

    putTag('device', d.device.addr);
    putTag('deviceType', d.device.type);
    putTag('deviceName', d.device.name);

    return result;
};
