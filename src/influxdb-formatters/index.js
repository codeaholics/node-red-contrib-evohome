const batteryInfo = require('./battery-info');
const heatDemand = require('./heat-demand');
const zoneTemp = require('./zone-temp');
const setpoint = require('./setpoint');
const dhwTemp = require('./dhw-temp');

module.exports = {
    'BATTERY_INFO': batteryInfo,
    'HEAT_DEMAND': heatDemand,
    'ZONE_TEMP': zoneTemp,
    'SETPOINT': setpoint,
    'DHW_TEMP': dhwTemp
};
