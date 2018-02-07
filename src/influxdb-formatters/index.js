const batteryInfo = require('./battery-info');
const heatDemand = require('./heat-demand');
const zoneTemp = require('./zone-temp');

module.exports = {
    'BATTERY_INFO': batteryInfo,
    'HEAT_DEMAND': heatDemand,
    'ZONE_TEMP': zoneTemp,
};
