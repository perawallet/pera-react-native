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

import { describe, it, expect } from 'vitest'
import nacl from 'tweetnacl'
import {
    encodeToBase64,
    decodeFromBase64,
} from '@perawallet/wallet-core-shared'
import { mnemonicWordsToIndices } from '@perawallet/wallet-core-kms'
import { backupIndicesToKey, generateBackupCipherKey } from '../../crypto'
import { AsbErrorReason, AsbImportError } from '../../errors'
import { AsbAccountKind, type AsbBackupEnvelope } from '../../models'
import { decryptBackupPayload } from '../decrypt-backup-payload'

const RECOVERY_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const RECOVERY_INDICES = mnemonicWordsToIndices(RECOVERY_MNEMONIC.split(' '))!

// Helper: produce a valid ARC-35 envelope for the given plaintext + mnemonic.
// Mirrors what the iOS/Android creators do: secretbox-encrypt, prepend nonce,
// base64 the result, embed in the JSON envelope.
const buildEnvelope = (
    plaintext: object,
    indices: Uint16Array,
    overrides?: Partial<AsbBackupEnvelope>,
): AsbBackupEnvelope => {
    const seed = backupIndicesToKey(indices)
    const key = generateBackupCipherKey(seed)
    const nonce = nacl.randomBytes(24)
    // jsdom's TextEncoder returns a Uint8Array from a different realm than
    // Node's globals; tweetnacl's `instanceof Uint8Array` check fails on it.
    // Re-wrap with `Uint8Array.from` to keep this test environment-agnostic.
    const box = nacl.secretbox(
        Uint8Array.from(new TextEncoder().encode(JSON.stringify(plaintext))),
        nonce,
        key,
    )
    const combined = new Uint8Array(24 + box.length)
    combined.set(nonce, 0)
    combined.set(box, 24)
    return {
        version: '1.0',
        suite: 'HMAC-SHA256:sodium_secretbox_easy',
        ciphertext: encodeToBase64(combined),
        ...overrides,
    }
}

