# Liquid Auth Extension: Protocol Negotiation (Handshake v1)

**Status:** Draft / Proposed extension
**Layer:** Liquid Auth WebRTC data channel (post-FIDO2 ceremony)
**Reference implementation:** the `negotiate/` submodule of `@perawallet/wallet-extension-liquid-auth` (dependency-free, framework-agnostic; reference wallet-side implementation). See also `extensions/liquid-auth/PROTOCOL.md` for the wire summary.

---

## 1. Abstract

This document proposes a small, protocol-neutral **negotiation handshake** that
runs as the first exchange on the Liquid Auth WebRTC data channel. It lets a
single Liquid Auth channel carry **more than one wallet-RPC dialect** (e.g.
ARC-0027 and WalletConnect) by having the dApp advertise the protocols it speaks
and the wallet select exactly one.

The handshake is **fully backward compatible**: a wallet implementing it keeps
working with dApps that never negotiate, and adds zero latency to that path.

Only one part of this proposal touches the Liquid Auth **signalling server**
(§9, server-attested origin); everything else lives entirely in the dApp and
wallet endpoints and can ship without server changes.

## 2. Motivation

Liquid Auth establishes an authenticated, peer-to-peer WebRTC data channel
between a dApp and a wallet. Today the bytes that flow over that channel are an
implicit, single dialect — both ends must agree out of band on which wallet-RPC
protocol they speak. That:

- prevents a wallet from supporting multiple dialects over Liquid Auth without
  guessing or sniffing, and
- gives no clean, versioned path to introduce a new dialect later.

A one-round-trip handshake at channel open removes the ambiguity and makes the
dialect (and its version) explicit and extensible, without disturbing the
existing FIDO2/WebRTC ceremony that precedes it.

## 3. Terminology

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY**
are to be interpreted as in RFC 2119.

- **Proposer / dApp** — the peer that initiates. It sends exactly one _offer_ as
  its first data-channel frame.
- **Selector / wallet** — the peer that responds. It replies with exactly one
  _select_ (success or error).
- **Frame** — a single application message on the data channel (one
  `send`/`message` payload).
- **Dialect / protocol** — a wallet-RPC protocol carried after negotiation
  (e.g. `arc0027`, `walletconnect`).

## 4. Relationship to Liquid Auth

The handshake occupies the **first application frames** on the data channel,
**after** the Liquid Auth FIDO2/WebRTC connection is established. It does not
modify the signalling, attestation, or ICE/DTLS layers.

Negotiation frames reuse Liquid Auth's existing `namespace:method:type`
**reference grammar**, under a dedicated, protocol-neutral namespace:

```
liquidauth:negotiate:offer     (dApp  → wallet)
liquidauth:negotiate:select    (wallet → dApp)
```

This makes negotiation frames syntactically distinguishable from dialect frames
that use other namespaces (e.g. `arc0027:*`).

## 5. Frame Envelope (frozen at version 1)

The negotiation **envelope** is **frozen at `handshakeVersion: 1`** and MUST NOT
change. All future evolution happens **inside** `params.protocols` (new dialect
ids/versions), never in the envelope. This guarantees that every peer — current
or future — can always parse a negotiation frame far enough to determine the
handshake version and respond, even if it supports none of the offered dialects.

`handshakeVersion` is carried in both the offer and the select result.

## 6. Offer — `liquidauth:negotiate:offer` (dApp → wallet)

The dApp MUST send the offer as its **first** data-channel frame.

```jsonc
{
    "id": "9b2c…-uuid", // correlation id (string, REQUIRED)
    "reference": "liquidauth:negotiate:offer",
    "params": {
        "handshakeVersion": 1, // REQUIRED, MUST be 1
        "liquidAuthVersion": "1.0", // OPTIONAL, informational
        "protocols": [
            // REQUIRED, non-empty, preference is NOT significant
            { "id": "arc0027", "versions": ["1.0"] },
            { "id": "walletconnect", "versions": ["2.0"] },
        ],
        "peer": {
            // OPTIONAL, self-asserted dApp metadata (see §9)
            "name": "Example DApp",
            "url": "https://app.example.org",
            "origin": "https://app.example.org",
            "icon": "https://app.example.org/icon.png",
            "description": "…",
        },
    },
}
```

- `id` MUST be a string; it correlates the wallet's reply (`requestId`).
- `protocols` MUST be a non-empty array of `{ id, versions[] }`. Each `versions`
  entry is a dotted version string (e.g. `"1.0"`, `"2.1.3"`).
