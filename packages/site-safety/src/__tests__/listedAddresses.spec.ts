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
import { logger } from '@perawallet/wallet-core-shared'
import {
    migrations,
    runMigrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import { writePhishingListGeneration } from '../db/repository'
import { findPhishingListedAddresses } from '../listedAddresses'
import { usePhishingListStore } from '../store/store'

const database = vi.hoisted(() => ({ current: null as Database | null }))
vi.mock('@perawallet/wallet-core-database', async importOriginal => ({
    ...(await importOriginal<object>()),
    getDatabase: () => database.current,
}))

const SCAM = '0x09750ad360fdb7A2ee23669C4503c974D86D8694'
const OLD_SCAM = '0x00000000000000000000000000000000000000aa'
const CLEAN = '0x00000000000000000000000000000000000000bb'

const writeGeneration = (generation: number, addresses: string[]) =>
    writePhishingListGeneration({
        source: 'mew-darklist',
        generation,
        entries: { deny: [], allow: [], impersonationTargets: [], addresses },
    })

describe('findPhishingListedAddresses', () => {
    let teardown: () => void

    beforeEach(async () => {
        const test = createTestDatabase()
        database.current = test.db
        teardown = test.teardown
        await runMigrations(test.db, migrations)
        usePhishingListStore.getState().resetState()
        await writeGeneration(1, [OLD_SCAM.toLowerCase()])
        await writeGeneration(2, [SCAM.toLowerCase()])
        usePhishingListStore.getState().activateGeneration('mew-darklist', {
            generation: 2,
            refreshedAt: 1,
            origin: 'downloaded',
        })
    })

    afterEach(() => teardown())

    it('finds a listed address whatever its letter case', async () => {
        expect(
            await findPhishingListedAddresses([SCAM.toUpperCase(), CLEAN]),
        ).toEqual([SCAM.toLowerCase()])
    })

    it('ignores entries of a copy that is no longer active', async () => {
        expect(await findPhishingListedAddresses([OLD_SCAM])).toEqual([])
    })

    it('logs a failed read and lets the caller retry', async () => {
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
        teardown()
        teardown = () => {}

        await expect(findPhishingListedAddresses([SCAM])).rejects.toThrow()
        expect(warn).toHaveBeenCalledWith(
            '[site-safety] scam address lookup failed',
            expect.objectContaining({ error: expect.anything() }),
        )
        warn.mockRestore()
    })

    it('answers an empty request without reading the lists', async () => {
        expect(await findPhishingListedAddresses([])).toEqual([])
    })
})
