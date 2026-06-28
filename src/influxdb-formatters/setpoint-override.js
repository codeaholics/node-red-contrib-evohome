// Overrides share the 'Setpoint' measurement with scheduled setpoints (2309) so
// both can be queried together. The override writes a 'mode' field (and a
// 'setpoint' when one is set); scheduled setpoints write neither anything new nor
// a 'mode', keeping their existing series unchanged for backward compatibility.
//
// 'mode' is a field rather than a tag so a single query can return the current
// value and the current mode together, even though they arrive on different
// messages: SELECT last(setpoint), last(mode) FROM Setpoint GROUP BY reportingZone
//
// TEMPORARY (testing): writing to 'setpoint-test' rather than 'Setpoint' to keep
// trial data out of the production measurement. Revert to 'Setpoint' before
// relying on the unified single-query dashboard described above.
module.exports = function(d) {
    const result = {
        measurement: 'setpoint-test',
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

    putTag('device', d.device.addr);
    putTag('deviceType', d.device.type);
    putTag('deviceName', d.device.name);
    putTag('deviceZone', d.device.zone);
    putTag('deviceZoneName', d.device.zoneName);
    putTag('reportingZone', d.zone);
    putTag('reportingZoneName', d.zoneName);

    return result;
};
