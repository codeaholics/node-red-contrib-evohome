const OVERRIDE_MODES = {
    0: 'FollowSchedule',
    2: 'Permanent',
    4: 'Temporary'
};

// Decodes the shared override trailer used by 2349 (setpoint override) and 1F41
// (DHW state): mode(1) FFFFFF(3) [until-datetime(6)]. Call with the message
// positioned at the mode byte. Returns {mode, until}; until is an ISO-like
// string, or null when absent (schedule/permanent have no end time).
module.exports = function(m) {
    const mode = OVERRIDE_MODES[m.getUInt8()];
    if (mode === undefined) {
        throw new Error('unexpected mode');
    }
    m.skip(3);  // FFFFFF filler between mode and the optional until-time
    const until = m.isEOF() ? null : m.getDateTime();
    return {mode, until};
};
