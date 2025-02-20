const Address = require('./address').default.default;

/**
 * Represents a Message.
 * @constructor
 * @param {Object} parsed - The parsed message object.
 * @param {Object} config - The configuration object.
 */
class Message {
    constructor(parsed, config) {
        if (!(this instanceof Message)) return new Message(parsed, config);

        if (!parsed || !config) {
            throw new Error('Parsed message and config are required.');
        }

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

    isInformation() { return this.parsed.type === 'I'; }
    isRequest() { return this.parsed.type === 'RQ'; }
    isReply() { return this.parsed.type === 'RP'; }
    isWrite() { return this.parsed.type === 'W'; }

    incorrectSite() {
        return this.addrs.reduce((acc, it) => acc || (it.isController() && !it.isSiteController()), false);
    }

    /**
     * Check if the message has been fully read.
     * @returns {boolean} True if the read pointer is at or beyond the end of the message.
     */

    isEOF() {
        return this.p >= this.parsed.len;
    }

    /**
     * Skips a number of bytes.
     * @param {number} c - The number of bytes to skip.
     * @returns {Message} The current message instance.
     */
    skip(c) {
        this.p += c;
        return this;
    }

    /**
     * Reads a single byte and interprets it as an unsigned 8-bit integer.
     * @returns {number} An unsigned 8-bit integer.
     */
    getUInt8() {
        if (this.isEOF()) throw new Error('Attempt to read beyond end of message.');
        const result = this.bytes.readUInt8(this.p);
        this.p += 1;
        return result;
    }

    /**
     * Reads two bytes and interprets them as an unsigned 16-bit integer in big endian format.
     * @returns {number} An unsigned 16-bit integer.
     */
    getUInt16() {
        if (this.isEOF()) throw new Error('Attempt to read beyond end of message.');
        const result = this.bytes.readUInt16BE(this.p);
        this.p += 2;
        return result;
    }
}

Object.defineProperty(Message.prototype, 'length', {
    get() { return this.parsed.len; }
});

Object.defineProperty(Message.prototype, 'addr', {
    get() { return this.addrs; }
});

export default Message;
