var batteryInfo = require('./decoders/battery-info');
var zoneTemp = require('./decoders/zone-temp');

function externalSensor(m) {
    return {
        type: 'EXTERNAL_SENSOR'
    };
}

function zoneName(m) {
    return {
        type: 'ZONE_NAME'
    };
}

function heatDemand(m) {
    return {
        type: 'HEAT_DEMAND'
    };
}

function zoneInfo(m) {
    return {
        type: 'ZONE_INFO'
    };
}

function deviceInfo(m) {
    return {
        type: 'DEVICE_INFO'
    };
}

function sysInfo(m) {
    return {
        type: 'SYS_INFO'
    };
}

function dhwTemp(m) {
    return {
        type: 'DHW_TEMP'
    };
}

function zoneWindow(m) {
    return {
        type: 'ZONE_WINDOW'
    };
}

function dhwState(m) {
    return {
        type: 'DHW_STATE'
    };
}

function binding(m) {
    return {
        type: 'BINDING'
    };
}

function setpoint(m) {
    return {
        type: 'SETPOINT'
    };
}

function setpointOverride(m) {
    return {
        type: 'SETPOINT_OVERRIDE'
    };
}

function controllerMode(m) {
    return {
        type: 'CONTROLLER_MODE'
    };
}

function heatDemand(m) {
    return {
        type: 'HEAT_DEMAND'
    };
}

function actuatorCheck(m) {
    return {
        type: 'ACTUATOR_CHECK'
    };
}

function actuatorState(m) {
    return {
        type: 'ACTUATOR_STATE'
    };
}

module.exports = {
    '0002': externalSensor,
    '0004': zoneName,
    '0008': heatDemand,
    '000A': zoneInfo,
    '0418': deviceInfo,
    '1060': batteryInfo,
    '10e0': sysInfo,
    '1260': dhwTemp,
    '12B0': zoneWindow,
    '1F41': dhwState,
    '1FC9': binding,
    '2309': setpoint,
    '2349': setpointOverride,
    '2E04': controllerMode,
    '30C9': zoneTemp,
    '3150': heatDemand,
    '3B00': actuatorCheck,
    '3EF0': actuatorState
}
