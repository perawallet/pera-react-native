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

// Same technique as `readFlaggedPasskeyCredentials.spec.ts`: the keystore's
// package root pulls react-native-mmkv, which has no loadable build here, but
// `dist/storage/driver.js` holds the prefixes and imports only keystore-core
// and @scure/base.
const mocks = vi.hoisted(() => ({
    defaultReadMasterKey: vi.fn(),
    defaultStorage: {
        getAllKeys: vi.fn((): string[] => []),
        getString: vi.fn((): string | undefined => undefined),
    },
    defaultOpenData: vi.fn(),
    defaultDecode: vi.fn(),
}))

vi.mock('@algorandfoundation/react-native-keystore', async () => {
    const driver =
        await import('../../../node_modules/@algorandfoundation/react-native-keystore/dist/storage/driver.js')
    return {
        METADATA_PREFIX: driver.METADATA_PREFIX,
        MATERIAL_PREFIX: driver.MATERIAL_PREFIX,
        readMasterKey: mocks.defaultReadMasterKey,
        storage: mocks.defaultStorage,
        openData: mocks.defaultOpenData,
        decode: mocks.defaultDecode,
    }
})

import {
    MATERIAL_PREFIX,
    METADATA_PREFIX,
} from '@algorandfoundation/react-native-keystore'
import { sealNativeProviderRecord } from '../nativeProviderRecord'
import { readFlatKeystoreRecords } from '../readFlatKeystoreRecords'

const subtle = globalThis.crypto.subtle
const MASTER_KEY = new Uint8Array(32).fill(7)

let store: Map<string, string>

const storage = {
    getAllKeys: () => [...store.keys()],
    getString: (key: string) => store.get(key),
}

const readMasterKey = async () => MASTER_KEY

const credentialRecord = (id: string) => ({
    id,
    type: 'hd-derived-p256',
    algorithm: 'P256',
    publicKey: [1, 2, 3, 4],
    metadata: {
        origin: 'webauthn.io',
        parentKeyId: 'seed-1-passkey-main',
        userHandle: 'user@example.com',
    },
})

/** What the keystore's own `sealData` writer leaves on disk: `{iv, content}`
 *  with the GCM tag inside the ciphertext, and no `tag` field. */
const keystoreSealed = (plaintext: string) => {
    const payload = JSON.stringify({ iv: 'aXY=', content: 'c2VhbGVk' })
    return { payload, plaintext }
}

const deps = (over: Record<string, unknown> = {}) => ({
    subtle,
    storage,
    readMasterKey,
    ...over,
})

beforeEach(() => {
    store = new Map()
})

describe('readFlatKeystoreRecords', () => {
    it('reads a credential the keystore writer sealed as {iv, content}', async () => {
        const record = credentialRecord('cred-1')
        const { payload, plaintext } = keystoreSealed(JSON.stringify(record))
        store.set('cred-1', payload)

        const scan = await readFlatKeystoreRecords(
            deps({
                openData: async () => plaintext,
                decode: (data: string) => JSON.parse(data) as unknown,
            }),
        )

        expect(scan.isComplete).toBe(true)
        expect(scan.keys).toHaveLength(1)
        expect(scan.keys[0].id).toBe('cred-1')
        expect(scan.keys[0].type).toBe('hd-derived-p256')
    })

    // The byte fields arrive as JSON number arrays from the provider envelope
    // and as `{$u8}`-decoded Uint8Arrays from the keystore one; everything
    // downstream reads `publicKey` as bytes.
    it('normalises a number-array public key to bytes', async () => {
        const record = credentialRecord('cred-1')
        const { payload, plaintext } = keystoreSealed(JSON.stringify(record))
        store.set('cred-1', payload)

        const scan = await readFlatKeystoreRecords(
            deps({
                openData: async () => plaintext,
                decode: (data: string) => JSON.parse(data) as unknown,
            }),
        )

        expect(scan.keys[0].publicKey).toBeInstanceOf(Uint8Array)
        expect([...(scan.keys[0].publicKey as Uint8Array)]).toEqual([
            1, 2, 3, 4,
        ])
    })

    it('reads a credential the provider writer sealed as {iv, tag, content}', async () => {
        const record = credentialRecord('cred-2')
        store.set(
            'cred-2',
            await sealNativeProviderRecord(subtle, MASTER_KEY, record),
        )

        const scan = await readFlatKeystoreRecords(deps())

        expect(scan.isComplete).toBe(true)
        expect(scan.keys.map(key => key.id)).toEqual(['cred-2'])
    })

    // The split `k/`+`m/` pair is the keystore's own layout; this reader is
    // only for the bare-id records the credential providers own.
    it('ignores the split keystore layout', async () => {
        store.set(`${METADATA_PREFIX}cred-1`, 'whatever')
        store.set(`${MATERIAL_PREFIX}cred-1`, 'whatever')

        const scan = await readFlatKeystoreRecords(deps())

        expect(scan.keys).toEqual([])
        expect(scan.isComplete).toBe(true)
    })

    // An entry that could not be opened is one we cannot rule out, so a caller
    // must be able to tell that from a clean scan of a keystore with none.
    it('reports an unreadable entry rather than silently dropping it', async () => {
        store.set('cred-1', '{"iv":"aXY=","content":"c2VhbGVk"}')

        const scan = await readFlatKeystoreRecords(
            deps({
                openData: async () => {
                    throw new Error('cannot open')
                },
            }),
        )

        expect(scan.keys).toEqual([])
        expect(scan.isComplete).toBe(false)
    })

    it('does not ask for the master key when there is nothing to open', async () => {
        const readKey = vi.fn(async () => MASTER_KEY)

        const scan = await readFlatKeystoreRecords(
            deps({ readMasterKey: readKey }),
        )

        expect(scan).toEqual({ keys: [], isComplete: true })
        expect(readKey).not.toHaveBeenCalled()
    })
})
