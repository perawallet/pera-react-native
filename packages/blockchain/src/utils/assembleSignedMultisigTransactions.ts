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
    deferToNextCycle,
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

// Transactions verified per event-loop turn. Matches the signer batch size so
// bulk multisig groups yield on the same cadence as bulk signing.
const VERIFY_BATCH_SIZE = 16

/** `signatures[i]` matches `rawTransactions[i]`; null means "didn't sign". */
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
     * A sender that differs from this is rekeyed to the multisig, so the
     * envelope gains an `sgnr` field. Omit for plain multisig spends.
     */
    multisigAddress?: string
}

export type AssembleSignedMultisigResult =
    | { kind: 'success'; signedTransactionsBytes: Uint8Array[] }
    | { kind: 'error'; reason: string }

/** Header for `{ msig, txn }` — see `assembleSignedMultisigTransactions`. */
const SIGNED_TXN_MAP_HEADER = new Uint8Array([0x82])

/** Header for the rekeyed `{ msig, sgnr, txn }`. Canonical order: msig < sgnr < txn. */
const SIGNED_TXN_MAP_HEADER_WITH_SIGNER = new Uint8Array([0x83])

/**
 * Decodes only to inspect the sender — the raw bytes still go into the envelope
 * verbatim. `null` when `snd` is absent (canonical msgpack omits a zero sender)
 * or undecodable.
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
 * `null` means "no signature for this index", never an error — including for
 * an all-zero backend placeholder, matching Android's sanity filter.
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

/** An encoded address is a 32-byte pubkey plus a 4-byte checksum, base32'd. */
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
 * Builds the algod-compatible msgpack envelope
 * `{ msig: { subsig, thr, v }, txn }` per item, with subsigs in
 * `participantAddresses` order. Mirrors pera-android's
 * `MultisigTransactionAssembler.kt`.
 *
 * `txn` is embedded verbatim, never decoded and re-encoded through algosdk:
 * canonical-msgpack rules differ slightly between SDKs, so re-encoding could
 * produce bytes whose signatures algod won't verify.
 *
 * Every signature is Ed25519-verified against `"TX" || <raw bytes>` first. The
 * backend is a relay, not a trust anchor — without this a compromised one could
 * pair harvested signatures with substituted transaction bytes, and the wallet
 * would deliver a transaction nobody reviewed. A non-verifying signature is a
 * hard error.
 */
export const assembleSignedMultisigTransactions = async (
    params: AssembleSignedMultisigParams,
): Promise<AssembleSignedMultisigResult> => {
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
        // Yield between chunks so a large group (transactions × participants)
        // of pure-JS tweetnacl verifies can't block the JS thread for the whole
        // run. Mirrors `SIGN_BATCH_SIZE` + `deferToNextCycle` in
        // `useLocalKeyTransactionSigner` / `useQuantumTransactionSigner`.
        if (txIndex > 0 && txIndex % VERIFY_BATCH_SIZE === 0) {
            await deferToNextCycle()
        }

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

        // A well-formed signature that does NOT verify is a hard error, not a
        // missing one: it means the backend paired signatures with bytes the
        // participants never signed.
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

        // A sender differing from the signing multisig is rekeyed to it, so the
        // envelope must carry the auth address in `sgnr`. Otherwise the sender
        // authorizes itself and `sgnr` is omitted.
        const senderPublicKey = extractSenderPublicKey(rawTxBytes)
        const authAddrPublicKey =
            multisigPublicKey &&
            senderPublicKey &&
            !bytesEqual(multisigPublicKey, senderPublicKey)
                ? multisigPublicKey
                : null

        // `encodeMsgpack` canonically encodes the `msig` map; the raw
        // transaction bytes are appended verbatim as the final value, so the
        // exact bytes each participant signed reach algod.
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
