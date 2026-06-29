// Setpoint override is its own measurement, separate from Setpoint (2309). The
// effective target is always available from 2309; this measurement carries the
// override metadata — mode and until — answering "is it overridden, and until
// when" rather than "what is the target". setpoint is included for completeness.
//
// TEMPORARY (testing): writing to 'setpoint-override-test'. Settle the final
// measurement name before relying on it.
module.exports = function(d) {
    const result = {
        measurement: 'setpoint-override-test',
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

    putValue('setpoint', d.setpoint);
    putValue('mode', d.mode);
    putValue('until', d.until);

    putTag('device', d.device.addr);
    putTag('deviceType', d.device.type);
    putTag('deviceName', d.device.name);
    putTag('deviceZone', d.device.zone);
    putTag('deviceZoneName', d.device.zoneName);
    putTag('reportingZone', d.zone);
    putTag('reportingZoneName', d.zoneName);

    return result;
};
