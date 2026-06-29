/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import {
    Address,
    msgpackRawDecode,
    msgpackRawEncode as encodeMsgpack,
} from 'algosdk'
import nacl from 'tweetnacl'
import {
    bytesEqual,
    concatBytes,
    decodeBoundedBase64,
} from '@perawallet/wallet-core-shared'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { addTxPrefix } from './rawTransactions'

// Defence-in-depth caps on base64 fields in the backend cosign response, applied
// before each decode. A signature is exactly 64 bytes; 128 leaves slack for
// padding. A raw transaction is at most a few KB; 64 KB is far above any real
// transaction. Oversize is treated as a malformed entry, not a hard failure.
const MAX_SIGNATURE_B64_BYTES = 128
const MAX_RAW_TXN_B64_BYTES = 64 * 1024

// Ed25519 sizes — an address public key is 32 bytes, a signature 64.
const PUBLIC_KEY_BYTE_LENGTH = 32
const SIGNATURE_BYTE_LENGTH = 64

/**
 * Per-participant response from the multisig backend. `signatures[i]` is
 * the base64-encoded signature for transaction index `i` (same order as
 * the enclosing transaction list's `rawTransactions`). Null entries mean
 * "this participant didn't sign this index".
 */
export type ParticipantResponse = {
    address: string
    response: 'signed' | 'declined'
    signatures?: Nullable<string>[]
}

export type AssembleSignedMultisigParams = {
    /** Base64-encoded canonical msgpack bytes for each unsigned transaction. */
    rawTransactionsBase64: string[]
    /** Multisig participant addresses, in the same order as the on-chain msig. */
    participantAddresses: string[]
    /** Multisig version (typically `1`). */
    version: number
    /** Threshold (minimum number of signatures required). */
    threshold: number
    /** Per-participant responses; only entries with `response: 'signed'` contribute sigs. */
    responses: ParticipantResponse[]
    /**
     * Address of the multisig that authorizes these transactions (the joint
     * account being signed). When a transaction's sender differs from it — i.e.
     * the sender is rekeyed to this multisig — the assembled signed transaction
     * carries an `sgnr` (auth-address) field. Omit for plain multisig spends
     * where the sender is the multisig itself.
     */
    multisigAddress?: string
}

export type AssembleSignedMultisigResult =
    | { kind: 'success'; signedTransactionsBytes: Uint8Array[] }
    | { kind: 'error'; reason: string }

/**
 * msgpack `fixmap` header for a 2-entry map. The signed-transaction envelope
 * `{ "msig": ..., "txn": ... }` is built by writing this single structural
 * byte, then appending each msgpack-encoded key/value — so the raw transaction
 * bytes go in verbatim as the final value, never decoded and re-encoded.
 */
const SIGNED_TXN_MAP_HEADER = new Uint8Array([0x82])

/**
 * msgpack `fixmap` header for a 3-entry map — the signed-transaction envelope
 * `{ "msig": ..., "sgnr": ..., "txn": ... }` used when the sender is rekeyed to
 * the signing multisig. Keys stay in canonical (alphabetical) order: msig <
 * sgnr < txn.
 */
const SIGNED_TXN_MAP_HEADER_WITH_SIGNER = new Uint8Array([0x83])

/**
 * Reads the 32-byte sender public key (`snd`) from raw transaction msgpack
 * bytes. Decodes only to inspect the sender — the raw bytes are still embedded
 * verbatim in the envelope, never re-encoded. `msgpackRawDecode` yields a plain
 * object keyed by the transaction's string field names, so we read `snd`
 * directly. Returns `null` when the field is absent (e.g. canonical msgpack
 * omits a zero sender) or the bytes can't be decoded. Mirrors pera-android's
 * `MultisigTransactionAssembler.extractSenderPublicKey`.
 */
const extractSenderPublicKey = (rawTxBytes: Uint8Array): Uint8Array | null => {
    try {
        const decoded = msgpackRawDecode(rawTxBytes) as Record<string, unknown>
        const snd = decoded.snd
        return snd instanceof Uint8Array ? snd : null
    } catch {
        return null
    }
}

const isAllZero = (bytes: Uint8Array): boolean => {
    for (const b of bytes) if (b !== 0) return false
    return true
}

/**
 * Decodes and validates one participant signature from the backend. Returns
 * the raw 64-byte signature, or `null` if the entry is absent, not valid
 * base64, the wrong length, or all-zero (a backend placeholder — matches
 * Android's sanity filter). A `null` means "no signature from this
 * participant for this index", never a hard error.
 */
