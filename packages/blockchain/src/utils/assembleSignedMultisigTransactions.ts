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

import { Address } from '@algorandfoundation/algokit-utils'
import {
    encodeMsgpack,
    PUBLIC_KEY_BYTE_LENGTH,
    SIGNATURE_BYTE_LENGTH,
} from '@algorandfoundation/algokit-utils/common'
import { concatBytes, decodeFromBase64 } from '@perawallet/wallet-core-shared'
import type { Nullable } from '@perawallet/wallet-core-shared'

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
        bytes = decodeFromBase64(sig)
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
    } = params

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
        // Threshold check per transaction index. Decline-only participants
        // contribute zero signatures here; missing arrays count as zero.
        let validCount = 0
        for (const sigs of sigsByAddress.values()) {
            if (sigs[txIndex]) validCount++
        }
        if (validCount < threshold) {
            return {
                kind: 'error',
                reason: `Transaction ${txIndex}: not enough valid signatures (${validCount}/${threshold})`,
            }
        }

        let rawTxBytes: Uint8Array
        try {
            rawTxBytes = decodeFromBase64(rawTransactionsBase64[txIndex])
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

        // Per-participant subsigs in participantAddresses order. Entries with a
        // signature carry both `pk` and `s`; entries without carry only `pk`.
        const subsig = participantAddresses.map(address => {
            const pk = pubkeys.get(address)!
            const sig = sigsByAddress.get(address)?.[txIndex] ?? null
            return sig ? { pk, s: sig } : { pk }
        })

        // SignedTransaction envelope: a 2-entry map { msig, txn }. encodeMsgpack
        // canonically encodes the `msig` map (sorted keys); the raw transaction
        // bytes are appended verbatim as the final value — never decoded and
        // re-encoded, so the exact bytes each participant signed reach algod.
        //
        // TODO(rekey-to-multisig): pera-android's MultisigTransactionAssembler.kt
        // writes a 3rd alphabetical field "sgnr" (32-byte multisig pubkey) when
        // the txn's `snd` differs from the multisig address — i.e. a regular
        // account rekeyed to a multisig. This is omitted here because the
        // signing pipeline doesn't yet route such accounts into this assembler:
        // packages/signing/src/pipeline/signing/getSigningStrategy.ts and
        // packages/signing/src/pipeline/transports/getTransport.ts both check
        // isMultisigAccount() directly without following auth-addr. The `sgnr`
        // field and the routing changes should land together in a follow-up.
        signedList.push(
            concatBytes(
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
