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

import { describe, expect, it, vi } from 'vitest'
import { base64, base64url } from '@scure/base'

// The package root loads native Keychain/MMKV bindings, so only its pure
// pieces come from the real dist; the sealing formats come from the shared
// fixtures (see migrations/__fixtures__/keystoreFormats.ts for why).
vi.mock('@algorandfoundation/react-native-keystore', async () => {
    const driver =
        await import('../../../../node_modules/@algorandfoundation/react-native-keystore/dist/storage/driver.js')
    const formats =
        await import('../../migrations/__fixtures__/keystoreFormats')
    return {
        MATERIAL_PREFIX: driver.MATERIAL_PREFIX,
        METADATA_PREFIX: driver.METADATA_PREFIX,
        serializeKey: driver.serializeKey,
        sealData: formats.sealData,
        openData: formats.openData,
        decode: formats.decode,
    }
})

import { fakeStorage } from '../../migrations/__fixtures__/fakeStorage'
import {
    openData,
    sealData,
} from '../../migrations/__fixtures__/keystoreFormats'
import { sealNativeCredentialRecord } from '../../migrations/nativeCredentialRecord'
import {
    splitProviderCredential,
    type FlatProviderCredential,
} from '../splitProviderCredential'
import {
    openFlatProviderRecord,
    verifySplitProviderCredential,
    writeSplitProviderCredential,
} from '../splitCredentialStorage'

const MASTER_KEY = new Uint8Array(32).fill(7)
const subtle = globalThis.crypto.subtle
const PUBLIC_KEY = new Uint8Array(4).fill(4)
const PRIVATE_KEY = new Uint8Array(32).fill(3)
const CIPHERTEXT = new Uint8Array(48).fill(9)
const IV = 'AAAAAAAAAAAAAAAA'

const metadata = {
    origin: 'https://webauthn.io',
    userHandle: 'alice',
    userId: 'dXNlcg',
    count: 0,
}

/** A flat record as the provider's JSON carries it: bytes as number arrays. */
const flatJson = (overrides: Record<string, unknown> = {}) => ({
    id: 'cred-1',
    type: 'hd-derived-p256',
    algorithm: 'P256',
    extractable: false,
    keyUsages: ['sign'],
    name: 'Passkey: https://webauthn.io',
    publicKey: Array.from(PUBLIC_KEY),
    privateKey: Array.from(PRIVATE_KEY),
    metadata,
    ...overrides,
})

/** The same record as `decode` hands it back. */
const decoded = (
    overrides: Partial<FlatProviderCredential> = {},
): FlatProviderCredential => ({
    id: 'cred-1',
    type: 'hd-derived-p256',
    algorithm: 'P256',
    extractable: false,
    keyUsages: ['sign'],
    name: 'Passkey: https://webauthn.io',
    publicKey: new Uint8Array(PUBLIC_KEY),
    privateKey: new Uint8Array(PRIVATE_KEY),
    metadata: { ...metadata },
    ...overrides,
})

const base64urlJson = (json: object): string =>
    base64url.encode(new TextEncoder().encode(JSON.stringify(json)))

/** base64url of `json`, nudged until the encoding carries padding. */
const paddedBase64urlJson = (json: Record<string, unknown>): string => {
    let candidate = { ...json }
    while (!base64urlJson(candidate).endsWith('=')) {
        candidate = { ...candidate, name: `${String(candidate.name)}_` }
    }
    return base64urlJson(candidate)
}

describe('openFlatProviderRecord', () => {
    it.each([
        [
            'the provider envelope {iv, tag, content}',
            () => sealNativeCredentialRecord(subtle, MASTER_KEY, flatJson()),
        ],
        [
            'the keystore envelope {iv, content}',
            () => sealData(subtle, MASTER_KEY, base64urlJson(flatJson())),
        ],
        [
            'an unsealed base64url payload',
            async () => paddedBase64urlJson(flatJson()),
        ],
        [
            'an unsealed payload without its padding',
            async () => paddedBase64urlJson(flatJson()).replace(/=+$/, ''),
        ],
    ])('opens %s', async (_shape, payload) => {
        const record = await openFlatProviderRecord(
            subtle,
            MASTER_KEY,
            await payload(),
        )

        expect(record.type).toBe('hd-derived-p256')
        expect(record.publicKey).toEqual(PUBLIC_KEY)
        expect(record.privateKey).toEqual(PRIVATE_KEY)
        expect(record.metadata?.origin).toBe('https://webauthn.io')
    })
})

