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
import { clearAllStores } from '@perawallet/wallet-core-shared'

const items = vi.hoisted(() => new Map<string, unknown>())
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getJSON: (key: string) => items.get(key) ?? null,
            setJSON: (key: string, value: unknown) => items.set(key, value),
            removeItem: (key: string) => items.delete(key),
        },
    }),
}))

import {
    clearProvisionalSeed,
    markSeedProvisional,
    provisionalSeedLockName,
    readProvisionalSeeds,
} from '../provisionalSeeds'

describe('provisional seeds', () => {
    beforeEach(() => {
        items.clear()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('remembers each marked seed once until it is cleared', async () => {
        await markSeedProvisional('seed-1')
        await markSeedProvisional('seed-1')
        await markSeedProvisional('seed-2')

        expect(readProvisionalSeeds()).toEqual(['seed-1', 'seed-2'])

        clearProvisionalSeed('seed-1')

        expect(readProvisionalSeeds()).toEqual(['seed-2'])
    })

    it("holds the seed's lock from the mark until it is cleared", async () => {
        const held = new Set<string>()
        let released!: Promise<void>
        vi.stubGlobal('navigator', {
            locks: {
                request: (name: string, callback: () => Promise<void>) => {
                    held.add(name)
                    released = callback().then(() => {
                        held.delete(name)
                    })
                    return released
                },
            },
        })
        const lockName = provisionalSeedLockName('seed-held')

        await markSeedProvisional('seed-held')
        expect(held.has(lockName)).toBe(true)

        clearProvisionalSeed('seed-held')
        await released
        expect(held.has(lockName)).toBe(false)
    })

    it('reads a malformed record as empty', () => {
        items.set('kms-provisional-seeds', { not: 'a list' })

        expect(readProvisionalSeeds()).toEqual([])
    })

    it('keeps only unique, nonempty IDs from an older marker array', () => {
        items.set('kms-provisional-seeds', [
            'seed-1',
            null,
            '',
            'seed-1',
            'seed-2',
        ])

        expect(readProvisionalSeeds()).toEqual(['seed-1', 'seed-2'])
    })

    it('forgets every marked seed when all stores are cleared', async () => {
        await markSeedProvisional('seed-1')

        clearAllStores()

        expect(readProvisionalSeeds()).toEqual([])
    })
})