- `peer` is **self-asserted and untrusted on its own** (see §9, §10).
- The **dApp's** ordering of `protocols` carries no weight; the wallet's
  preference is authoritative (§8).

## 7. Select — `liquidauth:negotiate:select` (wallet → dApp)

The wallet MUST reply with exactly one select frame correlated by `requestId`.

### 7.1 Success

```jsonc
{
    "id": "f1a0…-uuid",
    "reference": "liquidauth:negotiate:select",
    "requestId": "9b2c…-uuid", // == offer.id
    "result": {
        "handshakeVersion": 1,
        "protocol": { "id": "arc0027", "version": "1.0" },
    },
}
```

After sending a successful select, the wallet **locks** the channel to the
selected dialect and routes every subsequent frame to it. The dApp MUST switch
to the selected `{ id, version }` and MAY begin sending dialect frames
immediately.

### 7.2 Error

```jsonc
{
    "id": "c7d4…-uuid",
    "reference": "liquidauth:negotiate:select",
    "requestId": "9b2c…-uuid",
    "error": {
        "code": 5000,
        "message": "No mutually supported protocol",
        "data": {
            /* optional, code-specific */
        },
    },
}
```

After sending an error, the wallet **closes the channel** (§10).

## 8. Selection Algorithm

Selection is **ALPN-style**: the **wallet's** preference order is authoritative.

The wallet iterates its own preference-ordered protocol list and selects the
**first** protocol that the dApp also offers, at the **highest mutually
supported version**:

```
for wallet_protocol in wallet_preference_order:
    offered = offer.protocols.find(id == wallet_protocol.id)
    if not offered: continue
    common = wallet_protocol.versions ∩ offered.versions
    if common: return { id, version: max(common) }   // dotted-integer compare
return NONE  → error 5000
```

Versions are compared per dotted-integer segment (`"1.10" > "1.9"`); missing
segments are treated as `0`. If no protocol id overlaps, or an overlapping id
has no common version, the wallet replies with **`5000 NoCommonProtocol`** and
closes.

## 9. dApp Identity & Trust

The negotiated identity feeds the wallet's connection-approval UI. There are two
sources, with very different trust:

| Source                 | Trust                    | Origin of the value                                                                                              |
| ---------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `serverAttestedOrigin` | **Verified**             | The dApp `Origin` observed and vouched for by the Liquid Auth **signalling server** when the dApp peer connects. |
| `offer.params.peer`    | **Claimed / unverified** | Self-asserted by the dApp inside the offer.                                                                      |

Resolution rule (reference behavior):

- If a `serverAttestedOrigin` is available, the wallet displays it as the
  **verified** origin (using `peer.name` for the label when present).
- Otherwise the wallet displays `peer.origin` (or, failing that, the signalling
  host) as **claimed / unverified**, and SHOULD visually distinguish it from the
  always-known signalling-server origin.

> **🔧 Server-side change requested.** `serverAttestedOrigin` is the **only**
> verifiable dApp signal, and emitting it is the **one part of this proposal that
> requires a Liquid Auth signalling-server addition**: when the dApp peer
> connects, the server should surface the `Origin` it observed to the wallet
> peer. Everything else in this document is endpoint-only. Until the server
> emits it, wallets operate in the "claimed/unverified" mode above. We'd welcome
> guidance from the Liquid Auth team on the cleanest way to carry this
> (signalling message field vs. data-channel preamble).

## 10. State Machine & Channel Lifecycle

The wallet runs a small state machine over inbound frames:

```
                 ┌───────────────────────────── unknown / heartbeat (stay)
                 ▼
state = NEGOTIATING
   │
   ├─ first frame classified as a dialect request (no offer) ─► lock that dialect (FALLBACK, §11)
   │
   └─ first frame is liquidauth:negotiate:offer
         │
         ├─ handshakeVersion ≠ 1            ─► send 5001, close
         ├─ malformed (e.g. no protocols)   ─► send 5002 (if id known) / close
         ├─ no common protocol              ─► send 5000, close
         └─ success                         ─► send select, lock { id }, surface identity

state = <selected dialect>  ─► route every later frame to that dialect
state = CLOSED              ─► ignore all frames
```

**No negotiation timer.** An idle channel MUST remain in `NEGOTIATING`
indefinitely. Liquid Auth channels are expected to sit idle after the FIDO2
handshake, so a silence-based timeout would wrongly tear down healthy channels.
Teardown is owned by the channel lifecycle, not the handshake.

