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
    readProvisionalSeeds,
} from '../provisionalSeeds'

describe('provisional seeds', () => {
    beforeEach(() => {
        items.clear()
    })

    it('remembers each marked seed once until it is cleared', () => {
        markSeedProvisional('seed-1')
        markSeedProvisional('seed-1')
        markSeedProvisional('seed-2')

        expect(readProvisionalSeeds()).toEqual(['seed-1', 'seed-2'])

        clearProvisionalSeed('seed-1')

        expect(readProvisionalSeeds()).toEqual(['seed-2'])
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

    it('forgets every marked seed when all stores are cleared', () => {
        markSeedProvisional('seed-1')

        clearAllStores()

        expect(readProvisionalSeeds()).toEqual([])
    })
})
