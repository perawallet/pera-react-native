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

import { renderHook, waitFor } from '@testing-library/react'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-shared'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { ALGORAND_ZERO_ADDRESS_STRING } from 'algosdk'

import { useAssetChainRolesQuery } from '../useAssetChainRolesQuery'
import { createWrapper } from './test-utils'

const FREEZE_ADDRESS = 'FREEZEADDRESS'
const CLAWBACK_ADDRESS = 'CLAWBACKADDRESS'

const mocks = vi.hoisted(() => ({
    fetchIndexerAssetDetails: vi.fn(),
    useNetwork: vi.fn(),
}))

// Reaches for the source file rather than the package root: importing the
// built package here drags in react-native-mmkv, which has no node build.
// isZeroAddress stays real — the zero-address case below is the point.
vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const { isZeroAddress } =
        await import('../../../../blockchain/src/utils/addresses')
    return { isZeroAddress, useNetwork: mocks.useNetwork }
})

vi.mock('../../api', async importOriginal => {
    const actual = await importOriginal<typeof import('../../api')>()
    return {
        ...actual,
        fetchIndexerAssetDetails: mocks.fetchIndexerAssetDetails,
    }
})

const indexerResponse = (params: Record<string, unknown>) => ({
    asset: { index: 123, params },
    'current-round': 1,
})

describe('useAssetChainRolesQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.useNetwork.mockReturnValue({ network: 'mainnet' })
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
    })

    const render = (assetId: string) =>
        renderHook(() => useAssetChainRolesQuery(assetId), {
            wrapper: createWrapper(queryClient),
        })

    it('reports both roles present when the asset carries both addresses', async () => {
        mocks.fetchIndexerAssetDetails.mockResolvedValue(
            indexerResponse({
                freeze: FREEZE_ADDRESS,
                clawback: CLAWBACK_ADDRESS,
            }),
        )

        const { result } = render('123')

        await waitFor(() => {
            expect(result.current.data).toEqual({
                hasFreeze: true,
                hasClawback: true,
            })
        })
    })

    it('reports no roles when the addresses are absent', async () => {
        mocks.fetchIndexerAssetDetails.mockResolvedValue(indexerResponse({}))

        const { result } = render('123')

        await waitFor(() => {
            expect(result.current.data).toEqual({
                hasFreeze: false,
                hasClawback: false,
            })
        })
    })

    it('treats the zero address as an unassigned role', async () => {
        mocks.fetchIndexerAssetDetails.mockResolvedValue(
            indexerResponse({
                freeze: ALGORAND_ZERO_ADDRESS_STRING,
                clawback: CLAWBACK_ADDRESS,
            }),
        )

        const { result } = render('123')

        await waitFor(() => {
            expect(result.current.data).toEqual({
                hasFreeze: false,
                hasClawback: true,
            })
        })
    })

    it('stays null when the lookup fails, rather than claiming "no freeze"', async () => {
        mocks.fetchIndexerAssetDetails.mockRejectedValue(new Error('offline'))

        const { result } = render('123')

        await waitFor(() => {
            expect(result.current.isError).toBe(true)
        })
        expect(result.current.data).toBeNull()
    })

    it('answers for ALGO without hitting the indexer', () => {
        const { result } = render(ALGO_ASSET_ID)

        expect(result.current.data).toEqual({
            hasFreeze: false,
            hasClawback: false,
        })
        expect(result.current.isPending).toBe(false)
        expect(mocks.fetchIndexerAssetDetails).not.toHaveBeenCalled()
    })
})
