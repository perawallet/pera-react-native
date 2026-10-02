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
import { encodeToBase64 } from '@perawallet/wallet-core-shared'

// Same technique as `derivePasskeyCredential.spec.ts`: the provider has no
// loadable build here, and every test below passes `subtle` explicitly.
vi.mock('@perawallet/wallet-extension-provider', () => ({ keystoreSubtle: {} }))

// `@perawallet/wallet-core-kms`'s single-file bundle unconditionally pulls in
// `@perawallet/wallet-extension-provider` -> `react-native-mmkv`, which also
// has no loadable build outside a device runtime. `zeroBytes` itself is a
// trivial `fill(0)`, so it's reimplemented rather than imported for real.
vi.mock('@perawallet/wallet-core-kms', () => ({
    handOffSecret: <T>(secret: T): T => secret,
    zeroBytes: (
        ...buffers: Array<Uint8Array | Uint16Array | null | undefined>
    ) => {
        for (const buf of buffers) buf?.fill(0)
    },
}))

// Spied, not replaced, so a test can inspect the main key a call derived.
vi.mock('../../crypto/derivePasskeyCredential', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('../../crypto/derivePasskeyCredential')
        >()
    return {
        ...actual,
        derivePasskeyMainKey: vi.fn(actual.derivePasskeyMainKey),
    }
})

