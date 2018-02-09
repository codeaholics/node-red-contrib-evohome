const tempDecoder = require('./utils/temperature-decoder');

module.exports = tempDecoder({
    type: 'ZONE_TEMP',
    field: 'temperature'
});
