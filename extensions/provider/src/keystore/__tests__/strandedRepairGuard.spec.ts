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

// Same trick as the other keystore specs: the package root executes native
// Keychain/Nitro bindings at import time, which node cannot run. `driver.js`
// and `errors.js` depend only on `@scure/base` and `keystore-core`, so the
// prefixes, `serializeKey`, and `MasterKeyNotFoundError` from them are the
// genuine article; `sealData`/`openData`/`decode` come from the local fixture
// that re-implements the on-disk format over Web Crypto instead.
vi.mock('@algorandfoundation/react-native-keystore', async () => {
    const driver =
        await import('../../../node_modules/@algorandfoundation/react-native-keystore/dist/storage/driver.js')
    const errors =
        await import('../../../node_modules/@algorandfoundation/react-native-keystore/dist/errors.js')
    const formats = await import('../migrations/__fixtures__/keystoreFormats')

    return {
        MATERIAL_PREFIX: driver.MATERIAL_PREFIX,
        METADATA_PREFIX: driver.METADATA_PREFIX,
        serializeKey: driver.serializeKey,
        MasterKeyNotFoundError: errors.MasterKeyNotFoundError,
        sealData: formats.sealData,
        openData: formats.openData,
        decode: formats.decode,
        // Never invoked directly: every test below drives `runStrandedRepairWith`
        // through its injectable `deps`, never the live-storage default export.
        readMasterKey: vi.fn(),
        storage: { getAllKeys: () => [], getString: () => undefined },
    }
})

vi.mock('react-native-quick-crypto', () => ({
    subtle: globalThis.crypto.subtle,
}))

import { fakeStorage } from '../migrations/__fixtures__/fakeStorage'
import { sealCanary13Record } from '../migrations/__fixtures__/keystoreFormats'
import {
    emptyAdoptionResult,
    hasStrandedWork,
} from '../migrations/adopt/strandedRecords'
import { runStrandedRepairWith } from '../maintenance'

const MASTER_KEY = new Uint8Array(32).fill(7)
const subtle = globalThis.crypto.subtle

const noteStore = () => {
    const store = new Map<string, string>()
    return {
        getString: (key: string) => store.get(key),
        set: (key: string, value: string) => {
            store.set(key, value)
        },
    }
}

const runStrandedRepairWithFake = (
    storage: ReturnType<typeof fakeStorage>,
    notes = noteStore(),
) =>
    runStrandedRepairWith({
        storage,
        subtle,
        masterKeyForRead: async () => MASTER_KEY,
        noteStore: notes,
    })

describe('stranded repair guard', () => {
    it('does no crypto work on a healthy store', () => {
        const storage = fakeStorage()
        storage.set('k/abc', '{}')
        storage.set('m/abc', '{}')

        const getAllKeys = vi.spyOn(storage, 'getAllKeys')

        expect(hasStrandedWork(storage)).toBe(false)
        expect(getAllKeys).toHaveBeenCalledTimes(1)
    })

    it('reports work when a bare id remains', () => {
        const storage = fakeStorage()
        storage.set('abc', 'sealed')

        expect(hasStrandedWork(storage)).toBe(true)
    })

    // The red step for this task. `hasStrandedWork` already exists by now, so
    // the two tests above cannot fail first; this one can, and it pins the
    // behaviour this task actually introduces.
    it('records ids that belong at the bare id, so a second call is a no-op', async () => {
        const storage = fakeStorage()
        storage.set(
            'cred-1',
            await sealCanary13Record(subtle, MASTER_KEY, {
                id: 'cred-1',
                type: 'hd-derived-p256',
                algorithm: 'P256',
                privateKeyEnc: { iv: 'aa', data: 'bb' },
            }),
        )
        const notes = noteStore()

        const first = await runStrandedRepairWithFake(storage, notes)
        expect(first.leftFlat).toEqual(['cred-1'])

        const second = await runStrandedRepairWithFake(storage, notes)
        expect(second).toEqual(emptyAdoptionResult())
    })

    // The required widening: a `0004`-moved credential has no bare id at all,
    // so `hasStrandedWork`'s flat scan alone would see nothing to do on a
    // device whose only stranded work is a passkey sitting in `k/`. The guard
    // must still fire the restore that brings it back.
    it('retries a moved passkey even though no bare candidate exists', async () => {
        const storage = fakeStorage()
        const { serializeKey } =
            await import('@algorandfoundation/react-native-keystore')
        // `k/<id>` (METADATA_PREFIX) holding the wrapped credential, exactly
        // what revision 0004 left behind, with no bare `cred-2` anywhere.
        storage.set(
            'k/cred-2',
            serializeKey({
                id: 'cred-2',
                type: 'hd-derived-p256',
                algorithm: 'P256',
                privateKeyEnc: { iv: 'aa', data: 'bb' },
                publicKey: new Uint8Array(91).fill(4),
                metadata: { origin: 'https://example.com' },
            } as never),
        )

        expect(hasStrandedWork(storage)).toBe(true)

        const result = await runStrandedRepairWithFake(storage)

        expect(result.restored).toEqual(['cred-2'])
    })

    it('never throws when the master key is transiently unreadable, and retries on the next call', async () => {
        const storage = fakeStorage()
        storage.set('abc', 'sealed')
        const notes = noteStore()

        const failing = runStrandedRepairWith({
            storage,
            subtle,
            masterKeyForRead: async () => {
                throw new Error('keychain temporarily unavailable')
            },
            noteStore: notes,
        })

        // `adoptStrandedRecords` itself already turns a `masterKeyForRead`
        // failure into a `failed` entry rather than a rejection — this just
        // confirms the guard never adds a throw of its own on top.
        const result = await failing
        expect(result.failed).toEqual([
            { id: '*', reason: 'keychain temporarily unavailable' },
        ])
        // Nothing readable was resolved, so nothing was ledgered as
        // belonging flat — the guard still sees the bare id as stranded work
        // on the very next call.
        expect(hasStrandedWork(storage)).toBe(true)
    })
})
