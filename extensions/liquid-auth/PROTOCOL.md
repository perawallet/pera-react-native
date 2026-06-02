# Liquid Auth Protocol Negotiation (v1)

A protocol-neutral handshake layered over the Liquid Auth WebRTC data channel so
a single channel can carry more than one wallet-RPC dialect. Proposed as an
addition to Liquid Auth; this package is the reference wallet implementation.

## Roles

- **dApp = proposer.** Sends one offer as its first data-channel frame.
- **Wallet = selector.** Replies with exactly one protocol, or an error.

## Frames

All frames reuse Liquid Auth's `namespace:method:type` reference grammar under a
dedicated, protocol-neutral `liquidauth:` namespace. The envelope is **frozen at
version 1**; evolution happens only inside `params.protocols`.

### Offer (dApp → wallet) — `liquidauth:negotiate:offer`

```json
{
    "id": "<uuid>",
    "reference": "liquidauth:negotiate:offer",
    "params": {
        "handshakeVersion": 1,
        "liquidAuthVersion": "1.0",
        "protocols": [
            { "id": "arc0027", "versions": ["1.0"] },
            { "id": "walletconnect", "versions": ["2.0"] }
        ],
        "peer": {
            "name": "Tinyman",
            "url": "https://app.tinyman.org",
            "origin": "https://app.tinyman.org",
            "icon": "https://app.tinyman.org/icon.png",
            "description": "..."
        }
    }
}
```

`peer` is self-asserted and untrusted on its own.

### Select (wallet → dApp) — `liquidauth:negotiate:select`

Success:

```json
{
    "id": "<uuid>",
    "reference": "liquidauth:negotiate:select",
    "requestId": "<offer id>",
    "result": {
        "handshakeVersion": 1,
        "protocol": { "id": "arc0027", "version": "1.0" }
    }
}
```

Failure (then the wallet closes the channel):

```json
{
    "id": "<uuid>",
    "reference": "liquidauth:negotiate:select",
    "requestId": "<offer id>",
    "error": { "code": 5000, "message": "No mutually supported protocol" }
}
```

## Selection

Wallet preference order is authoritative (ALPN-style). The wallet picks the first
protocol it prefers that the dApp also offers, at the highest mutually-supported
version.

## Fallback (backward compatibility)

A wallet MUST keep working with dApps that never send an offer. It classifies the
first inbound frame and locks `arc0027` for any ARC-0027 traffic, processed
normally (zero added latency). There is **no** silence timer — Liquid Auth dApps
idle after the FIDO handshake and the channel must survive idle.

Classification relies on the three frame shapes being disjoint by their first
character: negotiation frames are JSON objects (start with `{`), ARC-0027 frames
travel as **base64(CBOR) text** (never start with `{`), and heartbeats are empty.
So any non-empty frame that does not start with `{` is treated as ARC-0027.

## Error codes (`5xxx`, distinct from ARC-0027's `4xxx`)

- `5000` NoCommonProtocolError
- `5001` UnsupportedHandshakeVersionError (`data.supported` lists handshake versions)
- `5002` MalformedOfferError

## Identity (server attestation — requires a signalling-server change)

The only verifiable dApp signal is `serverAttestedOrigin`: the dApp `Origin` as
observed and vouched for by the signalling server when the dApp peer connects.
Wallets display it as **verified**; absent it, `peer.origin` is shown as
**claimed/unverified** beside the always-verified signalling-server origin.
Emitting `serverAttestedOrigin` is a signalling-server addition tracked
separately.
