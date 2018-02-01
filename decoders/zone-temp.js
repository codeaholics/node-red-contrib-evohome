module.exports = function(m) {
    if (m.length < 3) { throw new Error('ZONE_TEMP payload too short'); }
    if ((m.length % 3) !== 0) { throw new Error('ZONE_TEMP payload invalid length'); }

    return {
        type: 'ZONE_TEMP'
    };
}