const parseSignature = (sig: Nullable<string>): Uint8Array | null => {
    if (!sig) return null
    let bytes: Uint8Array
    try {
        bytes = decodeBoundedBase64(
            sig,
            MAX_SIGNATURE_B64_BYTES,
            'msig signature',
        )
    } catch {
        return null
    }
    if (bytes.length !== SIGNATURE_BYTE_LENGTH || isAllZero(bytes)) return null
    return bytes
}

/**
 * Resolves base public keys for each participant address. Mirrors
 * algorand's encoded address format: 32-byte pubkey + 4-byte checksum,
 * base32-encoded. `Address.fromString(addr).publicKey` gives us the raw
 * 32-byte pubkey.
 */
const resolvePublicKeys = (
    addresses: string[],
): Map<string, Uint8Array> | null => {
    const out = new Map<string, Uint8Array>()
    for (const addr of addresses) {
        try {
            const pk = Address.fromString(addr).publicKey
            if (pk.length !== PUBLIC_KEY_BYTE_LENGTH) return null
            out.set(addr, pk)
        } catch {
            return null
        }
    }
    return out
}

/**
 * Assembles fully-signed multisig transaction bytes from the per-participant
 * signatures collected by the multisig backend.
 *
 * Builds the canonical algod-compatible msgpack envelope for each item:
 * ```
 * { "msig": { "subsig": [{pk, s?}, ...], "thr": <int>, "v": <int> },
 *   "txn":  <raw transaction bytes, embedded verbatim> }
 * ```
 *
 * The "txn" value is embedded as-is — we do NOT decode + re-encode through
 * algosdk, because canonical-msgpack rules around field ordering and integer
 * size can differ slightly between SDKs. Each participant signed a specific
 * byte sequence; re-encoding it could produce a different sequence and break
 * signature verification on algod. Mirrors pera-android's
 * `MultisigTransactionAssembler.kt`.
 *
 * Per-transaction subsigs are in `participantAddresses` order. Entries
 * without a signature omit the `s` field; entries with a signature include
 * both `pk` (32 bytes) and `s` (64 bytes). All-zero signatures are treated
 * as missing (matches Android's sanity filter, defends against backend
 * returning placeholder bytes).
 *
 * Every contributing signature is Ed25519-verified against
 * `"TX" || <raw transaction bytes>` under the participant's public key
 * before assembly. The backend is a collection/relay service, not a trust
 * anchor: without this check a compromised backend could pair harvested
 * signatures with attacker-substituted transaction bytes and the wallet
 * would affirmatively deliver a transaction nobody reviewed. A
 * non-verifying (or non-participant) signature is a hard error.
 *
 * @returns `success` with the assembled signed-transaction bytes per item,
 *   or `error` with a human-readable reason if any item failed (e.g.
 *   insufficient signatures, invalid pubkey).
 */
