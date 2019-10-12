module.exports = function(d) {
    const result = {
        measurement: 'DHWTemp',
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

    return result;
};
