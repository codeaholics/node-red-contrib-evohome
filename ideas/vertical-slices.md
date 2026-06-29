# Roadmap: vertical slices toward replacing Domoticz

A plan of what to build, in what order, to take this package from "passive
listener plus a zone-temp poll" to a viable Domoticz replacement. The end goal is
InfluxDB monitoring first, with control as a later, optional phase.

See also: [DOMOTICZ-ACTIVE-WORK.md](../DOMOTICZ-ACTIVE-WORK.md) (the full
inventory of what Domoticz does actively) and
[decoders-and-requests.md](decoders-and-requests.md) (the shared-kernel design).

## Where we are

- **Passive pipeline** works: `in → parser → decoder → influxdb`.
- **Active pipeline** works and is **hardware-validated for sending**:
  `evohome-active → evohome-encoder → evohome-out`. Real RQ `30C9` lines are
  accepted by the gateway and replies come back through the passive pipeline.
- **B1 (setpoint polling) is built** (see Phase B). `evohome-active` now polls
  zone temp **and** setpoint override (2349) per zone; the 2349 decoder, request
  builder, and InfluxDB formatter are done and tested. Pending hardware
  verification of the follow-schedule reply (open question b below).
- Proven building blocks: the encoder (8-field send format), the request-builder
  pattern with a shared factory (`src/requests/utils/zone-selector-request.js`,
  used by `zone-temp` and `setpoint-override`), the paced send queue, `Config`
  accessors, an unused "spy" input on `evohome-active` for future reply-driven
  logic.
- **Open questions:** (a) does the radio echo our sent packets back? — still
  unresolved; shapes echo handling and send-confirmation. (b) *resolved* — a
  follow-schedule 2349/1F41 reply carries mode `0` with the value `0x7FFF`, so the
  decoder records the mode and omits the value; the mode refreshes correctly. (c)
  does controller **B** answer a poll? It has never been polled (the gateway only
  ever polled A), and 2349/1F41 are request-driven, so multi-controller coverage
  is unverified. (d) finalise the `*-test` measurement names before relying on
  them: `SetpointOverride`, `DHWState`, `DHWSetpoint`.

### The decoder reality (important)

`src/decoders/index.js` registers every command code, but **most are stubs** that
return a bare `{decoded: {type}}` with no payload parsing. Actually implemented:
`zone-temp`, `setpoint` (2309), `setpoint-override` (2349), `dhw-temp`,
`dhw-state` (1F41), `dhw-setpoint` (10A0), `heat-demand`, `battery-info`,
`zone-window`, `actuator-state`. Stubbed (recognised, not decoded):
`controller-mode` (2E04), `zone-info` (000A), `sys-info` (10E0),
`device-info` (0418), `zone-name` (0004), `external-sensor` (0002),
`actuator-check` (3B00), `binding` (1FC9).

So a lot of "monitoring completeness" is just **fleshing out stub decoders for
messages already on the air** — pure passive work, no radio transmission needed.

## Principles

1. **The hard infrastructure is done.** Remaining active work is mostly
   replicating a proven slice per data type.
2. **A data-type slice = real decoder (if stubbed) + request builder + schedule
   it.** Many data types get ~80% of their value from the decoder alone (the
   controller already broadcasts them); the active poll is the supplement for
   what's omitted or stale.
3. **A request is only useful if its reply can be decoded** — so the decoder
   precedes or accompanies the request builder, never the other way round.
4. **Keep every slice green** (lint + tests) and follow the conventions: pure
   modules tested, node files thin.

## Phase A — Enablers (small; unlock everything after)

