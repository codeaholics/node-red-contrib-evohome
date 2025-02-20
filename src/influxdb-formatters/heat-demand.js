export default function(d) {
    const result = {
        measurement: 'HeatDemand',
        tags: {
        },
        values: {
            demand: d.demand
        }
    };

    function putTag(tag, value) {
        if (value === null || value === undefined) return;
        result.tags[tag] = value;
    }

    putTag('subsystem', d.subsystem);
    putTag('device', d.device.addr);
    putTag('deviceType', d.device.type);
    putTag('deviceName', d.device.name);
    putTag('zone', d.device.zone);
    putTag('zoneName', d.device.zoneName);

    return result;
}