import { toDerivationUserHandle } from '../../authenticator/authenticator'
import {
    derivePasskeyCredential,
    derivePasskeyMainKey,
    p256PrivateKeyToSpkiDer,
} from '../../crypto/derivePasskeyCredential'
import {
    identityCandidates,
    passkeyBackupInputs,
    seedKeyIdFromPasskeyMainKeyId,
    storedPasskeyBackupInputs,
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
    counter = 0,
): Promise<Key> => {
    const mainKey = await derivePasskeyMainKey(ENTROPY, subtle)
    const derived = await derivePasskeyCredential({
        mainKey,
        origin: 'webauthn.io',
        identity,
        counter,
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
            counter,
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

    it('returns null rather than an empty string for a bare suffix', () => {
        expect(seedKeyIdFromPasskeyMainKeyId('-passkey-main')).toBeNull()
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

    // The identity a restored record carries already proved the credential on
    // the collecting device. `userHandle` means different things on iOS and
    // Android, so it cannot be rebuilt from the other fields.
    it('tries a stored identity first and verbatim', () => {
        const candidates = identityCandidates({
            identity: 'iosRestore',
            userHandle: 'd2ViYXV0aG5pby1pb3NyZXN0b3Jl',
            userId: 'd2ViYXV0aG5pby1pb3NyZXN0b3Jl',
        })

        expect(candidates[0]).toBe('iosRestore')
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

    it('hands back the private key that reproduced the stored public key', async () => {
        const key = await buildReproducibleKey('alice', { userName: 'alice' })

        const inputs = await passkeyBackupInputs(key, resolveEntropy, subtle)

        expect(p256PrivateKeyToSpkiDer(inputs!.privateKey)).toEqual(
            key.publicKey,
        )
    })

    // IMPORTANT 6: iOS writes `createdAt` in seconds
    // (`CredentialProviderViewController.swift`'s
    // `Date().timeIntervalSince1970`), so the seconds branch of
    // `normalizeTimestamp` is the live one for a real iOS-written record.
    it('normalises a seconds-range createdAt to milliseconds', async () => {
        const key = await buildReproducibleKey('alice', {
            userName: 'alice',
            createdAt: 1_700_000_000,
        })

        const inputs = await passkeyBackupInputs(key, resolveEntropy, subtle)

        expect(inputs?.createdAt).toBe(1_700_000_000_000)
    })

    it('picks the user-handle candidate when that is what derived the key', async () => {
        const key = await buildReproducibleKey('handle-value', {
            userHandle: 'handle-value',
            userName: 'a-different-name',
        })

        const inputs = await passkeyBackupInputs(key, resolveEntropy, subtle)

        expect(inputs?.identity).toBe('handle-value')
    })

    // Regression for CRITICAL 1: `metadata.count` is the WebAuthn signature
    // counter (bumped on every assertion, never fed into derivation);
    // `metadata.counter` is the derivation counter. Reading the wrong one
    // means any passkey the user has signed in with at least once fails to
    // reproduce.
    it('reproduces a credential derived with a non-zero derivation counter', async () => {
        const key = await buildReproducibleKey(
            'alice',
            { userName: 'alice' },
            3,
        )

        const inputs = await passkeyBackupInputs(key, resolveEntropy, subtle)

        expect(inputs).not.toBeNull()
        expect(inputs?.counter).toBe(3)
    })

    // The other direction of CRITICAL 1: a credential the user has actually
    // signed in with carries a non-zero WebAuthn signature counter
    // (`metadata.count`) alongside a derivation counter (`metadata.counter`)
    // that's still 0. That signature counter must be ignored, not fed into
    // derivation.
    it('reproduces a credential that also carries a non-zero signature counter', async () => {
        const key = await buildReproducibleKey(
            'alice',
            { userName: 'alice', count: 7 },
            0,
        )

        const inputs = await passkeyBackupInputs(key, resolveEntropy, subtle)

        expect(inputs).not.toBeNull()
        expect(inputs?.counter).toBe(0)
    })

    // Regression for CRITICAL 2: `keystore-core`'s own domain-key derivation
    // (the extension's path) stores the raw 64-byte point (no `0x04`
    // prefix), not the 91-byte SPKI DER iOS and Android store. Comparing raw
    // bytes against SPKI DER always mismatches for these credentials.
    it('reproduces a credential whose stored public key is the raw 64-byte point', async () => {
        const mainKey = await derivePasskeyMainKey(ENTROPY, subtle)
        const derived = await derivePasskeyCredential({
            mainKey,
            origin: 'webauthn.io',
            identity: 'alice',
        })
        // Strip the 26-byte SPKI prefix and the 0x04 point-form indicator,
        // leaving the bare 64-byte X||Y point `deriveBits` produces.
        const rawPoint = derived.publicKeySpkiDer.slice(27)
        const key = {
            id: derived.credentialId,
            type: 'hd-derived-p256',
            algorithm: 'P256',
            extractable: false,
            publicKey: rawPoint,
            metadata: {
                origin: 'webauthn.io',
                parentKeyId: MAIN_KEY_ID,
                counter: 0,
                userName: 'alice',
                createdAt: 1_700_000_000_000,
            },
        } as unknown as Key

        const inputs = await passkeyBackupInputs(key, resolveEntropy, subtle)

        expect(inputs).not.toBeNull()
        expect(inputs?.identity).toBe('alice')
        // The payload always carries the derived 91-byte SPKI DER, never an
        // echo of the 64-byte form the record happened to store.
        expect(inputs?.publicKeySpkiDer).toBe(
            encodeToBase64(derived.publicKeySpkiDer),
        )
    })

    // Regression for CRITICAL 3: iOS derives from
    // `userHandleString = String(data:encoding:.utf8) ?? base64URLEncodedString()`
    // but stores standard base64. For a handle whose bytes are not valid
    // utf8, the derivation input is the base64url fallback — not the raw
    // base64 string and not a failed-and-abandoned utf8 decode.
    it('reproduces a credential whose user handle is not valid utf8, via the base64url fallback', async () => {
        const handleBytes = new Uint8Array([0xff, 0xfe, 0xfd, 0xfc])
        const identity = toDerivationUserHandle(handleBytes)
        const key = await buildReproducibleKey(identity, {
            userHandle: encodeToBase64(handleBytes),
        })

        const inputs = await passkeyBackupInputs(key, resolveEntropy, subtle)

        expect(inputs).not.toBeNull()
        expect(inputs?.identity).toBe(identity)
    })

    it('zeroes the main key it derives when no cache is given', async () => {
        const key = await buildReproducibleKey('alice')

        await passkeyBackupInputs(key, resolveEntropy, subtle)

        const mainKey: Uint8Array = await vi
            .mocked(derivePasskeyMainKey)
            .mock.results.at(-1)!.value
        expect(mainKey.every(byte => byte === 0)).toBe(true)
    })

    it('leaves a cached main key for the cache owner to zero', async () => {
        const key = await buildReproducibleKey('alice')
        const cache = new Map<string, Promise<Uint8Array | null>>()

        await passkeyBackupInputs(key, resolveEntropy, subtle, cache)

        const cached = await cache.get(SEED_KEY_ID)
        expect(cached!.some(byte => byte !== 0)).toBe(true)
    })

    it('returns null when no candidate reproduces the stored public key', async () => {
        // A userName is required so `identityCandidates` yields at least one
        // candidate — otherwise the comparison loop never runs and the test
        // passes vacuously regardless of what `publicKey` is set to.
        const key = await buildReproducibleKey('alice', {
            userName: 'not-alice',
        })
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

    // The legacy importer (`writeNativePasskeyEntry` without a
    // `parentKeyId`) is excluded via the no-`parentKeyId` check exercised by
    // "returns null when the credential has no parent key id" above. This
    // test isolates the OTHER reason it could never be reproduced even if a
    // future writer did start setting `parentKeyId`: the legacy path derives
    // from `userName` fed in verbatim (unlowercased), while every candidate
    // this module tries is lowercased — so a credential whose real
    // derivation identity had uppercase letters can never match.
    it('excludes a credential derived from a verbatim (non-lowercased) identity', async () => {
        const mainKey = await derivePasskeyMainKey(ENTROPY, subtle)
        const derived = await derivePasskeyCredential({
            mainKey,
            origin: 'webauthn.io',
            identity: 'Alice',
        })
        const key = {
            id: derived.credentialId,
            type: 'hd-derived-p256',
            algorithm: 'P256',
            extractable: false,
            publicKey: derived.publicKeySpkiDer,
            metadata: {
                origin: 'webauthn.io',
                parentKeyId: MAIN_KEY_ID,
                counter: 0,
                userName: 'Alice',
                createdAt: 1_700_000_000_000,
            },
        } as unknown as Key

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

describe('storedPasskeyBackupInputs', () => {
    const derive = async (identity = 'alice') =>
        derivePasskeyCredential({
            mainKey: await derivePasskeyMainKey(ENTROPY, subtle),
            origin: 'webauthn.io',
            identity,
        })

    const recordFor = (
        publicKey: Uint8Array,
        metadata: Record<string, unknown> = {},
    ): Key =>
        ({
            id: 'credential-id',
            type: 'hd-derived-p256',
            algorithm: 'P256',
            extractable: false,
            publicKey,
            metadata: {
                origin: 'webauthn.io',
                userId: 'dXNlcg==',
                userName: 'alice',
                createdAt: 1_700_000_000_000,
                ...metadata,
            },
        }) as unknown as Key

    // No `parentKeyId`: the legacy importer's records and every credential
    // whose wallet is gone look like this, and the seed path rejects them.
    it('builds inputs from the key a record holds, with no seed', async () => {
        const derived = await derive()

        const inputs = storedPasskeyBackupInputs(
            recordFor(derived.publicKeySpkiDer),
            derived.privateKey,
        )

        expect(inputs).toMatchObject({
            credentialId: 'credential-id',
            origin: 'webauthn.io',
            publicKeySpkiDer: encodeToBase64(derived.publicKeySpkiDer),
            userId: 'dXNlcg==',
            createdAt: 1_700_000_000_000,
        })
        expect(inputs?.seedKeyId).toBeUndefined()
        expect(inputs?.identity).toBeUndefined()
        expect(inputs?.privateKey).toBe(derived.privateKey)
    })

    it('labels an Android provider record by the name its userHandle holds', async () => {
        const derived = await derive()

        const inputs = storedPasskeyBackupInputs(
            recordFor(derived.publicKeySpkiDer, {
                userName: undefined,
                userHandle: 'alice',
                userId: 'YWxpY2UtaWQ=',
            }),
            derived.privateKey,
        )

        expect(inputs?.userName).toBe('alice')
    })

    it('does not take a userHandle that only repeats the user id as a name', async () => {
        const derived = await derive()

        const inputs = storedPasskeyBackupInputs(
            recordFor(derived.publicKeySpkiDer, {
                userName: undefined,
                userHandle: 'YWxpY2UtaWQ=',
                userId: 'YWxpY2UtaWQ=',
            }),
            derived.privateKey,
        )

        expect(inputs?.userName).toBeUndefined()
    })

    it('carries a stored identity and derivation counter through', async () => {
        const derived = await derive()

        const inputs = storedPasskeyBackupInputs(
            recordFor(derived.publicKeySpkiDer, {
                identity: 'Alice',
                counter: 2,
            }),
            derived.privateKey,
        )

        expect(inputs).toMatchObject({ identity: 'Alice', counter: 2 })
    })

    it('reports 0, not the clock, for a record that stored no creation time', async () => {
        const derived = await derive()
        const record = recordFor(derived.publicKeySpkiDer)
        delete (record.metadata as Record<string, unknown>).createdAt

        expect(
            storedPasskeyBackupInputs(record, derived.privateKey)?.createdAt,
        ).toBe(0)
    })

    it('accepts a stored public key in the raw 64-byte form', async () => {
        const derived = await derive()
        const raw = derived.publicKeySpkiDer.slice(-64)

        expect(
            storedPasskeyBackupInputs(recordFor(raw), derived.privateKey),
        ).not.toBeNull()
    })

    it('returns null and zeroes the key when it does not produce the public key', async () => {
        const derived = await derive()
        const other = await derive('mallory')

        const inputs = storedPasskeyBackupInputs(
            recordFor(derived.publicKeySpkiDer),
            other.privateKey,
        )

        expect(inputs).toBeNull()
        expect(other.privateKey.every(byte => byte === 0)).toBe(true)
    })

    it('returns null and zeroes the key for a migration-flagged record', async () => {
        const derived = await derive()

        const inputs = storedPasskeyBackupInputs(
            recordFor(derived.publicKeySpkiDer, {
                migration: 'needs-migration',
            }),
            derived.privateKey,
        )

        expect(inputs).toBeNull()
        expect(derived.privateKey.every(byte => byte === 0)).toBe(true)
    })

    it('returns null for a key that is not a passkey credential', async () => {
        const derived = await derive()
        const record = {
            ...recordFor(derived.publicKeySpkiDer),
            type: 'hd-root-key',
        } as unknown as Key

        expect(storedPasskeyBackupInputs(record, derived.privateKey)).toBeNull()
    })
})
