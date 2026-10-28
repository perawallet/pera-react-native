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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    migrations,
    runMigrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import { assessSiteSafety } from '../assess'
import { countGenerationRows } from '../db/repository'
import { ensurePhishingListsSeeded } from '../seed'
import { usePhishingListStore } from '../store/store'
import { findPhishingListedAddresses } from '../listedAddresses'
import { BUNDLED_SCAM_ADDRESS, FIXTURE_SNAPSHOT } from './fixtures'

const database = vi.hoisted(() => ({ current: null as Database | null }))
vi.mock('@perawallet/wallet-core-database', async importOriginal => ({
    ...(await importOriginal<object>()),
    getDatabase: () => database.current,
}))

describe('ensurePhishingListsSeeded', () => {
    let teardown: () => void
    const loadSnapshot = vi.fn(async () => FIXTURE_SNAPSHOT)

    beforeEach(async () => {
        const test = createTestDatabase()
        database.current = test.db
        teardown = test.teardown
        await runMigrations(test.db, migrations)
        usePhishingListStore.getState().resetState()
        loadSnapshot.mockClear()
    })

    afterEach(() => teardown())

    it('uses the lists that ship with the app on a first launch with no network', async () => {
        await ensurePhishingListsSeeded({ loadSnapshot })

        expect(usePhishingListStore.getState().sources).toMatchObject({
            metamask: { origin: 'bundled', refreshedAt: 0 },
            polkadot: { origin: 'bundled', refreshedAt: 0 },
        })
        expect(
            await assessSiteSafety({ urls: ['https://bundled-phish.example'] }),
        ).toEqual({
            kind: 'blocked',
            host: 'bundled-phish.example',
            reason: 'phishing-list',
        })
    })

    it('lets a check wait for a seed already running in this context', async () => {
        let release: () => void = () => {}
        const gate = new Promise<void>(resolve => {
            release = resolve
        })
        const seeding = ensurePhishingListsSeeded({
            loadSnapshot: async () => {
                await gate
                return FIXTURE_SNAPSHOT
            },
        })

        const verdict = assessSiteSafety({
            urls: ['https://bundled-phish.example'],
        })
        release()
        await seeding

        expect(await verdict).toMatchObject({ kind: 'blocked' })
    })

    it('never seeds from a check, so a reading context cannot replace the writer’s copy', async () => {
        expect(
            await assessSiteSafety({ urls: ['https://bundled-phish.example'] }),
        ).toEqual({ kind: 'clear' })
        expect(usePhishingListStore.getState().sources).toEqual({})
    })

    it('seeds the bundled scam addresses and counts them as the darklist’s rows', async () => {
        await ensurePhishingListsSeeded({ loadSnapshot })

        const darklist = usePhishingListStore.getState().sources['mew-darklist']
        expect(darklist).toMatchObject({ origin: 'bundled' })
        expect(
            await countGenerationRows({
                source: 'mew-darklist',
                generation: darklist!.generation,
            }),
        ).toBe(1)
        expect(
            await findPhishingListedAddresses([BUNDLED_SCAM_ADDRESS]),
        ).toEqual([BUNDLED_SCAM_ADDRESS.toLowerCase()])
    })

    it('does not reseed lists that already have rows', async () => {
        await ensurePhishingListsSeeded({ loadSnapshot })
        const seeded = usePhishingListStore.getState().sources

        await ensurePhishingListsSeeded({ loadSnapshot })

        expect(loadSnapshot).toHaveBeenCalledTimes(1)
        expect(usePhishingListStore.getState().sources).toEqual(seeded)
    })

    it('reseeds a source whose active copy has no rows', async () => {
        usePhishingListStore.getState().activateGeneration('metamask', {
            generation: 1,
            refreshedAt: 5,
            origin: 'downloaded',
        })

        await ensurePhishingListsSeeded({ loadSnapshot })

        const { generation } = usePhishingListStore.getState().sources.metamask!
        expect(generation).not.toBe(1)
        expect(
            await countGenerationRows({ source: 'metamask', generation }),
        ).toBeGreaterThan(0)
    })

    it('reseeds after a wipe resets the store', async () => {
        await ensurePhishingListsSeeded({ loadSnapshot })
        usePhishingListStore.getState().resetState()

        await ensurePhishingListsSeeded({ loadSnapshot })

        expect(loadSnapshot).toHaveBeenCalledTimes(2)
    })

    it('shares one seed between concurrent callers', async () => {
        await Promise.all([
            ensurePhishingListsSeeded({ loadSnapshot }),
            ensurePhishingListsSeeded({ loadSnapshot }),
        ])

        expect(loadSnapshot).toHaveBeenCalledTimes(1)
    })
})
