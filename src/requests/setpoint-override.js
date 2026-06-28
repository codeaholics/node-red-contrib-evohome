const zoneSelectorRequest = require('./utils/zone-selector-request');

// Zone setpoint override request (0x2349) — the zone's target temperature and
// override mode (follow schedule / permanent / temporary).
module.exports = zoneSelectorRequest('2349');
