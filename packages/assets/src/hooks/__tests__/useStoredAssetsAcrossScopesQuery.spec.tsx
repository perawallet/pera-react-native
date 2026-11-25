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

const mocks = vi.hoisted(() => ({ getAssetsByIds: vi.fn() }))

vi.mock('../../db', () => ({ getAssetsByIds: mocks.getAssetsByIds }))

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

        await waitFor(() => expect(result.current.size).toBe(2))
        expect(
            result.current.get('algorand/mainnet')?.get('31566704')?.unitName,
        ).toBe('USDC')
        expect(
            result.current.get('ethereum/mainnet')?.get('0xabc')?.unitName,
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

        expect(result.current.size).toBe(0)
        expect(mocks.getAssetsByIds).not.toHaveBeenCalled()
    })
})
