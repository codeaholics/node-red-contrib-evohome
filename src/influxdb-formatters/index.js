const batteryInfo = require('./battery-info');
const heatDemand = require('./heat-demand');
const zoneTemp = require('./zone-temp');
const setpoint = require('./setpoint');
const setpointOverride = require('./setpoint-override');
const dhwTemp = require('./dhw-temp');
const dhwState = require('./dhw-state');
const dhwSetpoint = require('./dhw-setpoint');
const zoneWindow = require('./zone-window');

module.exports = {
    'BATTERY_INFO': batteryInfo,
    'HEAT_DEMAND': heatDemand,
    'ZONE_TEMP': zoneTemp,
    'SETPOINT': setpoint,
    'SETPOINT_OVERRIDE': setpointOverride,
    'DHW_TEMP': dhwTemp,
    'DHW_STATE': dhwState,
    'DHW_SETPOINT': dhwSetpoint,
    'ZONE_WINDOW': zoneWindow
};
