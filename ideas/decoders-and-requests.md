# Should decoders and request builders share a home?

A design discussion about whether the per-command decoder (parsed → decoded)
and the per-command request builder (intent → parsed) should be unified —
e.g. by renaming decoders to something generic and adding factory methods for
request behaviour.

The motivation: knowledge of "what a 30C9 means / looks like" currently lives
in two places — the decoder and the request object.

## Test the premise: do they encode the same information?

Lay the two pieces side by side.

**Request builder** (`requests/zone-temp.js`) knows:

- command code `30C9`
- the *request* payload shape: **one byte, a zone selector** (0-based)
- the outbound address arrangement: `[gateway, controller, --]`

**Decoder** (`zone-temp.js` via `temperature-decoder.js`) knows:

- command code `30C9`
- the *response/info* payload shape: **repeating `{zone, uint16 temp}` triples**,
  N zones, `0x7FFF` sentinel
- inbound address interpretation: controller-vs-sensor branching, site filtering
- length validation, dedup hints, multi-result emission

So the genuinely shared knowledge is tiny: **the literal `'30C9'` and the zone
±1 convention.** Everything else differs. Crucially, the request payload is a
**query key** (which zone are you asking about) and the response payload is the
**value** (here are the readings). They are *not* inverses of each other — the
request is a selector, the response is data. A 1-byte "zone 0 please" and a
9-byte "zones 0,1,2 are 21.5/19/20" don't mirror.

That's the RQ-vs-RP asymmetry: same command code, different payload forms. The
decoder and the request builder aren't two halves of one codec; they're a
*reading* and a *query* that happen to share a command number.

## Recommendation: don't merge them into one object with factory methods

Three concrete reasons:

1. **Two reasons to change.** If Honeywell altered the 30C9 *response* layout,
   only the decoder changes. If they altered the request selector, only the
   builder changes. Cohesion is "changes together" — these don't.

2. **Asymmetric coverage.** Plenty of commands have only one side. Heat-demand
   (`3150`/`0008`), battery info, actuator state — you decode them but never
   request them. Conversely, some things you only ever send. A merged "message
   type" object would be littered with decode-only and request-only members,
   half-empty by construction. That asymmetry is the smell that says these
   aren't one thing.

3. **False symmetry temptation.** A class with `decode()` and `request()`
   factory methods *looks* like a codec and invites you to force the request and
   response into a shared shape they don't have. You'd fight the model on every
   non-trivial command.

## Where the real symmetry actually lives: the field level

The reusable, genuinely-bidirectional knowledge isn't "what a 30C9 message is" —
it's "**how a temperature is encoded**" (uint16 ÷ 100, `0x7FFF` = no reading),
"**how a zone number maps**" (±1), "how a datetime/mode is laid out." Those *are*
true inverses, and they're reused across many commands and in both directions.
That's the shared kernel worth extracting.

The project already gestures at this with `utils/temperature-decoder.js` — but
it's a message-level decoder factory, decode-only. The durable version is a pure
**field codec**: a `temperature` module with `encode`/`decode`, a `zone-number`
codec with `toWire`/`fromWire`. Domoticz models exactly this with its
`CEvohomeDataType` Add/Get and `CEvohomeTemp` — bidirectional field types, not
bidirectional message types.

So the duplication is real but at the wrong altitude. De-duplicate the **fields**
and a small **command-code vocabulary** (an enum like Domoticz's `evoCommands`),
used by both sides. That kills the actual repetition (the `'30C9'` string and
the ±1) cheaply, without conflating the two behaviours.

## If co-location is specifically what's wanted

If the motivation is "I want everything about 30C9 in one place" (a fair
discoverability goal), the better expression than a merged class is
**package-by-command-code**: a folder per command —

```
src/commands/zone-temp/
    index.js      # command code + shared field conventions
    decode.js     # parsed → decoded
    request.js    # intent → parsed
```

You get co-location and an obvious home for the shared kernel (the sibling
`index.js`), *without* a single object pretending the two roles are symmetric,
and without forcing every command to have both files.

## On bounded context

**Same domain, different concerns.** Decoding (observe inbound) and
request-building (control outbound) both live in the Evohome-RF protocol domain —
they share a *vocabulary* (command codes, field encodings). But "interpret what
the system told me" and "construct a command to the system" are distinct
application concerns with independent reasons to change. The clean split is
therefore: **shared vocabulary + field codecs at the bottom; separate decode and
request behaviours on top** — not one merged message object.

## Concrete near-term suggestion

**Status:** the 2nd request type (setpoint-override, 2349) has since landed. The
request-side duplication it would have caused was absorbed by a
`zone-selector-request` factory (`src/requests/utils/`), mirroring the
`temperature-decoder` factory — so `zone-temp` and `setpoint-override` share the
addressing and the zone ±1 logic. Still outstanding from the steps below: the
`commands.js` enum, and the bidirectional **temperature** codec.

Don't build a full unification framework yet (YAGNI). The small, reversible steps
that capture most of the remaining value:

1. Add a `commands.js` enum and reference `COMMANDS.ZONE_TEMP` (etc.) from both
   the decoders and the request builders.
2. Extract the field codecs still being rewritten — chiefly the **temperature**
   transform (uint16 ÷ 100, `0x7FFF` = no reading) — into bidirectional modules.
   (Zone ±1 is now centralised in the request factory and the temperature
   decoder, so temperature is the main one left.)

Revisit the package-by-command-code reorg once there are ~3 request types and
the real shape is visible. Renaming `decoders/` only makes sense if you go that
route; in the vocabulary-split, decoders stay decoders and you just add a shared
kernel beneath them.
