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

import { describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import type { Key } from '@algorandfoundation/keystore-core'

// Same technique as `derivePasskeyCredential.spec.ts`: the real native module
// has no loadable build here, and every test below passes `subtle` explicitly.
vi.mock('react-native-quick-crypto', () => ({ subtle: {} }))

import {
    derivePasskeyCredential,
    derivePasskeyMainKey,
} from '../../crypto/derivePasskeyCredential'
import {
    identityCandidates,
    passkeyBackupInputs,
    seedKeyIdFromPasskeyMainKeyId,
} from '../passkeyBackup'

const subtle = webcrypto.subtle as unknown as SubtleCrypto
const ENTROPY = new Uint8Array(32).fill(7)
const SEED_KEY_ID = 'seed-1'
const MAIN_KEY_ID = `${SEED_KEY_ID}-passkey-main`

const resolveEntropy = async (seedKeyId: string) =>
    seedKeyId === SEED_KEY_ID ? ENTROPY : null

const buildKey = (metadata: Record<string, unknown>): Key =>
    ({
        id: 'credential-id',
        type: 'hd-derived-p256',
        algorithm: 'P256',
        extractable: false,
        metadata,
    }) as unknown as Key

/** Builds a key whose stored public key really is the one `identity` derives. */
const buildReproducibleKey = async (
    identity: string,
    extraMetadata: Record<string, unknown> = {},
): Promise<Key> => {
    const mainKey = await derivePasskeyMainKey(ENTROPY, subtle)
    const derived = await derivePasskeyCredential({
        mainKey,
        origin: 'webauthn.io',
        identity,
    })
    return {
        id: derived.credentialId,
        type: 'hd-derived-p256',
        algorithm: 'P256',
        extractable: false,
        publicKey: derived.publicKeySpkiDer,
        metadata: {
            origin: 'webauthn.io',
            parentKeyId: MAIN_KEY_ID,
            count: 0,
            createdAt: 1_700_000_000_000,
            ...extraMetadata,
        },
    } as unknown as Key
}

describe('seedKeyIdFromPasskeyMainKeyId', () => {
    it('recovers the owning seed from a main key id', () => {
        expect(seedKeyIdFromPasskeyMainKeyId(MAIN_KEY_ID)).toBe(SEED_KEY_ID)
    })

    it('returns null for an id that is not a passkey main key', () => {
        expect(seedKeyIdFromPasskeyMainKeyId('seed-1')).toBeNull()
    })
})

describe('identityCandidates', () => {
    it('offers the lowercased user handle, user name and user id', () => {
        const candidates = identityCandidates({
            userHandle: 'QUJD',
            userName: 'Alice@Example.com',
            userId: 'VXNlcklk',
        })

        expect(candidates).toContain('abc')
        expect(candidates).toContain('alice@example.com')
        expect(candidates).toContain('userid')
    })

    it('deduplicates and drops empty values', () => {
        const candidates = identityCandidates({
            userHandle: 'alice',
            userName: 'alice',
            userId: '',
        })

        expect(candidates).toEqual(['alice'])
    })
})

describe('passkeyBackupInputs', () => {
    it('returns the identity that reproduced the stored public key', async () => {
        const key = await buildReproducibleKey('alice', { userName: 'alice' })

        const inputs = await passkeyBackupInputs(key, resolveEntropy, subtle)

        expect(inputs).not.toBeNull()
        expect(inputs?.identity).toBe('alice')
        expect(inputs?.origin).toBe('webauthn.io')
        expect(inputs?.seedKeyId).toBe(SEED_KEY_ID)
        expect(inputs?.counter).toBe(0)
    })

    it('picks the user-handle candidate when that is what derived the key', async () => {
        const key = await buildReproducibleKey('handle-value', {
            userHandle: 'handle-value',
            userName: 'a-different-name',
        })

        const inputs = await passkeyBackupInputs(key, resolveEntropy, subtle)

        expect(inputs?.identity).toBe('handle-value')
    })

    it('returns null when no candidate reproduces the stored public key', async () => {
        const key = await buildReproducibleKey('alice')
        const tampered = {
            ...key,
            publicKey: new Uint8Array(91).fill(1),
        } as unknown as Key

        expect(
            await passkeyBackupInputs(tampered, resolveEntropy, subtle),
        ).toBeNull()
    })

    it('returns null when the credential has no parent key id', async () => {
        const key = buildKey({ origin: 'webauthn.io', userName: 'alice' })

        expect(
            await passkeyBackupInputs(key, resolveEntropy, subtle),
        ).toBeNull()
    })

    it('returns null when the parent is not a passkey main key', async () => {
        const key = buildKey({
            origin: 'webauthn.io',
            userName: 'alice',
            parentKeyId: 'some-other-root',
        })

        expect(
            await passkeyBackupInputs(key, resolveEntropy, subtle),
        ).toBeNull()
    })

    it('returns null when the owning seed is unavailable', async () => {
        const key = await buildReproducibleKey('alice')

        expect(
            await passkeyBackupInputs(key, async () => null, subtle),
        ).toBeNull()
    })

    it('returns null for a migration-flagged credential', async () => {
        const key = await buildReproducibleKey('alice', {
            migration: 'needs-migration',
        })

        expect(
            await passkeyBackupInputs(key, resolveEntropy, subtle),
        ).toBeNull()
    })

    it('returns null for a legacy xhd-derived credential', async () => {
        const key = await buildReproducibleKey('alice')
        const legacy = { ...key, type: 'xhd-derived-p256' } as unknown as Key

        expect(
            await passkeyBackupInputs(legacy, resolveEntropy, subtle),
        ).toBeNull()
    })
})
