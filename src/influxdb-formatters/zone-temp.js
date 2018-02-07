module.exports = function(d) {
    const result = {
        measurement: 'ZoneTemp',
        tags: {
        },
        values: {
            temperature: d.temperature
        }
    };

    function putTag(tag, value) {
        if (value === null || value === undefined) return;
        result.tags[tag] = value;
    }

    putTag('device', d.device.addr);
    putTag('deviceType', d.device.type);
    putTag('deviceName', d.device.name);
    putTag('deviceZone', d.device.zone);
    putTag('deviceZoneName', d.device.zoneName);
    putTag('reportingZone', d.zone);
    putTag('reportingZoneName', d.zoneName);

    return result;
};
