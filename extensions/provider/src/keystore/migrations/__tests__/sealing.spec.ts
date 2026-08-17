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
import { base64 } from '@scure/base'

// See 0002-lift-nested-material.spec.ts for why the package root is mocked.
vi.mock('@algorandfoundation/react-native-keystore', async () => {
    const formats = await import('../__fixtures__/keystoreFormats')
    return { sealData: formats.sealData, openData: formats.openData }
})

import { openData } from '../__fixtures__/keystoreFormats'
import { fakeStorage } from '../__fixtures__/fakeStorage'
import type { PeraMigrationContext } from '../types'
import {
    createJournal,
    holdsSameMaterial,
    placeSecrets,
    sealAndVerify,
    wipeBytes,
} from '../sealing'

const MASTER_KEY = new Uint8Array(32).fill(7)
const subtle = globalThis.crypto.subtle

const context = (
    storage: ReturnType<typeof fakeStorage>,
): PeraMigrationContext => ({
    storage,
    subtle,
    masterKeyForRead: () => Promise.resolve(MASTER_KEY.slice()),
    declined: { read: () => [], record: () => {} },
})

describe('sealAndVerify', () => {
    it('seals bytes that open back to the same material', async () => {
        const storage = fakeStorage({})
        const bytes = new Uint8Array(32).fill(3)

        await sealAndVerify(context(storage), MASTER_KEY, 'm/a', bytes)

        expect(
            base64.decode(
                await openData(subtle, MASTER_KEY, storage.getString('m/a')!),
            ),
        ).toEqual(bytes)
    })

    // The dangerous case both revisions depend on catching: the write lands, so
    // the key looks occupied to the next run, but nothing can open it.
    it('throws when the write lands unreadable', async () => {
        const storage = fakeStorage({})
        const set = storage.set
        storage.set = key => set(key, 'truncated-ciphertext')

        await expect(
            sealAndVerify(
                context(storage),
                MASTER_KEY,
                'm/a',
                new Uint8Array(32),
            ),
        ).rejects.toThrow('did not read back')
    })

    it('throws when the write does not land at all', async () => {
        const storage = fakeStorage({})
        storage.set = () => {}

        await expect(
            sealAndVerify(
                context(storage),
                MASTER_KEY,
                'm/a',
                new Uint8Array(32),
            ),
        ).rejects.toThrow('did not read back')
    })
})

describe('holdsSameMaterial', () => {
    it('is true only when the sealed bytes match', async () => {
        const storage = fakeStorage({})
        const bytes = new Uint8Array(32).fill(3)
        await sealAndVerify(context(storage), MASTER_KEY, 'm/a', bytes)

        await expect(
            holdsSameMaterial(context(storage), MASTER_KEY, 'm/a', bytes),
        ).resolves.toBe(true)
        await expect(
            holdsSameMaterial(
                context(storage),
                MASTER_KEY,
                'm/a',
                new Uint8Array(32).fill(4),
            ),
        ).resolves.toBe(false)
    })

    it('is false for an absent or unopenable entry', async () => {
        const storage = fakeStorage({ 'm/b': 'not-a-sealed-payload' })

        await expect(
            holdsSameMaterial(
                context(storage),
                MASTER_KEY,
                'm/a',
                new Uint8Array(32),
            ),
        ).resolves.toBe(false)
        await expect(
            holdsSameMaterial(
                context(storage),
                MASTER_KEY,
                'm/b',
                new Uint8Array(32),
            ),
        ).resolves.toBe(false)
    })
})

describe('createJournal', () => {
    it('removes a key that did not exist before', () => {
        const storage = fakeStorage({})
        const journal = createJournal(storage)

        journal.set('m/a', 'written')
        journal.rollback()

        expect(storage.getString('m/a')).toBeUndefined()
    })

    it('restores the previous value of a key it overwrote', () => {
        const storage = fakeStorage({ 'm/a': 'original' })
        const journal = createJournal(storage)

        journal.set('m/a', 'written')
        journal.rollback()

        expect(storage.getString('m/a')).toBe('original')
    })

    // `Map.has`, not truthiness: an empty string is a value that was there and
    // has to come back, while `if (!prior)` would delete the key instead.
    it('restores an empty string rather than removing the key', () => {
        const storage = fakeStorage({ 'm/a': '' })
        const journal = createJournal(storage)

        journal.set('m/a', 'written')
        journal.rollback()

        expect(storage.getString('m/a')).toBe('')
    })

    // The first value seen is the one to restore; a key written twice must not
    // roll back to its intermediate state.
    it('restores the value from before the first write', () => {
        const storage = fakeStorage({ 'm/a': 'original' })
        const journal = createJournal(storage)

        journal.set('m/a', 'first')
        journal.set('m/a', 'second')
        journal.rollback()

        expect(storage.getString('m/a')).toBe('original')
    })

    // `track` exists for keys written by someone else — `sealAndVerify` — which
    // still have to be rolled back.
    it('rolls back a key it only tracked', () => {
        const storage = fakeStorage({ 'm/a': 'original' })
        const journal = createJournal(storage)

        journal.track('m/a')
        storage.set('m/a', 'written by someone else')
        journal.rollback()

        expect(storage.getString('m/a')).toBe('original')
    })
})

describe('placeSecrets', () => {
    it('gives each id its own bucket', () => {
        const a = new Uint8Array(32).fill(1)
        const b = new Uint8Array(32).fill(2)

        const placements = placeSecrets([
            { id: 'x', bytes: a },
            { id: 'y', bytes: b },
        ])

        expect(placements && [...placements.entries()]).toEqual([
            ['x', a],
            ['y', b],
        ])
    })

    // Identity, not equality: the same array reported twice is one secret.
    it('accepts the same array claiming a bucket twice', () => {
        const a = new Uint8Array(32).fill(1)

        expect(placeSecrets([{ id: 'x', bytes: a }], [['x', a]])).toBeDefined()
    })

    // Two different secrets and one bucket: refusing is what stops the second
    // being silently dropped.
    it('refuses two different secrets claiming one bucket', () => {
        expect(
            placeSecrets(
                [{ id: 'x', bytes: new Uint8Array(32).fill(2) }],
                [['x', new Uint8Array(32).fill(1)]],
            ),
        ).toBeUndefined()
    })

    it('equal-but-distinct arrays still count as two secrets', () => {
        expect(
            placeSecrets(
                [{ id: 'x', bytes: new Uint8Array(32).fill(1) }],
                [['x', new Uint8Array(32).fill(1)]],
            ),
        ).toBeUndefined()
    })
})

describe('wipeBytes', () => {
    it('zeroes in place and tolerates undefined', () => {
        const bytes = new Uint8Array(4).fill(9)

        wipeBytes(bytes)
        wipeBytes(undefined)

        expect([...bytes]).toEqual([0, 0, 0, 0])
    })
})