- **A1. Spike: resolve the echo question.** Watch the inbound stream while
  sending; document whether the gateway echoes sent lines. This matters more
  than it looks: stub decoders return a bare type for *any* packet type, so once
  we send commands beyond `30C9`, an echoed RQ could be "decoded" as bogus data
  and emitted. (The real `30C9` decoder already null-guards requests; stubs
  don't.) Cheap, removes a known unknown, informs C1/C3. Doesn't block A2/A3.

- **A2. Shared kernel.** The second request type (B1) has since landed, and a
  `zone-selector-request` factory de-duplicated the *request* side (addressing +
  zone ±1). Still outstanding: a `commands.js` vocabulary enum, and the
  bidirectional **temperature codec** (the `÷100` / `0x7FFF` logic is still
  inline in each decoder). While here, extract `evohome-active`'s paced queue
  into a pure, unit-tested module (its only meaningfully stateful logic). Per
  decoders-and-requests.md.

- **A3. Generalise `evohome-active` into a scheduler of request jobs.** It now
  iterates a small hardcoded `ZONE_REQUESTS` list (zone-temp + setpoint-override)
  at a single cadence. Turn it into a registry of `{builder, cadence, args}` so
  adding a data type — or a different cadence — is a registration, not more
  hardcoding. Justified (not gold-plating) because replacing Domoticz needs
  genuine multi-cadence scheduling — Domoticz runs 5-min, 10-min, 20-min and
  connect-time jobs concurrently.

## Phase B — Monitoring completeness (the core value)

Each item is a thin end-to-end slice reusing the proven machinery: real decoder
(replacing the stub) + request builder + schedule. Ordered by monitoring value.

- **B1. Setpoints — 2349. ✅ Done.** Real `setpoint-override` decoder (zone,
  setpoint, mode, **until**), request builder, InfluxDB formatter; `evohome-active`
  polls it per zone. Now its **own** `SetpointOverride` measurement (split from
  `Setpoint`): the effective value comes from passive 2309, so this carries the
  override metadata (mode + until). The until-time follow-up is done — decoded via
  the shared override-trailer helper + `Message.getDateTime()`.
- **B2. DHW state — 1F41. ✅ Done.** Real `dhw-state` decoder (state on/off, mode,
  until — shares the override-trailer with 2349), per-controller request (only
  controllers with a configured DHW relay), 5-min poll, InfluxDB `DHWState`
  measurement. Also added **`dhw-setpoint` (10A0)** — DHW target temp + reheat
  differential, passive decode only (the cylinder sensor polls it). Measurements
  are at `*-test` names pending sign-off. 1F41 turned out to **broadcast on
  change** (not poll-only), so the poll is just baseline-after-restart insurance.
- **B3. Controller mode — 2E04.** Auto/away/eco/etc. Broadcast on change, so
  polling mainly guarantees you have it after a restart. Flesh out decoder, add
  request, schedule.
- **B4. Passive-only decoder backfill (no transmission).** Flesh out stubs for
  messages already broadcast, as appetite dictates and lowest risk:
  `zone-info` (000A), `sys-info` (10E0), `device-info` (0418),
  `external-sensor` (0002). `zone-name` (0004) is low value — the site config
  already supplies names. `actuator-check` / `binding` only matter for control,
  so leave them to Phase D.

## Phase C — Refinements (correctness/efficiency once breadth exists)

- **C1. Piggyback suppression via the spy input.** Wire the decoder's output into
  `evohome-active`'s input; reset a per-datum timer when a value arrives
  passively, and actively poll only what has gone stale (the multi-room zones the
  controller omits, etc.). Bigger payoff as the poll set grows — minimises RF
  collisions. This is the payoff for the seeded input.
- **C2. Connect-triggered bootstrap.** On (re)connect, fire a full
  RequestCurrentState-equivalent burst, driven by the connection node's status
  events. Robustness across gateway restarts.
- **C3. Echo handling / optional send-confirmation.** Driven by A1's finding:
  suppress our own echoes from the decode stream if needed, and optionally use
  the echo as a send-confirmation. Otherwise rely on periodic repetition (what
  Domoticz does).

## Phase D — Control (optional; only if you want writes, not just monitoring)

Separated deliberately: writes change the heating system, so they need more care
(confirmation, guarding, idempotency). Skip entirely if the goal is monitoring.

- **D1. Zone setpoint override write (2349 W)** — the most-wanted control.
- **D2. Controller mode write (2E04 W).**
- **D3. DHW state write (1F41 W).**
- **D4. Relay/boiler + sensor emulation** — Domoticz pretending to be a relay
  (heat-demand broadcast, ~10-min actuator keepalive, ~20-min demand refresh) and
  a sensor (external/zone temperature sends). Complex; only for specific setups.
- **D5. Binding flows** — most complex; only if a device must actually be bound
  to the controller.

## Cross-cutting / deferred

- **Request/response correlation:** deferred. There is no transaction id in the
  protocol; rely on repetition like Domoticz. Revisit only if retries are needed.
- **Decoder/request unification:** handled by A2 (shared kernel). Reconsider the
  package-by-command-code layout once there are ~3 request types and the shape is
  clear (see decoders-and-requests.md).

## Suggested immediate order

**B1 (setpoints) ✅ done → A2 / A3 (enablers) → B2 (DHW state) → B3 (mode).**

B1 landed ahead of the A2/A3 enablers (behaviour-first). Do A2 (shared kernel)
and A3 (scheduler generalisation) next so B2/B3 stay cheap rather than bolting
more hardcoded polls into `evohome-active`. The A1 echo spike is still worth
doing early and cheaply. Phases C and D follow once breadth exists — and D only
if control is actually wanted.
