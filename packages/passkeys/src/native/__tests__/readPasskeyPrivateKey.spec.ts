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

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Same technique as `readFlatKeystoreRecords.spec.ts`: the keystore's package
// root pulls react-native-mmkv, which has no loadable build here, but
// `dist/storage/driver.js` holds the prefixes and imports nothing native.
vi.mock('@perawallet/wallet-extension-provider', () => ({ keystoreSubtle: {} }))

vi.mock('@algorandfoundation/react-native-keystore', async () => {
    const driver =
        await import('../../../node_modules/@algorandfoundation/react-native-keystore/dist/storage/driver.js')
    return {
        METADATA_PREFIX: driver.METADATA_PREFIX,
        MATERIAL_PREFIX: driver.MATERIAL_PREFIX,
        readMasterKey: vi.fn(),
        storage: { getString: vi.fn() },
        openData: vi.fn(),
    }
})

import {
    MATERIAL_PREFIX,
    METADATA_PREFIX,
} from '@algorandfoundation/react-native-keystore'
import { p256PrivateKeyToSpkiDer } from '../../crypto/derivePasskeyCredential'
import { sealNativeProviderRecord } from '../nativeProviderRecord'
import { createPasskeyPrivateKeyReader } from '../readPasskeyPrivateKey'

const subtle = globalThis.crypto.subtle
const PRIVATE_KEY = new Uint8Array(32).fill(5)
const ID = 'Y3JlZC1pZA=='

let store: Map<string, string>
let masterKey: Uint8Array

const toBase64 = (bytes: Uint8Array): string =>
    Buffer.from(bytes).toString('base64')

/** Stands in for the keystore's `openData`: the sealed value is the base64
 *  material itself, so a test controls exactly what `m/` opens to. */
const openData = vi.fn(async (_s: SubtleCrypto, _k: Uint8Array, p: string) => p)

const reader = (over: Record<string, unknown> = {}) =>
    createPasskeyPrivateKeyReader({
        subtle,
        storage: { getString: (key: string) => store.get(key) },
        readMasterKey: async () => masterKey,
        openData,
        ...over,
    })

const sealBareRecord = async (record: Record<string, unknown>) =>
    store.set(ID, await sealNativeProviderRecord(subtle, masterKey, record))

describe('createPasskeyPrivateKeyReader', () => {
    beforeEach(() => {
        store = new Map()
        masterKey = new Uint8Array(32).fill(7)
        openData.mockClear()
    })

    it('reads the key from an iOS bare-id provider record', async () => {
        await sealBareRecord({ id: ID, privateKey: Array.from(PRIVATE_KEY) })
        const read = reader()

        expect(await read(ID)).toEqual(PRIVATE_KEY)
        await read.dispose()
    })

    it('reads the key from an unwrapped Android split record', async () => {
        store.set(METADATA_PREFIX + ID, JSON.stringify({ id: ID }))
        store.set(MATERIAL_PREFIX + ID, toBase64(PRIVATE_KEY))
        const read = reader()

        expect(await read(ID)).toEqual(PRIVATE_KEY)
        await read.dispose()
    })

    it("normalises the Android provider's PKCS#8 material to the raw scalar", async () => {
        const pair = await subtle.generateKey(
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['sign', 'verify'],
        )
        const pkcs8 = new Uint8Array(
            await subtle.exportKey('pkcs8', pair.privateKey),
        )
        store.set(METADATA_PREFIX + ID, JSON.stringify({ id: ID }))
        store.set(MATERIAL_PREFIX + ID, toBase64(pkcs8))

        const spki = new Uint8Array(
            await subtle.exportKey('spki', pair.publicKey),
        )

        const key = await reader()(ID)

        expect(p256PrivateKeyToSpkiDer(key!)).toEqual(spki)
    })

    it('returns null for a biometric-wrapped Android credential', async () => {
        store.set(
            METADATA_PREFIX + ID,
            JSON.stringify({ id: ID, privateKeyEnc: { iv: 'aXY=' } }),
        )
        store.set(MATERIAL_PREFIX + ID, toBase64(PRIVATE_KEY))

        expect(await reader()(ID)).toBeNull()
        expect(openData).not.toHaveBeenCalled()
    })

    it('returns null for a bare record that carries no private key', async () => {
        await sealBareRecord({ id: ID })

        expect(await reader()(ID)).toBeNull()
    })

    it('returns null for material that is not a 32-byte scalar', async () => {
        store.set(METADATA_PREFIX + ID, JSON.stringify({ id: ID }))
        store.set(MATERIAL_PREFIX + ID, toBase64(new Uint8Array(16)))

        expect(await reader()(ID)).toBeNull()
    })

    it('returns null for a credential the store does not hold', async () => {
        expect(await reader()(ID)).toBeNull()
    })

    it('returns null rather than throwing when the master key is unavailable', async () => {
        await sealBareRecord({ id: ID, privateKey: Array.from(PRIVATE_KEY) })
        const read = reader({
            readMasterKey: async () => {
                throw new Error('keychain locked')
            },
        })

        expect(await read(ID)).toBeNull()
    })

    it('reads the master key once across reads and zeroes it on dispose', async () => {
        store.set(METADATA_PREFIX + ID, JSON.stringify({ id: ID }))
        store.set(MATERIAL_PREFIX + ID, toBase64(PRIVATE_KEY))
        const readMasterKey = vi.fn(async () => masterKey)
        const read = reader({ readMasterKey })

        await read(ID)
        await read(ID)
        await read.dispose()

        expect(readMasterKey).toHaveBeenCalledTimes(1)
        expect(masterKey.every(byte => byte === 0)).toBe(true)
    })
})