## 11. Backward Compatibility (Fallback)

A wallet implementing this extension MUST keep working with dApps that **never
send an offer**.

The wallet classifies the **first** inbound frame. If it is a dialect request
rather than a negotiation offer, the wallet locks that dialect (ARC-0027 in the
reference implementation) and processes the frame normally. This path adds **no
round trip and no latency** — the legacy dApp behaves exactly as before.

### 11.1 Frame classification

Coexistence relies on the three frame shapes being **disjoint by first
character** on the Liquid Auth data channel:

| Frame kind        | Shape             | First character |
| ----------------- | ----------------- | --------------- |
| Negotiation frame | JSON object       | `{`             |
| ARC-0027 frame    | base64(CBOR) text | never `{`       |
| Heartbeat         | empty string      | —               |

Classification (after trimming):

1. Empty → **heartbeat** → ignore, stay negotiating.
2. Does **not** start with `{` → opaque **dialect request** (ARC-0027).
3. Starts with `{` and parses as JSON with `reference`:
    - `liquidauth:negotiate:offer` → **negotiation offer**
    - `arc0027:*:request` → **dialect request**
    - anything else → **unknown** → ignore, stay negotiating.

This is why the envelope is frozen (§5) and why dialects whose wire format could
collide with `{`-prefixed JSON must be added behind an explicit offer rather than
sniffed.

## 12. Error Codes

Negotiation errors use the **`5xxx`** range, deliberately disjoint from
ARC-0027's `4xxx` range so the two never collide.

| Code   | Name                               | Meaning                                                                                | `data`                 |
| ------ | ---------------------------------- | -------------------------------------------------------------------------------------- | ---------------------- |
| `5000` | `NoCommonProtocolError`            | No protocol id/version overlaps between offer and wallet.                              | —                      |
| `5001` | `UnsupportedHandshakeVersionError` | `offer.handshakeVersion` is not supported.                                             | `{ "supported": [1] }` |
| `5002` | `MalformedOfferError`              | Offer is in the negotiation namespace but fails validation (e.g. missing `protocols`). | —                      |

Notes:

- For `5002`, the wallet SHOULD reply using the offer's `id` as `requestId`,
  then close. If `id` itself is missing/unparseable, the wallet has no
  correlation id to reply to and MUST simply **close the channel**.
- Every error is terminal: the wallet closes the channel after sending it.

## 13. Security Considerations

- **`peer` is untrusted.** Treat `offer.params.peer` as a display hint only.
  Wallets MUST NOT grant trust based on self-asserted fields; only
  `serverAttestedOrigin` (§9) is verifiable.
- **No new transport trust.** The handshake inherits Liquid Auth's existing
  channel security; it neither weakens nor strengthens transport authentication.
- **Frozen envelope = robust downgrade story.** Because every peer can always
  parse the envelope, a version/dialect mismatch produces a clean, explicit
  error (`5000`/`5001`) rather than a hang or a misparsed dialect frame.
- **Consent is a wallet concern.** Protocol selection is mechanical; user
  consent (account selection, approval) remains entirely the wallet's
  responsibility and is independent of which dialect is negotiated.

## 14. Versioning & Evolution

- The **envelope** (`liquidauth:negotiate:*`, `handshakeVersion: 1`) is frozen.
- New **dialects** are introduced purely by adding `{ id, versions[] }` entries
  to offers and to wallet preference lists — no envelope change, no new message
  types.
- New **versions** of an existing dialect are introduced by adding version
  strings to `versions[]`; the selection algorithm (§8) picks the highest
  common version automatically.
- A genuinely incompatible future handshake would ship as a _new_ envelope and
  be detected via `5001` against `handshakeVersion: 1`.

## 15. Reference Implementation

A dependency-free, framework-agnostic reference implementation exists on the
wallet side (the `negotiate/` submodule of
`@perawallet/wallet-extension-liquid-auth`), covering:

- `parseOffer` / `buildSelect` / `buildSelectError` — frame codec (§6, §7)
- `classifyFrame` — first-frame classification (§11.1)
- `selectProtocol` — ALPN-style selection with dotted-version comparison (§8)
- `createNegotiator` — the state machine (§10) including the no-offer fallback
- `resolveDisplayIdentity` — verified vs. claimed identity resolution (§9)

We're keen to align this with the Liquid Auth spec and would value feedback on
(a) the negotiation namespace/grammar fit, and (b) the cleanest server-side
carrier for `serverAttestedOrigin` (§9).
