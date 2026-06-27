# node-red-contrib-evohome

Node-RED nodes for integrating with the Honeywell Evohome heating system via a HGI80 USB/serial gateway.

## What this is

The HGI80 gateway exposes a serial interface carrying a proprietary RF protocol. To feed it into this package you need either a TCP bridge (e.g. ser2net) consumed by the `evohome-tcp-connection` node, or a standard Node-RED serial node if the HGI80 is directly attached to the server. This package parses those messages, decodes them into structured data, and makes them available in Node-RED flows. The primary downstream use is writing to InfluxDB for time-series monitoring.

## Architecture

Messages flow through a pipeline of Node-RED nodes:

```
TCP Gateway (HGI80)
    → evohome-tcp-connection  (config node: manages TCP socket, auto-reconnects)
    → evohome-in              (input node: adds timestamp, trims payload)
    → evohome-hgi-parser      (parses raw HGI80 wire format into structured object)
    → evohome-decoder         (dispatches to command-specific decoders, deduplicates)
    → evohome-influxdb-formatter  (converts to InfluxDB line protocol)
```

Config nodes: `evohome-tcp-connection` (TCP connection) and `evohome-site-configuration` (JSON site config mapping device addresses to names/zones).

## Commands and tests

```bash
npm test        # run vitest test suite
npm run lint    # eslint (airbnb-base, 4-space indent, 120 char line)
```

## Key directories

```
src/nodes/               # 8 Node-RED node definitions
src/decoders/            # One file per command code (e.g. 30C9.js → zone-temp)
src/decoders/utils/      # Shared helpers (temperature-decoder.js)
src/influxdb-formatters/ # One file per message type for InfluxDB output
src/proto/               # HGI80 wire format parser
src/address.js           # Device address type-checking and name lookup
src/config.js            # Site config loader (controller/zone/relay/device maps)
src/message.js           # Message wrapper with binary field accessors
test/proto/              # Parser tests (good coverage)
test/decoders/           # Decoder tests (mostly stubs — expand these)
```

## HGI80 message format

9 space-separated fields: `RSSI type addr0 addr1 addr2 CMD len payload`

- Type: `I` (info), `W` (write), `RQ` (request), `RP` (reply)
- Addresses: `NN:NNNNNN` (device-type prefix : serial)
- CMD: 4-char hex command code
- Payload: hex string, length must match `len * 2`

## Decoder map

Each command code maps to a decoder in `src/decoders/`. Decoders return `{decoded, deduplication?}` or an array of results, or `null` to skip. See `TODO` for message codes, their frequency in the wild, and implementation status.

## Device addresses

Evohome addresses take the form `type:id` — a two-digit device class prefix and a six-digit serial number (e.g. `04:025902`). The type prefix is what drives logic: routing, decoding, filtering. The ID is incidental. See `src/address.js` for the full type mapping.

## Code conventions

- Airbnb ESLint base — run `npm run lint` before committing
- 4-space indent, 120-char max line
- Decoders are pure functions: take `(message, config)`, return decoded object or null
- Deduplication: return `{decoded, deduplication: {key, ttl}}` — the decoder node caches by key and suppresses repeats within ttl seconds
- Temperature values: UInt16 / 100 → Celsius; skip `0x7FFF` (no reading)
- InfluxDB formatters: exclude `undefined`/`null` tag values

## Protocol references

- https://github.com/smar000/evohome-Listener — Python reference implementation
- `http://files.domoticaforum.eu/uploads/Evihome/WirelessProtocol.pdf` — protocol spec
