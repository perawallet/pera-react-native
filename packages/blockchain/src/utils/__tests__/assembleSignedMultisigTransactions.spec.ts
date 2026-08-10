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

import { describe, test, expect } from 'vitest'
import {
    Address,
    msgpackRawDecode as decodeMsgpack,
    msgpackRawEncode as encodeMsgpack,
} from 'algosdk'
import nacl from 'tweetnacl'
import {
    VERIFY_BATCH_SIZE,
    assembleSignedMultisigTransactions,
    type ParticipantResponse,
} from '../assembleSignedMultisigTransactions'

// Test fixtures — real Ed25519 keypairs: the assembler verifies every
// signature against `"TX" || txnBytes` under the participant pubkey, so
// fabricated byte-fill signatures no longer pass.

const keyPairOf = (byte: number): nacl.SignKeyPair =>
    nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(byte))

const KP_1 = keyPairOf(0x01)
const KP_2 = keyPairOf(0x02)
const KP_3 = keyPairOf(0x03)

const addrOf = (kp: nacl.SignKeyPair): string =>
    new Address(kp.publicKey).toString()

const ADDR_1 = addrOf(KP_1)
const ADDR_2 = addrOf(KP_2)
const ADDR_3 = addrOf(KP_3)

const toBase64 = (bytes: Uint8Array): string => {
    let s = ''
    for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s)
}

const TX_PREFIX = new Uint8Array([0x54, 0x58]) // "TX"

/** Signs `"TX" || txBytes` — what a real participant produces. */
const signTx = (kp: nacl.SignKeyPair, txBytes: Uint8Array): string => {
    const prefixed = new Uint8Array(TX_PREFIX.length + txBytes.length)
    prefixed.set(TX_PREFIX, 0)
    prefixed.set(txBytes, TX_PREFIX.length)
    return toBase64(nacl.sign.detached(prefixed, kp.secretKey))
}

// A minimal valid msgpack object — a 1-entry map { "x": 1 } — so the
// assembler has something concrete to embed as the "txn" value.
const FAKE_TX_BYTES = new Uint8Array([
    0x81, // fixmap, 1 entry
    0xa1, // fixstr, len 1
    0x78, // "x"
    0x01, // positive fixint, value 1
])
const FAKE_TX_B64 = toBase64(FAKE_TX_BYTES)

// A second, different transaction — { "y": 2 }.
const OTHER_TX_BYTES = new Uint8Array([0x81, 0xa1, 0x79, 0x02])
const OTHER_TX_B64 = toBase64(OTHER_TX_BYTES)

const SIG_1 = signTx(KP_1, FAKE_TX_BYTES)
const SIG_2 = signTx(KP_2, FAKE_TX_BYTES)
const ZERO_SIG = toBase64(new Uint8Array(64))

const buildResponse = (
    address: string,
    response: 'signed' | 'declined',
    signatures?: (string | null)[],
): ParticipantResponse => ({ address, response, signatures })