export const assembleSignedMultisigTransactions = (
    params: AssembleSignedMultisigParams,
): AssembleSignedMultisigResult => {
    const {
        rawTransactionsBase64,
        participantAddresses,
        version,
        threshold,
        responses,
        multisigAddress,
    } = params

    // Public key (raw 32 bytes) of the signing multisig address, used to decide
    // whether a transaction's sender is rekeyed to it. Null when no multisig
    // address was supplied or it can't be parsed — in which case no `sgnr` is
    // written (the legacy, non-rekey behavior).
    let multisigPublicKey: Uint8Array | null = null
    if (multisigAddress) {
        try {
            multisigPublicKey = Address.fromString(multisigAddress).publicKey
        } catch {
            multisigPublicKey = null
        }
    }

    if (rawTransactionsBase64.length === 0) {
        return { kind: 'success', signedTransactionsBytes: [] }
    }

    if (participantAddresses.length === 0) {
        return { kind: 'error', reason: 'No multisig participants provided' }
    }

    if (threshold <= 0 || threshold > participantAddresses.length) {
        return {
            kind: 'error',
            reason: `Invalid threshold ${threshold} for ${participantAddresses.length} participants`,
        }
    }

    const pubkeys = resolvePublicKeys(participantAddresses)
    if (!pubkeys) {
        return {
            kind: 'error',
            reason: 'Failed to resolve participant public keys',
        }
    }

    // Collect signed-only responses keyed by participant address. Decoded
    // signature bytes are cached so we only do base64 once per (address, txIdx).
    const sigsByAddress = new Map<string, Array<Uint8Array | null>>()
    for (const resp of responses) {
        if (resp.response !== 'signed') continue
        sigsByAddress.set(
            resp.address,
            (resp.signatures ?? []).map(parseSignature),
        )
    }

    const signedList: Uint8Array[] = []
    for (let txIndex = 0; txIndex < rawTransactionsBase64.length; txIndex++) {
        let rawTxBytes: Uint8Array
        try {
            rawTxBytes = decodeBoundedBase64(
                rawTransactionsBase64[txIndex],
                MAX_RAW_TXN_B64_BYTES,
                'msig raw transaction',
            )
        } catch {
            return {
                kind: 'error',
                reason: `Transaction ${txIndex}: invalid base64 raw transaction`,
            }
        }
        if (rawTxBytes.length === 0) {
            return {
                kind: 'error',
                reason: `Transaction ${txIndex}: invalid base64 raw transaction`,
            }
        }

        // Cryptographically verify every contributing signature against the
        // exact bytes being assembled, under the participant's public key.
        // A well-formed signature that does NOT verify is a hard error, not
        // a missing signature: it means the backend paired signatures with
        // transaction bytes the participants never signed (corruption or a
        // swapped-transaction attack) — refuse to produce output for it.
        const signedBytes = addTxPrefix(rawTxBytes)
        let validCount = 0
        for (const [address, sigs] of sigsByAddress) {
            const sig = sigs[txIndex]
            if (!sig) continue
            const pk = pubkeys.get(address)
            if (!pk) {
                return {
                    kind: 'error',
                    reason: `Transaction ${txIndex}: signature from non-participant ${address}`,
                }
            }
            if (!nacl.sign.detached.verify(signedBytes, sig, pk)) {
                return {
                    kind: 'error',
                    reason: `Transaction ${txIndex}: signature from ${address} failed verification against the transaction bytes`,
                }
            }
            validCount++
        }

        // Threshold check per transaction index. Decline-only participants
        // contribute zero signatures here; missing arrays count as zero.
        if (validCount < threshold) {
            return {
                kind: 'error',
                reason: `Transaction ${txIndex}: not enough valid signatures (${validCount}/${threshold})`,
            }
        }

        // Per-participant subsigs in participantAddresses order. Entries with a
        // signature carry both `pk` and `s`; entries without carry only `pk`.
        const subsig = participantAddresses.map(address => {
            const pk = pubkeys.get(address)!
            const sig = sigsByAddress.get(address)?.[txIndex] ?? null
            return sig ? { pk, s: sig } : { pk }
        })

        // When the transaction's sender differs from the signing multisig
        // address, the sender is rekeyed to this multisig and the envelope must
        // carry the auth address in `sgnr` (the multisig's 32-byte pubkey).
        // Otherwise the sender authorizes itself and no `sgnr` is written.
        // Mirrors pera-android's MultisigTransactionAssembler.kt.
        const senderPublicKey = extractSenderPublicKey(rawTxBytes)
        const authAddrPublicKey =
            multisigPublicKey &&
            senderPublicKey &&
            !bytesEqual(multisigPublicKey, senderPublicKey)
                ? multisigPublicKey
                : null

        // SignedTransaction envelope: a 2-entry map { msig, txn } (or a 3-entry
        // map { msig, sgnr, txn } when rekeyed). encodeMsgpack canonically
        // encodes the `msig` map (sorted keys); the raw transaction bytes are
        // appended verbatim as the final value — never decoded and re-encoded,
        // so the exact bytes each participant signed reach algod.
        signedList.push(
            authAddrPublicKey
                ? concatBytes(
                      SIGNED_TXN_MAP_HEADER_WITH_SIGNER,
                      encodeMsgpack('msig'),
                      encodeMsgpack({ subsig, thr: threshold, v: version }),
                      encodeMsgpack('sgnr'),
                      encodeMsgpack(authAddrPublicKey),
                      encodeMsgpack('txn'),
                      rawTxBytes,
                  )
                : concatBytes(
                      SIGNED_TXN_MAP_HEADER,
                      encodeMsgpack('msig'),
                      encodeMsgpack({ subsig, thr: threshold, v: version }),
                      encodeMsgpack('txn'),
                      rawTxBytes,
                  ),
        )
    }

    return { kind: 'success', signedTransactionsBytes: signedList }
}
