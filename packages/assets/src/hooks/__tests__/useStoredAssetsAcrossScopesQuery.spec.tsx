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

// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useStoredAssetsAcrossScopesQuery } from '../useStoredAssetsAcrossScopesQuery'
import { createWrapper } from './test-utils'

const ALGORAND = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETHEREUM = { chainId: 'ethereum', networkId: 'mainnet' } as const

const mocks = vi.hoisted(() => ({
    getAssetsByIds: vi.fn(),
    fetchAssetVerdicts: vi.fn(),
}))

vi.mock('../../db', () => ({ getAssetsByIds: mocks.getAssetsByIds }))
vi.mock('../../chain-adapter', () => ({
    fetchAssetVerdicts: mocks.fetchAssetVerdicts,
}))

describe('useStoredAssetsAcrossScopesQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
    })

    it('reads each scope once and maps the rows by scope key, then asset id', async () => {
        mocks.getAssetsByIds.mockImplementation(
            async ({ scope }: { scope: { chainId: string } }) =>
                scope.chainId === 'algorand'
                    ? [{ assetId: '31566704', unitName: 'USDC' }]
                    : [{ assetId: '0xabc', unitName: 'DAI' }],
        )

        const { result } = renderHook(
            () =>
                useStoredAssetsAcrossScopesQuery([
                    { scope: ALGORAND, assetIds: ['31566704', '31566704'] },
                    { scope: ETHEREUM, assetIds: ['0xabc'] },
                ]),
            { wrapper: createWrapper(queryClient) },
        )

        await waitFor(() => expect(result.current.assets.size).toBe(2))
        expect(
            result.current.assets.get('algorand/mainnet')?.get('31566704')
                ?.unitName,
        ).toBe('USDC')
        expect(
            result.current.assets.get('ethereum/mainnet')?.get('0xabc')
                ?.unitName,
        ).toBe('DAI')
        expect(mocks.getAssetsByIds).toHaveBeenCalledTimes(2)
        expect(mocks.getAssetsByIds).toHaveBeenCalledWith({
            assetIds: ['31566704'],
            scope: ALGORAND,
        })
    })

    it('reads nothing when no scope names an asset', () => {
        const { result } = renderHook(
            () =>
                useStoredAssetsAcrossScopesQuery([
                    { scope: ALGORAND, assetIds: [] },
                ]),
            { wrapper: createWrapper(queryClient) },
        )

        expect(result.current.assets.size).toBe(0)
        expect(mocks.getAssetsByIds).not.toHaveBeenCalled()
    })

    it('counts an id the DB lacks as read, and asks nothing, without fetchMissingTiers', async () => {
        mocks.getAssetsByIds.mockResolvedValue([])

        const { result } = renderHook(
            () =>
                useStoredAssetsAcrossScopesQuery([
                    { scope: ETHEREUM, assetIds: ['0xabc'] },
                ]),
            { wrapper: createWrapper(queryClient) },
        )

        await waitFor(() =>
            expect(
                result.current.readIds.get('ethereum/mainnet')?.has('0xabc'),
            ).toBe(true),
        )
        expect(mocks.fetchAssetVerdicts).not.toHaveBeenCalled()
    })

    it('asks about only the ids the DB lacks', async () => {
        mocks.getAssetsByIds.mockResolvedValue([{ assetId: '0xabc' }])
        mocks.fetchAssetVerdicts.mockResolvedValue(
            new Map([['0xdef', { verificationTier: 'verified' }]]),
        )

        const { result } = renderHook(
            () =>
                useStoredAssetsAcrossScopesQuery(
                    [
                        {
                            scope: ETHEREUM,
                            assetIds: ['0xabc', '0xdef', '0xfff'],
                        },
                    ],
                    { fetchMissingTiers: true },
                ),
            { wrapper: createWrapper(queryClient) },
        )

        await waitFor(() =>
            expect(
                result.current.unstoredVerdicts
                    .get('ethereum/mainnet')
                    ?.get('0xdef'),
            ).toEqual({ verificationTier: 'verified' }),
        )
        expect(mocks.fetchAssetVerdicts).toHaveBeenCalledWith(
            ['0xdef', '0xfff'],
            ETHEREUM,
        )
        expect([...result.current.readIds.get('ethereum/mainnet')!]).toEqual([
            '0xabc',
            '0xdef',
            '0xfff',
        ])
    })

    it('leaves the unstored ids unread when the lookup fails, or the chain has none', async () => {
        mocks.getAssetsByIds.mockResolvedValue([{ assetId: '0xabc' }])
        mocks.fetchAssetVerdicts
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce(null)

        for (const assetIds of [
            ['0xabc', '0xdef'],
            ['0xabc', '0xeee'],
        ]) {
            const { result } = renderHook(
                () =>
                    useStoredAssetsAcrossScopesQuery(
                        [{ scope: ETHEREUM, assetIds }],
                        { fetchMissingTiers: true },
                    ),
                { wrapper: createWrapper(queryClient) },
            )

            await waitFor(() => expect(result.current.assets.size).toBe(1))
            expect([
                ...result.current.readIds.get('ethereum/mainnet')!,
            ]).toEqual(['0xabc'])
        }
    })

    it('leaves a failed lookup stale, so the next refetch asks again, and settles once it answers', async () => {
        mocks.getAssetsByIds.mockResolvedValue([])
        mocks.fetchAssetVerdicts
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce(new Map())
        const isStale = () => queryClient.getQueryCache().getAll()[0]!.isStale()

        const { result } = renderHook(
            () =>
                useStoredAssetsAcrossScopesQuery(
                    [{ scope: ETHEREUM, assetIds: ['0xdef'] }],
                    { fetchMissingTiers: true },
                ),
            { wrapper: createWrapper(queryClient) },
        )
        await waitFor(() =>
            expect(result.current.readIds.get('ethereum/mainnet')).toEqual(
                new Set(),
            ),
        )
        expect(isStale()).toBe(true)
        await queryClient.refetchQueries({ stale: true })

        await waitFor(() =>
            expect(
                result.current.readIds.get('ethereum/mainnet')?.has('0xdef'),
            ).toBe(true),
        )
        expect(isStale()).toBe(false)
    })

    it('keeps the last answer while a grown id list loads', async () => {
        let release: () => void = () => {}
        mocks.getAssetsByIds.mockResolvedValueOnce([{ assetId: '0xabc' }])
        mocks.getAssetsByIds.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    release = () =>
                        resolve([{ assetId: '0xabc' }, { assetId: '0xdef' }])
                }),
        )

        const { result, rerender } = renderHook(
            ({ assetIds }: { assetIds: string[] }) =>
                useStoredAssetsAcrossScopesQuery([
                    { scope: ETHEREUM, assetIds },
                ]),
            {
                wrapper: createWrapper(queryClient),
                initialProps: { assetIds: ['0xabc'] },
            },
        )
        await waitFor(() => expect(result.current.assets.size).toBe(1))

        rerender({ assetIds: ['0xabc', '0xdef'] })

        expect(
            result.current.readIds.get('ethereum/mainnet')?.has('0xabc'),
        ).toBe(true)
        expect(
            result.current.readIds.get('ethereum/mainnet')?.has('0xdef'),
        ).toBe(false)
        release()
        await waitFor(() =>
            expect(
                result.current.readIds.get('ethereum/mainnet')?.has('0xdef'),
            ).toBe(true),
        )
    })
})