describe('assembleSignedMultisigTransactions', () => {
    test('yields to the event loop while verifying a group larger than one batch', async () => {
        // Identical transaction bytes repeated, so one real signature per
        // participant stays valid for every index. The budget is spent per
        // verify — one per signing participant per transaction — so this is the
        // smallest group that outgrows a single turn. Deliberately fewer than
        // VERIFY_BATCH_SIZE transactions: a per-transaction budget would never
        // yield here.
        const SIGNER_COUNT = 2
        const TX_COUNT = Math.floor(VERIFY_BATCH_SIZE / SIGNER_COUNT) + 1
        // A macrotask queued before the call: microtasks alone can never let it
        // run first, so observing it mid-flight proves the loop yielded rather
        // than blocking the thread for the whole group.
        let macrotaskRan = false
        setTimeout(() => {
            macrotaskRan = true
        }, 0)

        const result = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: Array(TX_COUNT).fill(FAKE_TX_B64),
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 2,
            responses: [
                buildResponse(ADDR_1, 'signed', Array(TX_COUNT).fill(SIG_1)),
                buildResponse(ADDR_2, 'signed', Array(TX_COUNT).fill(SIG_2)),
            ],
        })

        expect(macrotaskRan).toBe(true)
        expect(result.kind).toBe('success')
        if (result.kind !== 'success') return
        expect(result.signedTransactionsBytes).toHaveLength(TX_COUNT)
    })

    test('produces valid msgpack with msig (subsig/thr/v) and embedded txn', async () => {
        const result = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64],
            participantAddresses: [ADDR_1, ADDR_2, ADDR_3],
            version: 1,
            threshold: 2,
            responses: [
                buildResponse(ADDR_1, 'signed', [SIG_1]),
                buildResponse(ADDR_2, 'signed', [SIG_2]),
                buildResponse(ADDR_3, 'declined'),
            ],
        })

        expect(result.kind).toBe('success')
        if (result.kind !== 'success') return
        expect(result.signedTransactionsBytes).toHaveLength(1)

        const decoded = decodeMsgpack(
            result.signedTransactionsBytes[0],
        ) as Record<string, unknown>

        expect(Object.keys(decoded).sort()).toEqual(['msig', 'txn'])

        const msig = decoded.msig as Record<string, unknown>
        expect(Number(msig.v)).toBe(1)
        expect(Number(msig.thr)).toBe(2)
        const subsigs = msig.subsig as Array<{
            pk: Uint8Array
            s?: Uint8Array
        }>
        expect(subsigs).toHaveLength(3)
        // Order matches participantAddresses
        expect(subsigs[0].s).toBeDefined()
        expect(subsigs[1].s).toBeDefined()
        // ADDR_3 declined → no signature
        expect(subsigs[2].s).toBeUndefined()
        // Each subsig.pk is the corresponding 32-byte public key
        expect(subsigs[0].pk.length).toBe(32)
        expect(Array.from(subsigs[0].pk)).toEqual(Array.from(KP_1.publicKey))
        expect(Array.from(subsigs[1].pk)).toEqual(Array.from(KP_2.publicKey))
        expect(Array.from(subsigs[2].pk)).toEqual(Array.from(KP_3.publicKey))
    })

    test('embeds raw transaction bytes verbatim (no decode + re-encode)', async () => {
        const result = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 1,
            responses: [buildResponse(ADDR_1, 'signed', [SIG_1])],
        })

        if (result.kind !== 'success') throw new Error('expected success')
        const decoded = decodeMsgpack(
            result.signedTransactionsBytes[0],
        ) as Record<string, unknown>
        // The inner txn map was `{ "x": 1 }` — survives roundtrip. msgpack
        // ints decode to bigint.
        expect(decoded.txn).toEqual({ x: 1n })
    })

    test('rejects a signature paired with transaction bytes the participant never signed', async () => {
        // The swapped-transaction attack: SIG_1 is a real signature over
        // FAKE_TX_BYTES, but the backend supplies different raw bytes.
        const result = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: [OTHER_TX_B64],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 1,
            responses: [buildResponse(ADDR_1, 'signed', [SIG_1])],
        })

        expect(result.kind).toBe('error')
        if (result.kind === 'error') {
            expect(result.reason).toMatch(/failed verification/i)
        }
    })

    test('rejects a well-formed signature from the wrong key', async () => {
        // KP_2 signed the right bytes, but the backend attributes the
        // signature to ADDR_1.
        const result = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 1,
            responses: [buildResponse(ADDR_1, 'signed', [SIG_2])],
        })

        expect(result.kind).toBe('error')
        if (result.kind === 'error') {
            expect(result.reason).toMatch(/failed verification/i)
        }
    })

    test('rejects a signature from an address outside the participant set', async () => {
        const outsider = keyPairOf(0x42)
        const result = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 1,
            responses: [
                buildResponse(addrOf(outsider), 'signed', [
                    signTx(outsider, FAKE_TX_BYTES),
                ]),
            ],
        })

        expect(result.kind).toBe('error')
        if (result.kind === 'error') {
            expect(result.reason).toMatch(/non-participant/i)
        }
    })

    test('reports insufficient-signatures when threshold is not met', async () => {
        const result = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64],
            participantAddresses: [ADDR_1, ADDR_2, ADDR_3],
            version: 1,
            threshold: 3,
            responses: [
                buildResponse(ADDR_1, 'signed', [SIG_1]),
                buildResponse(ADDR_2, 'signed', [SIG_2]),
                buildResponse(ADDR_3, 'declined'),
            ],
        })

        expect(result).toEqual({
            kind: 'insufficient-signatures',
            txIndex: 0,
            validCount: 2,
            threshold: 3,
        })
    })

    test('treats all-zero signatures as missing (sanity filter)', async () => {
        const result = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 2,
            responses: [
                buildResponse(ADDR_1, 'signed', [SIG_1]),
                buildResponse(ADDR_2, 'signed', [ZERO_SIG]),
            ],
        })

        expect(result).toEqual({
            kind: 'insufficient-signatures',
            txIndex: 0,
            validCount: 1,
            threshold: 2,
        })
    })

    test('treats null per-txn signatures as missing', async () => {
        const result = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64, FAKE_TX_B64],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 2,
            responses: [
                buildResponse(ADDR_1, 'signed', [SIG_1, SIG_1]),
                buildResponse(ADDR_2, 'signed', [SIG_2, null]),
            ],
        })

        // Second transaction has only 1 of 2 signatures.
        expect(result).toEqual({
            kind: 'insufficient-signatures',
            txIndex: 1,
            validCount: 1,
            threshold: 2,
        })
    })

    test('assembles despite a null entry when the index still meets threshold', async () => {
        // A null is a legitimate final state ("didn't sign this index"), not
        // only a mid-write artifact — it must not block assembly at threshold.
        const result = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64, FAKE_TX_B64],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 1,
            responses: [
                buildResponse(ADDR_1, 'signed', [SIG_1, null]),
                buildResponse(ADDR_2, 'signed', [null, SIG_2]),
            ],
        })

        expect(result.kind).toBe('success')
        if (result.kind !== 'success') return
        expect(result.signedTransactionsBytes).toHaveLength(2)
    })

    test('treats a signatures array shorter than the transaction list as missing entries', async () => {
        // Mid-write poll race: the backend serialized only the first entry.
        const result = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64, FAKE_TX_B64],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 1,
            responses: [buildResponse(ADDR_1, 'signed', [SIG_1])],
        })

        expect(result).toEqual({
            kind: 'insufficient-signatures',
            txIndex: 1,
            validCount: 0,
            threshold: 1,
        })
    })

    test('treats malformed base64 signatures as missing', async () => {
        const result = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 2,
            responses: [
                buildResponse(ADDR_1, 'signed', [SIG_1]),
                buildResponse(ADDR_2, 'signed', ['@@@']),
            ],
        })

        expect(result).toEqual({
            kind: 'insufficient-signatures',
            txIndex: 0,
            validCount: 1,
            threshold: 2,
        })
    })

    test('rejects invalid base64 raw transaction', async () => {
        const result = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: ['@@@'],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 1,
            responses: [buildResponse(ADDR_1, 'signed', [SIG_1])],
        })

        expect(result.kind).toBe('error')
        if (result.kind === 'error') {
            expect(result.reason).toMatch(/invalid base64 raw transaction/i)
        }
    })

    test('rejects an oversized raw transaction (defence-in-depth byte cap)', async () => {
        const result = await assembleSignedMultisigTransactions({
            // ~128 KB of base64 → ~96 KB decoded, over the 64 KB cap.
            rawTransactionsBase64: ['A'.repeat(128 * 1024)],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 1,
            responses: [buildResponse(ADDR_1, 'signed', [SIG_1])],
        })

        expect(result.kind).toBe('error')
        if (result.kind === 'error') {
            expect(result.reason).toMatch(/invalid base64 raw transaction/i)
        }
    })

    test('produces empty list for empty input', async () => {
        const result = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: [],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 1,
            responses: [],
        })

        expect(result).toEqual({ kind: 'success', signedTransactionsBytes: [] })
    })

    test('rejects invalid participant addresses', async () => {
        const result = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64],
            participantAddresses: ['INVALID_ADDRESS'],
            version: 1,
            threshold: 1,
            responses: [buildResponse('INVALID_ADDRESS', 'signed', [SIG_1])],
        })

        expect(result.kind).toBe('error')
        if (result.kind === 'error') {
            expect(result.reason).toMatch(/public keys/i)
        }
    })

    test('rejects invalid threshold (0 or > participants)', async () => {
        const result = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 0,
            responses: [],
        })
        expect(result.kind).toBe('error')

        const result2 = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 3,
            responses: [],
        })
        expect(result2.kind).toBe('error')
    })

    // A real transaction carries its sender in the `snd` field. These build a
    // minimal msgpack txn { snd: <32-byte pubkey> } so the assembler can detect
    // whether the sender differs from the multisig (auth) address.
    const txWithSender = (senderPublicKey: Uint8Array): Uint8Array =>
        encodeMsgpack({ snd: senderPublicKey })

    const KP_REKEYED = keyPairOf(0x09)

    test('writes a sgnr field (the multisig auth address) when the sender is rekeyed to the multisig', async () => {
        // Sender (a rekeyed account) differs from the signing multisig address,
        // so the signed txn must carry sgnr = the multisig address pubkey.
        const txBytes = txWithSender(KP_REKEYED.publicKey)
        const txB64 = toBase64(txBytes)

        const result = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: [txB64],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 2,
            multisigAddress: ADDR_3,
            responses: [
                buildResponse(ADDR_1, 'signed', [signTx(KP_1, txBytes)]),
                buildResponse(ADDR_2, 'signed', [signTx(KP_2, txBytes)]),
            ],
        })

        expect(result.kind).toBe('success')
        if (result.kind !== 'success') return
        const decoded = decodeMsgpack(
            result.signedTransactionsBytes[0],
        ) as Record<string, unknown>

        expect(Object.keys(decoded).sort()).toEqual(['msig', 'sgnr', 'txn'])
        expect(Array.from(decoded.sgnr as Uint8Array)).toEqual(
            Array.from(KP_3.publicKey),
        )
    })

    test('omits sgnr when the sender equals the multisig address (not rekeyed)', async () => {
        // Sender IS the multisig — a normal multisig spend, no auth indirection.
        const txBytes = txWithSender(KP_3.publicKey)
        const txB64 = toBase64(txBytes)

        const result = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: [txB64],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 2,
            multisigAddress: ADDR_3,
            responses: [
                buildResponse(ADDR_1, 'signed', [signTx(KP_1, txBytes)]),
                buildResponse(ADDR_2, 'signed', [signTx(KP_2, txBytes)]),
            ],
        })

        expect(result.kind).toBe('success')
        if (result.kind !== 'success') return
        const decoded = decodeMsgpack(
            result.signedTransactionsBytes[0],
        ) as Record<string, unknown>
        expect(Object.keys(decoded).sort()).toEqual(['msig', 'txn'])
    })

    test('handles multi-transaction lists (each tx gets its own signed bytes)', async () => {
        const sig1ForOther = signTx(KP_1, OTHER_TX_BYTES)
        const sig2ForOther = signTx(KP_2, OTHER_TX_BYTES)
        const result = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64, OTHER_TX_B64],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 2,
            responses: [
                buildResponse(ADDR_1, 'signed', [SIG_1, sig1ForOther]),
                buildResponse(ADDR_2, 'signed', [SIG_2, sig2ForOther]),
            ],
        })

        expect(result.kind).toBe('success')
        if (result.kind !== 'success') return
        expect(result.signedTransactionsBytes).toHaveLength(2)
    })
})
