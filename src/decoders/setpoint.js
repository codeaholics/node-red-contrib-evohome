const tempDecoder = require('./utils/temperature-decoder');

module.exports = tempDecoder({
    type: 'SETPOINT',
    field: 'setpoint'
});
