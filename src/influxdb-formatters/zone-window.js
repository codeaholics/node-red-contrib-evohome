module.exports = function(d) {
    const result = {
        measurement: 'ZoneWindow',
        tags: {
        },
        values: {
            windowOpen: d.windowOpen
        }
    };

    function putTag(tag, value) {
        if (value === null || value === undefined) return;
        result.tags[tag] = value;
    }

    putTag('device', d.device.addr);
    putTag('deviceType', d.device.type);
    putTag('deviceName', d.device.name);
    putTag('zone', d.device.zone);
    putTag('zoneName', d.device.zoneName);

    return result;
};
