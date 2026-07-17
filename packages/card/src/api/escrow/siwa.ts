/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { sha256 } from '@noble/hashes/sha2.js'
import {
    concatBytes,
    decodeFromBase64,
    encodeToBase64,
} from '@perawallet/wallet-core-shared'

// SWAP POINT: Sign-In with Algorand (SIWA / ARC-0060) proof for AB card
// creation. The bytes MUST stay byte-for-byte identical to AppliedBlockchain's
// server-side `verifyArc60Auth`, or the signature will not validate.
//
// The wallet DOES support ARC-60 data signing (`useLocalKeyArc60Signer` +
// the hardware path, dispatched via the signing machine), but we cannot route
// AB card creation through it: AB's verifier is not standard ARC-60, differing
// on three independent axes, any one of which breaks it —
//   1. authenticatorData is appended RAW (the standard signer re-hashes it:
//      `sha256(data) || sha256(authData)`);
//   2. the signature is `"MX" || message` (algosdk.signBytes), which our
//      `useArbitraryDataSigner` reproduces — the standard ARC-60 path omits MX;
//   3. the payload carries `genesis_hash` (no `chain_id`) and isn't canonical,
//      so the standard `parseSiwa` would REJECT it before signing.
// So we reuse the existing MX arbitrary-data signer with this AB-shaped payload
// builder — do NOT consolidate with `packages/signing/src/utils/arc60.ts`.
//
// TODO(card): temporary. Once AB update their verifier to the STANDARD ARC-60
// schema, drop this builder and route through `useLocalKeyArc60Signer` / the
// hardware path — which is also on-device signable, so Ledger funding sources
// would work (see useEscrowCardCreation + isSigningCapableFundingSource).

/** Statement shown in the SIWA payload; matches AB's demo default. */
const SIWA_STATEMENT = 'Prove address ownership'
/** SIWA payload validity window — 30 minutes, matching AB's demo default. */
const SIWA_TTL_MS = 30 * 60 * 1000

/**
 * ARC-60 SIWA payload. Property order is significant: it is serialized with a
 * plain `JSON.stringify`, and the server re-hashes the exact byte string, so
 * the key order here must match AB's `buildArc60Payload`.
 */
export type EscrowSiwaPayload = {
    domain: string
    genesis_hash: string
    account_address: string
    type: 'ed25519'
    statement: string
    uri: string
    version: '1'
    nonce: string
    'issued-at': string
    'expiration-time': string
}

/**
 * ARC-60 `StdSigData`: `data` is base64(UTF-8 JSON payload); the first 32 bytes
 * of `authenticatorData` are sha256(domain).
 */
export type EscrowSiwaSignData = {
    data: string
    authenticatorData: string
}

export type BuildEscrowSiwaPayloadArgs = {
    domain: string
    /** Base64 network genesis hash the signature is bound to. */
    genesisHash: string
    /** Funding-source (delegator) address proving ownership. */
    address: string
    uri: string
    /** Single-use anti-replay nonce. */
    nonce: string
    /** Injected for deterministic tests; defaults to `new Date()`. */
    now?: Date
}

export const buildEscrowSiwaPayload = ({
    domain,
    genesisHash,
    address,
    uri,
    nonce,
    now = new Date(),
}: BuildEscrowSiwaPayloadArgs): EscrowSiwaPayload => ({
    domain,
    genesis_hash: genesisHash,
    account_address: address,
    type: 'ed25519',
    statement: SIWA_STATEMENT,
    uri,
    version: '1',
    nonce,
    'issued-at': now.toISOString(),
    'expiration-time': new Date(now.getTime() + SIWA_TTL_MS).toISOString(),
})

/**
 * Encodes the payload into ARC-60 `signData`: `data` = base64(UTF-8 JSON) and
 * `authenticatorData` = base64(sha256(domain)) — the 32-byte domain hash the
 * verifier recomputes from `payload.domain`.
 */
export const buildEscrowSiwaSignData = (
    payload: EscrowSiwaPayload,
): EscrowSiwaSignData => {
    const data = encodeToBase64(
        new TextEncoder().encode(JSON.stringify(payload)),
    )
    const authenticatorData = encodeToBase64(
        sha256(new TextEncoder().encode(payload.domain)),
    )
    return { data, authenticatorData }
}

/**
 * Builds the bytes to sign: `sha256(dataBytes) || authenticatorData` (64 bytes
 * — the data hash followed by the RAW authenticatorData, not re-hashed). The
 * caller signs these with `"MX"` prepended (via `useArbitraryDataSigner`).
 */
export const buildEscrowSiwaMessage = (
    signData: EscrowSiwaSignData,
): Uint8Array =>
    concatBytes(
        sha256(decodeFromBase64(signData.data)),
        decodeFromBase64(signData.authenticatorData),
    )
