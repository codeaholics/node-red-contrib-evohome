const Address = require('./address');

function Message(parsed, config) {
    if (!(this instanceof Message)) return new Message(parsed, config);

    this.parsed = parsed;
    this.config = config;

    this.bytes = Buffer.from(this.parsed.payload, 'hex');
    this.addrs = Object.freeze([
        new Address(this.parsed.addr[0], this.config),
        new Address(this.parsed.addr[1], this.config),
        new Address(this.parsed.addr[2], this.config)
    ]);
    this.p = 0;
}

Object.defineProperty(Message.prototype, 'length', {
    get() { return this.parsed.len; }
});

Object.defineProperty(Message.prototype, 'addr', {
    get() { return this.addrs; }
});

Message.prototype.isInformation = function() { return this.parsed.type === 'I'; };
Message.prototype.isRequest = function() { return this.parsed.type === 'RQ'; };
Message.prototype.isReply = function() { return this.parsed.type === 'RP'; };
Message.prototype.isWrite = function() { return this.parsed.type === 'W'; };

Message.prototype.incorrectSite = function() {
    return this.addrs.reduce((acc, it) => acc || (it.isController() && !it.isSiteController()), false);
};

Message.prototype.isEOF = function() {
    return this.p >= this.parsed.len;
};

Message.prototype.skip = function(c) {
    this.p += c;
};

Message.prototype.getUInt8 = function() {
    const result = this.bytes.readUInt8(this.p);
    this.p += 1;
    return result;
};

Message.prototype.getUInt16 = function() {
    const result = this.bytes.readUInt16BE(this.p);
    this.p += 2;
    return result;
};

module.exports = Message;
