function externalSensor(parsed) {
    return {
        type: 'EXTERNAL_SENSOR'
    };
}

function zoneName(parsed) {
    return {
        type: 'ZONE_NAME'
    };
}

function heatDemand(parsed) {
    return {
        type: 'HEAT_DEMAND'
    };
}

function zoneInfo(parsed) {
    return {
        type: 'ZONE_INFO'
    };
}

function deviceInfo(parsed) {
    return {
        type: 'DEVICE_INFO'
    };
}

function batteryInfo(parsed) {
    return {
        type: 'BATTERY_INFO'
    };
}

function sysInfo(parsed) {
    return {
        type: 'SYS_INFO'
    };
}

function dhwTemp(parsed) {
    return {
        type: 'DHW_TEMP'
    };
}

function zoneWindow(parsed) {
    return {
        type: 'ZONE_WINDOW'
    };
}

function dhwState(parsed) {
    return {
        type: 'DHW_STATE'
    };
}

function binding(parsed) {
    return {
        type: 'BINDING'
    };
}

function setpoint(parsed) {
    return {
        type: 'SETPOINT'
    };
}

function setpointOverride(parsed) {
    return {
        type: 'SETPOINT_OVERRIDE'
    };
}

function controllerMode(parsed) {
    return {
        type: 'CONTROLLER_MODE'
    };
}

function zoneTemp(parsed) {
    return {
        type: 'ZONE_TEMP'
    };
}

function heatDemand(parsed) {
    return {
        type: 'HEAT_DEMAND'
    };
}

function actuatorCheck(parsed) {
    return {
        type: 'ACTUATOR_CHECK'
    };
}

function actuatorState(parsed) {
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
