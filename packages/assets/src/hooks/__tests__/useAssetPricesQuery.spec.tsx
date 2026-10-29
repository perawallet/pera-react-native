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
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useAssetPricesQuery } from '../useAssetPricesQuery'
import { Decimal } from 'decimal.js'
import { createWrapper } from './test-utils'
import { QueryClient, onlineManager } from '@tanstack/react-query'

const ALGORAND_MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const
const ALGORAND_TESTNET = { chainId: 'algorand', networkId: 'testnet' } as const
const ETHEREUM_SEPOLIA = { chainId: 'ethereum', networkId: 'sepolia' } as const

const NATIVE_ASSET_ID = '0'

const mocks = vi.hoisted(() => ({
    getAssetPricesByIds: vi.fn(),
}))

vi.mock('../../db', () => ({
    getAssetPricesByIds: mocks.getAssetPricesByIds,
}))

describe('useAssetPricesQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getAssetPricesByIds.mockReturnValue([])
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
    })

    afterEach(() => {
        // Restore the global onlineManager singleton so offline state set by a
        // test can't leak into subsequent tests.
        onlineManager.setOnline(true)
    })

    it.each([ALGORAND_MAINNET, ETHEREUM_SEPOLIA])(
        'serves prices from SQLite while offline for $chainId',
        async scope => {
            onlineManager.setOnline(false)

            mocks.getAssetPricesByIds.mockReturnValue([
                { assetId: '123', usdPrice: new Decimal('2.0') },
            ])

            const { result } = renderHook(
                () => useAssetPricesQuery(scope, ['123']),
                {
                    wrapper: createWrapper(queryClient),
                },
            )

            await waitFor(() => expect(result.current.isPending).toBe(false))

            expect(result.current.data.get('123')?.usdPrice).toEqual(
                new Decimal(2.0),
            )
            expect(mocks.getAssetPricesByIds).toHaveBeenCalledWith({
                assetIds: ['123'],
                scope,
            })
        },
    )

    it('reads prices from the database and transforms them', async () => {
        mocks.getAssetPricesByIds.mockReturnValue([
            { assetId: '123', usdPrice: new Decimal('2.0') },
            { assetId: NATIVE_ASSET_ID, usdPrice: new Decimal('1.5') },
        ])

        const { result } = renderHook(
            () => useAssetPricesQuery(ALGORAND_MAINNET, ['123']),
            {
                wrapper: createWrapper(queryClient),
            },
        )

        expect(result.current.isPending).toBe(true)
        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.data.size).toBe(2)
        expect(result.current.data.get(NATIVE_ASSET_ID)?.usdPrice).toEqual(
            new Decimal(1.5),
        )
        expect(result.current.data.get('123')?.usdPrice).toEqual(
            new Decimal(2.0),
        )
    })

    it('handles assets with zero usd_value', async () => {
        mocks.getAssetPricesByIds.mockReturnValue([
            { assetId: '456', usdPrice: new Decimal('0') },
        ])

        const { result } = renderHook(
            () => useAssetPricesQuery(ALGORAND_MAINNET, ['456']),
            {
                wrapper: createWrapper(queryClient),
            },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.data.get('456')?.usdPrice).toEqual(new Decimal(0))
    })

    it('does not refetch when ids reference changes but content is the same', async () => {
        mocks.getAssetPricesByIds.mockReturnValue([
            { assetId: '123', usdPrice: new Decimal('2.0') },
        ])

        const { result, rerender } = renderHook(
            ({ ids }: { ids: string[] }) =>
                useAssetPricesQuery(ALGORAND_MAINNET, ids),
            {
                wrapper: createWrapper(queryClient),
                initialProps: { ids: ['123'] },
            },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        const callCount = mocks.getAssetPricesByIds.mock.calls.length

        // Rerender with a new array reference containing the same content
        rerender({ ids: ['123'] })

        expect(mocks.getAssetPricesByIds.mock.calls.length).toBe(callCount)
    })

    it('refetches when ids content actually changes', async () => {
        mocks.getAssetPricesByIds.mockReturnValue([
            { assetId: '123', usdPrice: new Decimal('2.0') },
        ])

        const { result, rerender } = renderHook(
            ({ ids }: { ids: string[] }) =>
                useAssetPricesQuery(ALGORAND_MAINNET, ids),
            {
                wrapper: createWrapper(queryClient),
                initialProps: { ids: ['123'] },
            },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        mocks.getAssetPricesByIds.mockClear()

        mocks.getAssetPricesByIds.mockReturnValue([
            { assetId: '456', usdPrice: new Decimal('3.0') },
        ])

        rerender({ ids: ['456'] })

        await waitFor(() =>
            expect(mocks.getAssetPricesByIds).toHaveBeenCalledWith({
                assetIds: ['456'],
                scope: ALGORAND_MAINNET,
            }),
        )
    })

    it('refetches when the scope changes', async () => {
        mocks.getAssetPricesByIds.mockReturnValue([
            { assetId: '123', usdPrice: new Decimal('2.0') },
        ])

        const { result, rerender } = renderHook(
            ({
                scope,
            }: {
                scope: typeof ALGORAND_MAINNET | typeof ALGORAND_TESTNET
            }) => useAssetPricesQuery(scope, ['123']),
            {
                wrapper: createWrapper(queryClient),
                initialProps: { scope: ALGORAND_MAINNET },
            },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        mocks.getAssetPricesByIds.mockClear()

        rerender({ scope: ALGORAND_TESTNET })

        await waitFor(() =>
            expect(mocks.getAssetPricesByIds).toHaveBeenCalledWith({
                assetIds: ['123'],
                scope: ALGORAND_TESTNET,
            }),
        )
    })

    it('respects the enabled parameter', () => {
        const { result } = renderHook(
            () => useAssetPricesQuery(ALGORAND_MAINNET, ['123'], false),
            {
                wrapper: createWrapper(queryClient),
            },
        )

        expect(mocks.getAssetPricesByIds).not.toHaveBeenCalled()
        expect(result.current.isPending).toBe(false)
    })
})