describe('writeSplitProviderCredential', () => {
    // The Android reader (`credentialFromMetadataRecord` in Pera's patch of the
    // provider) needs exactly this: `publicKey` as `$u8`, `origin` under
    // `metadata`, the biometric IV under `privateKeyEnc.iv`. Frozen as a
    // literal so this side cannot drift silently.
    it('writes the k/ record the Android provider reads', async () => {
        const storage = fakeStorage()
        const split = splitProviderCredential(
            'cred-1',
            decoded({
                privateKey: undefined,
                privateKeyEnc: { iv: IV, data: base64.encode(CIPHERTEXT) },
            }),
        )!

        await writeSplitProviderCredential(
            { storage, subtle },
            MASTER_KEY,
            'cred-1',
            split,
        )

        expect(JSON.parse(storage.getString('k/cred-1')!)).toEqual({
            id: 'cred-1',
            type: 'hd-derived-p256',
            algorithm: 'P256',
            extractable: false,
            keyUsages: ['sign'],
            name: 'Passkey: https://webauthn.io',
            publicKey: { $u8: 'BAQEBA==' },
            metadata: {
                origin: 'https://webauthn.io',
                userHandle: 'alice',
                userId: 'dXNlcg',
                count: 0,
            },
            privateKeyEnc: { iv: IV },
        })
        expect(
            await openData(subtle, MASTER_KEY, storage.getString('m/cred-1')!),
        ).toBe(base64.encode(CIPHERTEXT))
    })

    it('writes no m/ record for a credential without material', async () => {
        const storage = fakeStorage()
        const split = splitProviderCredential(
            'cred-1',
            decoded({ privateKey: undefined }),
        )!

        await writeSplitProviderCredential(
            { storage, subtle },
            MASTER_KEY,
            'cred-1',
            split,
        )

        expect(Object.keys(storage.entries())).toEqual(['k/cred-1'])
    })

    it('restores every key it touched when the write does not read back', async () => {
        const backing = fakeStorage({ 'm/cred-1': 'earlier-material' })
        // Lands a k/ record that describes some other credential.
        const storage = {
            ...backing,
            set: (key: string, value: string) =>
                backing.set(
                    key,
                    key.startsWith('k/') ? '{"id":"someone-else"}' : value,
                ),
        }
        const split = splitProviderCredential('cred-1', decoded())!

        await expect(
            writeSplitProviderCredential(
                { storage, subtle },
                MASTER_KEY,
                'cred-1',
                split,
            ),
        ).rejects.toThrow('did not read back')
        expect(backing.entries()).toEqual({ 'm/cred-1': 'earlier-material' })
    })
})

describe('verifySplitProviderCredential', () => {
    it('accepts its own write and rejects a different key or material', async () => {
        const storage = fakeStorage()
        const deps = { storage, subtle }
        const split = splitProviderCredential('cred-1', decoded())!
        await writeSplitProviderCredential(deps, MASTER_KEY, 'cred-1', split)

        expect(
            await verifySplitProviderCredential(
                deps,
                MASTER_KEY,
                'cred-1',
                split,
            ),
        ).toBe(true)

        const otherKey = splitProviderCredential(
            'cred-1',
            decoded({ publicKey: new Uint8Array(4).fill(5) }),
        )!
        expect(
            await verifySplitProviderCredential(
                deps,
                MASTER_KEY,
                'cred-1',
                otherKey,
            ),
        ).toBe(false)

        const otherMaterial = splitProviderCredential(
            'cred-1',
            decoded({ privateKey: new Uint8Array(32).fill(8) }),
        )!
        expect(
            await verifySplitProviderCredential(
                deps,
                MASTER_KEY,
                'cred-1',
                otherMaterial,
            ),
        ).toBe(false)
    })
})
