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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const upsertAssetsMock = vi.hoisted(() => vi.fn())
const getAssetsByIdsMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    critical: vi.fn(),
}))

vi.mock('../../db', () => ({
    upsertAssets: upsertAssetsMock,
    getAssetsByIds: getAssetsByIdsMock,
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        logger: loggerMock,
    }
})

import {
    getAssetsFromDb,
    persistAssetsToDb,
    useAssetsDbSync,
} from '../useAssetsDb'
import type { PeraAsset } from '../../models'

const makeAsset = (id: string): PeraAsset =>
    ({
        assetId: id,
        name: `asset-${id}`,
    }) as PeraAsset

describe('getAssetsFromDb', () => {
    beforeEach(() => {
        upsertAssetsMock.mockReset()
        getAssetsByIdsMock.mockReset()
        loggerMock.warn.mockReset()
    })

    test('returns a Map keyed by assetId', async () => {
        getAssetsByIdsMock.mockResolvedValue([makeAsset('1'), makeAsset('2')])

        const result = await getAssetsFromDb(['1', '2'], 'mainnet')

        expect(getAssetsByIdsMock).toHaveBeenCalledWith({
            assetIds: ['1', '2'],
            network: 'mainnet',
        })
        expect(result.get('1')?.assetId).toBe('1')
        expect(result.get('2')?.assetId).toBe('2')
    })

    test('returns an empty Map and warns when the DB read throws', async () => {
        getAssetsByIdsMock.mockRejectedValue(new Error('db unavailable'))

        const result = await getAssetsFromDb(['1'], 'mainnet')

        expect(result.size).toBe(0)
        expect(loggerMock.warn).toHaveBeenCalledWith(
            'Failed to read cached assets from database',
            expect.objectContaining({ error: expect.any(Error) }),
        )
    })
})

describe('persistAssetsToDb', () => {
    beforeEach(() => {
        upsertAssetsMock.mockReset()
        loggerMock.warn.mockReset()
    })

    test('delegates to upsertAssets with items and network', async () => {
        const items = [makeAsset('1')]
        await persistAssetsToDb(items, 'testnet')

        expect(upsertAssetsMock).toHaveBeenCalledWith({
            items,
            network: 'testnet',
        })
    })

    test('swallows DB failures and logs a warning', async () => {
        upsertAssetsMock.mockRejectedValue(new Error('write failed'))

        await expect(
            persistAssetsToDb([makeAsset('1')], 'testnet'),
        ).resolves.toBeUndefined()

        expect(loggerMock.warn).toHaveBeenCalledWith(
            'Failed to persist assets to database',
            expect.objectContaining({ error: expect.any(Error) }),
        )
    })
})

describe('useAssetsDbSync', () => {
    beforeEach(() => {
        upsertAssetsMock.mockReset()
        upsertAssetsMock.mockResolvedValue(undefined)
    })

    test('persists fetched assets when fetch completes with results', () => {
        const fetched = new Map<string, PeraAsset>([['1', makeAsset('1')]])

        renderHook(() => useAssetsDbSync(fetched, true, 'mainnet'))

        expect(upsertAssetsMock).toHaveBeenCalledWith({
            items: [makeAsset('1')],
            network: 'mainnet',
        })
    })

    test('does not persist while fetch is still pending', () => {
        const fetched = new Map<string, PeraAsset>([['1', makeAsset('1')]])

        renderHook(() => useAssetsDbSync(fetched, false, 'mainnet'))

        expect(upsertAssetsMock).not.toHaveBeenCalled()
    })

    test('does not persist when the fetched Map is empty', () => {
        renderHook(() => useAssetsDbSync(new Map(), true, 'mainnet'))

        expect(upsertAssetsMock).not.toHaveBeenCalled()
    })
})