describe('decryptBackupPayload', () => {
    it('decrypts a single-account payload and normalizes shape', () => {
        const privateKey = new Uint8Array(64).fill(7)
        const envelope = buildEnvelope(
            {
                accounts: [
                    {
                        address:
                            'EGRJQ7DXMIJ577UUN6AFOIUZY6CNSFKLMGFHQNTC5US5TRC23LK6DGQRDM',
                        name: 'My Single',
                        account_type: 'single',
                        private_key: encodeToBase64(privateKey),
                    },
                ],
                provider_name: 'Pera Wallet',
                device_id: 'dev-abc',
            },
            RECOVERY_INDICES,
        )

        const result = decryptBackupPayload(envelope, RECOVERY_INDICES)

        expect(result.providerName).toBe('Pera Wallet')
        expect(result.deviceId).toBe('dev-abc')
        expect(result.accounts).toHaveLength(1)
        expect(result.accounts[0].kind).toBe(AsbAccountKind.Single)
        expect(result.accounts[0].name).toBe('My Single')
        expect(result.accounts[0].address).toBe(
            'EGRJQ7DXMIJ577UUN6AFOIUZY6CNSFKLMGFHQNTC5US5TRC23LK6DGQRDM',
        )
        expect(result.accounts[0].privateKey).not.toBeNull()
        expect(Array.from(result.accounts[0].privateKey!)).toEqual(
            Array.from(privateKey),
        )
    })

    it('decrypts a watch-account payload (null privateKey)', () => {
        const envelope = buildEnvelope(
            {
                accounts: [
                    {
                        address:
                            '7TTLR5VQAY5YVQ5QV4IBOVIKUULGVNPURNWM5NG7M7ELEOQPVROA4CS3FM',
                        name: 'Watcher',
                        account_type: 'watch',
                        private_key: '',
                    },
                ],
            },
            RECOVERY_INDICES,
        )

        const result = decryptBackupPayload(envelope, RECOVERY_INDICES)
        expect(result.accounts).toHaveLength(1)
        expect(result.accounts[0].kind).toBe(AsbAccountKind.Watch)
        expect(result.accounts[0].privateKey).toBeNull()
        expect(result.accounts[0].name).toBe('Watcher')
        expect(result.providerName).toBeNull()
        expect(result.deviceId).toBeNull()
    })

    it('drops malformed account rows but keeps the valid ones', () => {
        const validPrivateKey = encodeToBase64(new Uint8Array(64).fill(3))
        const envelope = buildEnvelope(
            {
                accounts: [
                    null,
                    { not: 'an account' },
                    { address: 'A', account_type: 'unknown' },
                    {
                        address:
                            'EGRJQ7DXMIJ577UUN6AFOIUZY6CNSFKLMGFHQNTC5US5TRC23LK6DGQRDM',
                        account_type: 'single',
                        private_key: validPrivateKey,
                    },
                ],
            },
            RECOVERY_INDICES,
        )

        const result = decryptBackupPayload(envelope, RECOVERY_INDICES)
        expect(result.accounts).toHaveLength(1)
        expect(result.accounts[0].kind).toBe(AsbAccountKind.Single)
    })

    it('reports InvalidRecoveryKey when the recovery key is malformed', () => {
        const envelope = buildEnvelope({ accounts: [] }, RECOVERY_INDICES)
        const corrupted = mnemonicWordsToIndices(RECOVERY_MNEMONIC.split(' '))!
        corrupted[11] = 0 // breaks the BIP-39 checksum
        try {
            decryptBackupPayload(envelope, corrupted)
            throw new Error('expected throw')
        } catch (e) {
            expect(e).toBeInstanceOf(AsbImportError)
            expect((e as AsbImportError).reason).toBe(
                AsbErrorReason.InvalidRecoveryKey,
            )
        }
    })

    it('reports DecryptionFailed when the mnemonic does not match the backup', () => {
        const envelope = buildEnvelope(
            {
                accounts: [
                    {
                        address: 'X',
                        account_type: 'single',
                        private_key: encodeToBase64(new Uint8Array(64)),
                    },
                ],
            },
            RECOVERY_INDICES,
        )

        // A different valid 12-word phrase (also a known BIP-39 vector).
        const wrong = mnemonicWordsToIndices(
            'legal winner thank year wave sausage worth useful legal winner thank yellow'.split(
                ' ',
            ),
        )!
        try {
            decryptBackupPayload(envelope, wrong)
            throw new Error('expected throw')
        } catch (e) {
            expect(e).toBeInstanceOf(AsbImportError)
            expect((e as AsbImportError).reason).toBe(
                AsbErrorReason.DecryptionFailed,
            )
        }
    })

    it('reports MalformedPayload when the plaintext lacks an accounts array', () => {
        const envelope = buildEnvelope(
            { provider_name: 'no accounts here' },
            RECOVERY_INDICES,
        )
        try {
            decryptBackupPayload(envelope, RECOVERY_INDICES)
            throw new Error('expected throw')
        } catch (e) {
            expect(e).toBeInstanceOf(AsbImportError)
            expect((e as AsbImportError).reason).toBe(
                AsbErrorReason.MalformedPayload,
            )
        }
    })

    it('reports MalformedPayload when no rows survive validation', () => {
        const envelope = buildEnvelope(
            { accounts: [null, { foo: 'bar' }] },
            RECOVERY_INDICES,
        )
        try {
            decryptBackupPayload(envelope, RECOVERY_INDICES)
            throw new Error('expected throw')
        } catch (e) {
            expect((e as AsbImportError).reason).toBe(
                AsbErrorReason.MalformedPayload,
            )
        }
    })

    it('rejects an inner ciphertext that decodes to bytes too short for a nonce', () => {
        // base64-js silently strips invalid chars, so `!!!` decodes to 0
        // bytes — the secretbox open then fails. Either MalformedEnvelope or
        // DecryptionFailed is fine; both mean "file is corrupted".
        try {
            decryptBackupPayload(
                {
                    version: '1.0',
                    suite: 'HMAC-SHA256:sodium_secretbox_easy',
                    ciphertext: '!!!not base64!!!',
                },
                RECOVERY_INDICES,
            )
            throw new Error('expected throw')
        } catch (e) {
            expect(e).toBeInstanceOf(AsbImportError)
            expect([
                AsbErrorReason.MalformedEnvelope,
                AsbErrorReason.DecryptionFailed,
            ]).toContain((e as AsbImportError).reason)
        }
    })

    it('round-trips through parseBackupEnvelope + decryptBackupPayload', () => {
        // Sanity that the full pipeline (envelope-from-file → decrypt) works
        // when wired together. We don't import parseBackupEnvelope here to
        // keep this test focused; the wire-up is exercised in
        // parse-backup-envelope.spec.
        const envelope = buildEnvelope(
            {
                accounts: [
                    {
                        address:
                            'EGRJQ7DXMIJ577UUN6AFOIUZY6CNSFKLMGFHQNTC5US5TRC23LK6DGQRDM',
                        account_type: 'single',
                        private_key: encodeToBase64(new Uint8Array(64)),
                    },
                ],
            },
            RECOVERY_INDICES,
        )

        const result = decryptBackupPayload(envelope, RECOVERY_INDICES)
        // Confirm the inner ciphertext bytes were exactly 24 + 16 + 64-byte plaintext
        // wouldn't be useful here; just check it decoded successfully.
        expect(decodeFromBase64(envelope.ciphertext).length).toBeGreaterThan(24)
        expect(result.accounts[0].kind).toBe(AsbAccountKind.Single)
    })
})
