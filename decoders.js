function zoneTemp(parsed) {
    return {
        type: 'ZONE_TEMP'
    }
}

function setpoint(parsed) {
    return {
        type: 'SETPOINT'
    }
}

function setpointOverride(parsed) {
    return {
        type: 'SETPOINT_OVERRIDE'
    }
}

function dhwState(parsed) {
    return {
        type: 'DHW_STATE'
    }
}

function dhwTemp(parsed) {
    return {
        type: 'DHW_TEMP'
    }
}

function controllerMode(parsed) {
    return {
        type: 'CONTROLLER_MODE'
    }
}

function sysInfo(parsed) {
    return {
        type: 'SYS_INFO'
    }
}

function zoneName(parsed) {
    return {
        type: 'ZONE_NAME'
    }
}

function heatDemand(parsed) {
    return {
        type: 'HEAT_DEMAND'
    }
}

function zoneInfo(parsed) {
    return {
        type: 'ZONE_INFO'
    }
}

function heatDemand(parsed) {
    return {
        type: 'HEAT_DEMAND'
    }
}

function binding(parsed) {
    return {
        type: 'BINDING'
    }
}

function actuatorState(parsed) {
    return {
        type: 'ACTUATOR_STATE'
    }
}

function actuatorCheck(parsed) {
    return {
        type: 'ACTUATOR_CHECK'
    }
}

function zoneWindow(parsed) {
    return {
        type: 'ZONE_WINDOW'
    }
}

function externalSensor(parsed) {
    return {
        type: 'EXTERNAL_SENSOR'
    }
}

function deviceInfo(parsed) {
    return {
        type: 'DEVICE_INFO'
    }
}

function batteryInfo(parsed) {
    return {
        type: 'BATTERY_INFO'
    };
}

module.exports = {
    '30C9': zoneTemp,
    '2309': setpoint,
    '2349': setpointOverride,
    '1F41': dhwState,
    '1260': dhwTemp,
    '2E04': controllerMode,
    '10e0': sysInfo,
    '0004': zoneName,
    '3150': heatDemand,
    '000A': zoneInfo,
    '0008': heatDemand,
    '1FC9': binding,
    '3EF0': actuatorState,
    '3B00': actuatorCheck,
    '12B0': zoneWindow,
    '0002': externalSensor,
    '0418': deviceInfo,
    '1060': batteryInfo
}
