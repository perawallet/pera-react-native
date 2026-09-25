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

// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { base64 } from '@scure/base'
import { isPasskeyCredentialType } from '../passkeyCredentialTypes'
import {
    liftCredentialMetadata,
    splitProviderCredential,
    type FlatProviderCredential,
} from '../splitProviderCredential'

const PUBLIC_KEY = new Uint8Array(4).fill(4)
const PRIVATE_KEY = new Uint8Array(32).fill(3)
const IV = 'AAAAAAAAAAAAAAAA'

const flat = (
    overrides: Partial<FlatProviderCredential> = {},
): FlatProviderCredential => ({
    id: 'cred-1',
    type: 'hd-derived-p256',
    algorithm: 'P256',
    extractable: false,
    keyUsages: ['sign'],
    name: 'Passkey: https://webauthn.io',
    publicKey: PUBLIC_KEY,
    privateKey: PRIVATE_KEY,
    metadata: {
        origin: 'https://webauthn.io',
        userHandle: 'alice',
        userId: 'dXNlcg',
        count: 0,
    },
    ...overrides,
})

describe('isPasskeyCredentialType', () => {
    it('accepts both provider spellings and nothing else', () => {
        expect(isPasskeyCredentialType('hd-derived-p256')).toBe(true)
        expect(isPasskeyCredentialType('xhd-derived-p256')).toBe(true)
        expect(isPasskeyCredentialType('hd-root-key')).toBe(false)
        expect(isPasskeyCredentialType(undefined)).toBe(false)
    })
})

describe('splitProviderCredential', () => {
    it('keeps a plain private key out of the metadata record and returns it as material', () => {
        const split = splitProviderCredential('cred-1', flat())!

        expect(split.material).toBe(PRIVATE_KEY)
        expect(split.record).toEqual({
            id: 'cred-1',
            type: 'hd-derived-p256',
            algorithm: 'P256',
            extractable: false,
            keyUsages: ['sign'],
            name: 'Passkey: https://webauthn.io',
            publicKey: PUBLIC_KEY,
            metadata: {
                origin: 'https://webauthn.io',
                userHandle: 'alice',
                userId: 'dXNlcg',
                count: 0,
            },
        })
        expect('privateKey' in split.record).toBe(false)
    })

    it('seals the biometric ciphertext and keeps only the IV in plaintext', () => {
        const ciphertext = new Uint8Array(48).fill(9)
        const split = splitProviderCredential(
            'cred-1',
            flat({
                privateKey: undefined,
                privateKeyEnc: { iv: IV, data: base64.encode(ciphertext) },
            }),
        )!

        expect(split.material).toEqual(ciphertext)
        expect(split.record.privateKeyEnc).toEqual({ iv: IV })
    })

    it('keeps the legacy xhd type as found', () => {
        const split = splitProviderCredential(
            'cred-1',
            flat({ type: 'xhd-derived-p256' }),
        )!

        expect(split.record.type).toBe('xhd-derived-p256')
    })

    it('lifts top-level fields from older shapes into metadata, letting metadata win', () => {
        const split = splitProviderCredential(
            'cred-1',
            flat({
                origin: 'https://old.example',
                userHandle: 'bob',
                count: 4,
                metadata: { userHandle: 'alice' },
            }),
        )!

        expect(split.record.metadata).toEqual({
            userHandle: 'alice',
            origin: 'https://old.example',
            count: 4,
        })
        expect('origin' in split.record).toBe(false)
    })

    it('refuses a record the provider could never list', () => {
        expect(
            splitProviderCredential(
                'cred-1',
                flat({ metadata: { userHandle: 'alice' } }),
            ),
        ).toBeUndefined()
        expect(
            splitProviderCredential(
                'cred-1',
                flat({ publicKey: new Uint8Array(0) }),
            ),
        ).toBeUndefined()
        expect(
            splitProviderCredential('cred-1', flat({ type: 'hd-root-key' })),
        ).toBeUndefined()
    })

    // The wrapped key is the only copy of this credential's private key, so a
    // shape the provider would not accept must stay flat, not split empty.
    it('keeps a malformed biometric-wrapped key flat', () => {
        expect(
            splitProviderCredential(
                'cred-1',
                flat({ privateKey: undefined, privateKeyEnc: { iv: 7 } }),
            ),
        ).toBeUndefined()
    })

    it('writes a material-less credential as metadata only', () => {
        const split = splitProviderCredential(
            'cred-1',
            flat({ privateKey: undefined }),
        )!

        expect(split.material).toBeUndefined()
    })

    it('takes the id from the storage key', () => {
        const split = splitProviderCredential(
            'cred-1',
            flat({ id: undefined }),
        )!

        expect(split.record.id).toBe('cred-1')
    })

    // A seed, an unplaceable privateKey, or a secret-named field buried
    // elsewhere in the record would all be lost or leaked once the flat
    // record is deleted — each must refuse the split instead.
    it('keeps a record carrying a seed field flat', () => {
        expect(
            splitProviderCredential(
                'cred-1',
                flat({ seed: new Uint8Array(32).fill(1) }),
            ),
        ).toBeUndefined()
    })

    it('keeps a record whose privateKey is not bytes flat', () => {
        expect(
            splitProviderCredential(
                'cred-1',
                flat({ privateKey: '03'.repeat(32) as unknown as Uint8Array }),
            ),
        ).toBeUndefined()
    })

    it('keeps a record with a nested rootKey.privateKey flat', () => {
        expect(
            splitProviderCredential(
                'cred-1',
                flat({
                    metadata: {
                        origin: 'https://webauthn.io',
                        userHandle: 'alice',
                        rootKey: { privateKey: new Uint8Array(32).fill(2) },
                    },
                }),
            ),
        ).toBeUndefined()
    })

    it('keeps a record with a top-level key field flat', () => {
        expect(
            splitProviderCredential(
                'cred-1',
                flat({ key: new Uint8Array(32).fill(2) }),
            ),
        ).toBeUndefined()
    })

    // `decode` turns a number array under any `*Key` name into bytes, so a
    // field name says nothing about whether it is secret.
    it('keeps a record with bytes under metadata.rootKey flat', () => {
        expect(
            splitProviderCredential(
                'cred-1',
                flat({
                    metadata: {
                        origin: 'https://webauthn.io',
                        userHandle: 'alice',
                        rootKey: new Uint8Array(32).fill(2),
                    },
                }),
            ),
        ).toBeUndefined()
    })

    it('keeps a record with a top-level masterKey flat', () => {
        expect(
            splitProviderCredential(
                'cred-1',
                flat({ masterKey: new Uint8Array(32).fill(2) }),
            ),
        ).toBeUndefined()
    })

    it('allows bytes only in the top-level publicKey, not in a nested one', () => {
        expect(
            splitProviderCredential(
                'cred-1',
                flat({
                    metadata: {
                        origin: 'https://webauthn.io',
                        userHandle: 'alice',
                        publicKey: new Uint8Array(4).fill(4),
                    },
                }),
            ),
        ).toBeUndefined()
    })
})

describe('liftCredentialMetadata', () => {
    it('returns the same record when nothing sits at the top level', () => {
        const record = { id: 'x', metadata: { origin: 'https://a.example' } }

        expect(liftCredentialMetadata(record)).toBe(record)
    })
})
