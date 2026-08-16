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

        const { flagged } = await readFlaggedPasskeyCredentials(deps())

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

        await expect(
            readFlaggedPasskeyCredentials(deps()),
        ).resolves.toMatchObject({ flagged: [] })
    })

    it('skips a flagged record whose type is not a passkey credential type', async () => {
        await seed('root-1', flatRecord({ id: 'root-1', type: 'hd-root-key' }))

        await expect(
            readFlaggedPasskeyCredentials(deps()),
        ).resolves.toMatchObject({ flagged: [] })
    })

    it('reads bare ids only: a flagged record parked under k/ or m/ is not a provider record', async () => {
        await seed(METADATA_PREFIX + 'cred-1', flatRecord({ id: 'cred-1' }))
        await seed(MATERIAL_PREFIX + 'cred-1', flatRecord({ id: 'cred-1' }))

        await expect(
            readFlaggedPasskeyCredentials(deps()),
        ).resolves.toMatchObject({ flagged: [] })
    })

    it('never touches the master key when there is no bare-id record to open', async () => {
        store.set(METADATA_PREFIX + 'cred-1', 'whatever')

        await expect(
            readFlaggedPasskeyCredentials(deps()),
        ).resolves.toMatchObject({ flagged: [] })
        expect(readMasterKey).not.toHaveBeenCalled()
    })

    it('skips an unreadable record instead of rejecting, and still returns its readable neighbour', async () => {
        store.set('broken', '{"iv":"AAAA","tag":"AAAA","content":"AAAA"}')
        await seed('cred-1', flatRecord({ id: 'cred-1' }))

        const { flagged } = await readFlaggedPasskeyCredentials(deps())

        expect(flagged.map(p => p.keyId)).toEqual(['cred-1'])
    })

    it('resolves empty rather than rejecting when the master key cannot be read', async () => {
        await seed('cred-1', flatRecord({ id: 'cred-1' }))
        readMasterKey.mockRejectedValue(new Error('no master key'))

        await expect(
            readFlaggedPasskeyCredentials(deps()),
        ).resolves.toMatchObject({ flagged: [] })
    })

    // The app supplies only `subtle`; everything else falls back to the
    // keystore's own MMKV instance and keychain read.
    it('falls back to the keystore storage and master key when given only subtle', async () => {
        await seed('cred-1', flatRecord({ id: 'cred-1' }))
        mocks.defaultReadMasterKey.mockResolvedValue(Buffer.from(MASTER_KEY))

        const { flagged } = await readFlaggedPasskeyCredentials({ subtle })

        expect(flagged.map(p => p.keyId)).toEqual(['cred-1'])
        expect(mocks.defaultStorage.getAllKeys).toHaveBeenCalled()
    })

    // The scan's own working copy, distinct from the Buffer the default read
    // zeroes below: an injected `readMasterKey` never goes through
    // `readMasterKeyBytes`, so only the scan-exit wipe can clear this one.
    it('zeroes the master key it scanned with once the scan is over', async () => {
        await seed('cred-1', flatRecord({ id: 'cred-1' }))
        const injected = MASTER_KEY.slice()
        readMasterKey.mockResolvedValue(injected)

        const { flagged } = await readFlaggedPasskeyCredentials(deps())

        expect(flagged.map(p => p.keyId)).toEqual(['cred-1'])
        expect([...injected]).toEqual(Array(32).fill(0))
    })

    it('zeroes the keystore Buffer the default master-key read hands back', async () => {
        await seed('cred-1', flatRecord({ id: 'cred-1' }))
        const buffer = Buffer.from(MASTER_KEY)
        mocks.defaultReadMasterKey.mockResolvedValue(buffer)

        const { flagged } = await readFlaggedPasskeyCredentials({ subtle })

        expect(flagged).toHaveLength(1)
        expect([...buffer]).toEqual(Array(32).fill(0))
    })

    // Completeness. Every failure below still resolves — a rejection here would
    // surface as a broken passkey screen — so `isComplete` is the only channel
    // that can tell "nothing is flagged" apart from "nothing could be read".
    // A consumer gating a one-way delete reads it, not the emptiness of the
    // list.
    it('reports the scan incomplete when the key listing cannot be read', async () => {
        const scan = await readFlaggedPasskeyCredentials({
            subtle,
            storage: {
                getAllKeys: () => {
                    throw new Error('mmkv unavailable')
                },
                getString: () => undefined,
            },
            readMasterKey: readMasterKey as () => Promise<Uint8Array>,
        })

        expect(scan.isComplete).toBe(false)
    })

    it('reports the scan incomplete when the master key cannot be read', async () => {
        await seed('cred-1', flatRecord({ id: 'cred-1' }))
        readMasterKey.mockRejectedValue(new Error('no master key'))

        const scan = await readFlaggedPasskeyCredentials(deps())

        expect(scan.isComplete).toBe(false)
    })

    it('reports the scan incomplete when a sealed record cannot be opened, and still returns its readable neighbour', async () => {
        store.set('broken', '{"iv":"AAAA","tag":"AAAA","content":"AAAA"}')
        await seed('cred-1', flatRecord({ id: 'cred-1' }))

        const scan = await readFlaggedPasskeyCredentials(deps())

        expect(scan.flagged.map(p => p.keyId)).toEqual(['cred-1'])
        expect(scan.isComplete).toBe(false)
    })

    it('reports the scan incomplete when a listed key cannot be fetched', async () => {
        const scan = await readFlaggedPasskeyCredentials({
            subtle,
            storage: {
                getAllKeys: () => ['unfetchable'],
                getString: () => {
                    throw new Error('mmkv read failed')
                },
            },
            readMasterKey: readMasterKey as () => Promise<Uint8Array>,
        })

        expect(scan.isComplete).toBe(false)
    })

    // The floor, so the gate this feeds cannot be satisfied by never reporting
    // completeness: an empty bare-id namespace really is a whole-store answer.
    it('reports the scan complete when there is nothing to open', async () => {
        store.set(METADATA_PREFIX + 'cred-1', 'whatever')

        const scan = await readFlaggedPasskeyCredentials(deps())

        expect(scan).toEqual({ flagged: [], isComplete: true })
    })

    it('reports the scan incomplete when a listed key has no payload', async () => {
        const scan = await readFlaggedPasskeyCredentials({
            subtle,
            storage: {
                getAllKeys: () => ['vanished'],
                getString: () => undefined,
            },
            readMasterKey: readMasterKey as () => Promise<Uint8Array>,
        })

        expect(scan.isComplete).toBe(false)
    })

    // The other half, and the one that keeps the gate from jamming shut: an
    // entry that is not a credential-provider payload at all was examined
    // successfully — it is another writer's, not a record we failed to read.
    // The keystore's own legacy bare-id writer emits `{iv, content}` with no
    // `tag`, so this shape is a real neighbour, not a hypothetical.
    it('reports the scan complete when a neighbouring entry is not a credential-provider payload', async () => {
        store.set('legacy', '{"iv":"AAAA","content":"AAAA"}')
        store.set('plain', '{"id":"plain","type":"ed25519"}')
        await seed('cred-1', flatRecord({ id: 'cred-1' }))

        const scan = await readFlaggedPasskeyCredentials(deps())

        expect(scan.flagged.map(p => p.keyId)).toEqual(['cred-1'])
        expect(scan.isComplete).toBe(true)
    })

    // A truncated envelope is OUR record, damaged — not another writer's. No
    // writer emits a `{`-prefixed payload that is not JSON, so the only way to
    // reach this is corruption, and calling it "someone else's" would report a
    // whole-store answer that silently omits a credential which may still need
    // migrating — unlocking a one-way delete on it.
    it('reports the scan incomplete when a credential-provider payload is truncated', async () => {
        const sealed = await sealNativeProviderRecord(
            subtle,
            MASTER_KEY,
            flatRecord({ id: 'cred-1' }),
        )
        store.set('cred-1', sealed.slice(0, sealed.length - 10))

        const scan = await readFlaggedPasskeyCredentials(deps())

        expect(scan.isComplete).toBe(false)
    })

    it('reports the scan complete when every record opened', async () => {
        await seed('cred-1', flatRecord({ id: 'cred-1' }))

        const scan = await readFlaggedPasskeyCredentials(deps())

        expect(scan.isComplete).toBe(true)
    })
})
