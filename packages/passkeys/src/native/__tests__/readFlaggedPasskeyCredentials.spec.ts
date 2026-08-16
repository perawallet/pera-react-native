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

// Same technique as `packages/passkeys/src/models/__tests__/passkey.spec.ts`
// and `extensions/provider`'s migration specs: the keystore's package root
// pulls react-native-mmkv, which has no loadable build here, but
// `dist/storage/driver.js` (where the prefixes and the marker are defined)
// imports only keystore-core and @scure/base. Everything the module under test
// reads from the keystore is therefore the real implementation.
// The defaults the module falls back to when a caller passes only `subtle` —
// which is how the app calls it.
const mocks = vi.hoisted(() => ({
    defaultReadMasterKey: vi.fn(),
    defaultStorage: {
        getAllKeys: vi.fn((): string[] => []),
        getString: vi.fn((): string | undefined => undefined),
    },
}))

vi.mock('@algorandfoundation/react-native-keystore', async () => {
    const driver =
        await import('../../../node_modules/@algorandfoundation/react-native-keystore/dist/storage/driver.js')
    return {
        METADATA_PREFIX: driver.METADATA_PREFIX,
        MATERIAL_PREFIX: driver.MATERIAL_PREFIX,
        readMasterKey: mocks.defaultReadMasterKey,
        storage: mocks.defaultStorage,
    }
})

import {
    MATERIAL_PREFIX,
    METADATA_PREFIX,
} from '@algorandfoundation/react-native-keystore'
import { PASSKEY_MIGRATION_NEEDED } from '../../models/passkey'
import { sealNativeProviderRecord } from '../nativeProviderRecord'
import { readFlaggedPasskeyCredentials } from '../readFlaggedPasskeyCredentials'

const subtle = globalThis.crypto.subtle
const MASTER_KEY = new Uint8Array(32).fill(7)

let store: Map<string, string>
let readMasterKey: ReturnType<typeof vi.fn>

const storage = {
    getAllKeys: () => [...store.keys()],
    getString: (key: string) => store.get(key),
}

const deps = () => ({
    subtle,
    storage,
    readMasterKey: readMasterKey as () => Promise<Uint8Array>,
})

const flatRecord = (overrides: {
    id: string
    type?: string
    metadata?: Record<string, unknown>
}) => ({
    id: overrides.id,
    type: overrides.type ?? 'hd-derived-p256',
    algorithm: 'P256',
    extractable: false,
    keyUsages: ['sign'],
    name: 'Passkey: webauthn.io',
    publicKey: Array.from(new Uint8Array(91).fill(4)),
    privateKey: Array.from(new Uint8Array(32).fill(3)),
    metadata: overrides.metadata ?? {
        origin: 'webauthn.io',
        userHandle: 'alice',
        migration: PASSKEY_MIGRATION_NEEDED,
    },
})

const seed = async (
    key: string,
    record: ReturnType<typeof flatRecord>,
): Promise<void> => {
    store.set(key, await sealNativeProviderRecord(subtle, MASTER_KEY, record))
}

describe('readFlaggedPasskeyCredentials', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        store = new Map()
        readMasterKey = vi.fn(async () => MASTER_KEY.slice())
        mocks.defaultStorage.getAllKeys.mockImplementation(() => [
            ...store.keys(),
        ])
        mocks.defaultStorage.getString.mockImplementation((key: string) =>
            store.get(key),
        )
    })

    it('projects a flagged flat credential, attributed to the provider store', async () => {
        await seed('cred-1', flatRecord({ id: 'cred-1' }))

        const flagged = await readFlaggedPasskeyCredentials(deps())

        expect(flagged).toHaveLength(1)
        expect(flagged[0]).toMatchObject({
            keyId: 'cred-1',
            origin: 'webauthn.io',
            needsMigration: true,
            source: 'provider',
        })
    })

    it('skips an otherwise identical credential that carries no migration marker', async () => {
        await seed(
            'cred-1',
            flatRecord({
                id: 'cred-1',
                metadata: { origin: 'webauthn.io', userHandle: 'alice' },
            }),
        )

        await expect(readFlaggedPasskeyCredentials(deps())).resolves.toEqual([])
    })

    it('skips a flagged record whose type is not a passkey credential type', async () => {
        await seed('root-1', flatRecord({ id: 'root-1', type: 'hd-root-key' }))

        await expect(readFlaggedPasskeyCredentials(deps())).resolves.toEqual([])
    })

    it('reads bare ids only: a flagged record parked under k/ or m/ is not a provider record', async () => {
        await seed(METADATA_PREFIX + 'cred-1', flatRecord({ id: 'cred-1' }))
        await seed(MATERIAL_PREFIX + 'cred-1', flatRecord({ id: 'cred-1' }))

        await expect(readFlaggedPasskeyCredentials(deps())).resolves.toEqual([])
    })

    it('never touches the master key when there is no bare-id record to open', async () => {
        store.set(METADATA_PREFIX + 'cred-1', 'whatever')

        await expect(readFlaggedPasskeyCredentials(deps())).resolves.toEqual([])
        expect(readMasterKey).not.toHaveBeenCalled()
    })

    it('skips an unreadable record instead of rejecting, and still returns its readable neighbour', async () => {
        store.set('broken', '{"iv":"AAAA","tag":"AAAA","content":"AAAA"}')
        await seed('cred-1', flatRecord({ id: 'cred-1' }))

        const flagged = await readFlaggedPasskeyCredentials(deps())

        expect(flagged.map(p => p.keyId)).toEqual(['cred-1'])
    })

    it('resolves empty rather than rejecting when the master key cannot be read', async () => {
        await seed('cred-1', flatRecord({ id: 'cred-1' }))
        readMasterKey.mockRejectedValue(new Error('no master key'))

        await expect(readFlaggedPasskeyCredentials(deps())).resolves.toEqual([])
    })

    // The app supplies only `subtle`; everything else falls back to the
    // keystore's own MMKV instance and keychain read.
    it('falls back to the keystore storage and master key when given only subtle', async () => {
        await seed('cred-1', flatRecord({ id: 'cred-1' }))
        mocks.defaultReadMasterKey.mockResolvedValue(Buffer.from(MASTER_KEY))

        const flagged = await readFlaggedPasskeyCredentials({ subtle })

        expect(flagged.map(p => p.keyId)).toEqual(['cred-1'])
        expect(mocks.defaultStorage.getAllKeys).toHaveBeenCalled()
    })

    it('zeroes the keystore Buffer the default master-key read hands back', async () => {
        await seed('cred-1', flatRecord({ id: 'cred-1' }))
        const buffer = Buffer.from(MASTER_KEY)
        mocks.defaultReadMasterKey.mockResolvedValue(buffer)

        const flagged = await readFlaggedPasskeyCredentials({ subtle })

        expect(flagged).toHaveLength(1)
        expect([...buffer]).toEqual(Array(32).fill(0))
    })
})
