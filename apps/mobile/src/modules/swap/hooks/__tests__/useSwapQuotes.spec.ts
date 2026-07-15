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

import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'

const mockCreateQuotes = vi.fn()
const mockResetQuoteMutation = vi.fn()
let mockIsQuoteMutationError = false
let mockAssetsQueryResult: {
    data: Map<string, unknown>
    isPending: boolean
    isFetched: boolean
    isRefetching: boolean
    isError: boolean
}

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'testnet' }),
    displayUnitsToBaseUnits: (amount: Decimal, decimals: number) =>
        amount.mul(new Decimal(10).pow(decimals)),
}))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    percentToApiSlippage: (value: string) => value,
    useCreateQuotesMutation: () => ({
        mutateAsync: mockCreateQuotes,
        isPending: false,
        isError: mockIsQuoteMutationError,
        reset: mockResetQuoteMutation,
    }),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => 'device-1',
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        useDebouncedValue: <T>(value: T) => value,
    }
})

const mockUseAssetsQuery = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: mockUseAssetsQuery,
}))

import { useSwapQuotes } from '../useSwapQuotes'

const makeAssetsResult = (ids: string[]) => ({
    data: new Map(ids.map(id => [id, { assetId: id }])),
    isPending: false,
    isFetched: true,
    isRefetching: false,
    isError: false,
})

const baseParams = {
    swapperAddress: 'SWAPPER',
    fromAssetId: '0',
    toAssetId: '31566704',
    payAmount: new Decimal(1),
    payDecimals: 6,
}

describe('useSwapQuotes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockIsQuoteMutationError = false
        mockAssetsQueryResult = makeAssetsResult(['0', '31566704'])
        mockUseAssetsQuery.mockImplementation(() => mockAssetsQueryResult)
        mockCreateQuotes.mockResolvedValue([])
    })

    it('fetches quotes for a valid pair', async () => {
        renderHook(() => useSwapQuotes(baseParams))

        await waitFor(() => expect(mockCreateQuotes).toHaveBeenCalledTimes(1))
        expect(mockCreateQuotes).toHaveBeenCalledWith(
            expect.objectContaining({
                asset_in_id: 0,
                asset_out_id: 31_566_704,
            }),
        )
    })

    it('treats a quote 404 as terminal for the current pair', async () => {
        mockCreateQuotes.mockRejectedValue({ response: { status: 404 } })

        const { rerender } = renderHook(
            (props: typeof baseParams) => useSwapQuotes(props),
            { initialProps: baseParams },
        )

        await waitFor(() => expect(mockCreateQuotes).toHaveBeenCalledTimes(1))

        rerender({ ...baseParams, payAmount: new Decimal(2) })
        rerender({ ...baseParams, payAmount: new Decimal(3) })

        expect(mockCreateQuotes).toHaveBeenCalledTimes(1)
    })

    it('surfaces a terminal 404 as a quote error with the spinner off', async () => {
        mockCreateQuotes.mockRejectedValue({ response: { status: 404 } })

        const { result } = renderHook(() => useSwapQuotes(baseParams))

        await waitFor(() => expect(mockCreateQuotes).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(result.current.isQuoteError).toBe(true))
        expect(result.current.isQuoteFetching).toBe(false)
    })

    it('reset() clears the terminal 404 so the pair can be quoted again', async () => {
        mockCreateQuotes.mockRejectedValue({ response: { status: 404 } })

        const { result } = renderHook(() => useSwapQuotes(baseParams))
        await waitFor(() => expect(mockCreateQuotes).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(result.current.isQuoteError).toBe(true))

        mockCreateQuotes.mockResolvedValue([])
        act(() => result.current.reset())

        expect(result.current.isQuoteError).toBe(false)
        await waitFor(() => expect(mockCreateQuotes).toHaveBeenCalledTimes(2))
        await waitFor(() => expect(result.current.isQuoteError).toBe(false))
    })

    it('does not resolve pair assets while quoting is disabled', () => {
        renderHook(() => useSwapQuotes({ ...baseParams, enabled: false }))

        expect(mockUseAssetsQuery).toHaveBeenCalledWith(
            [],
            expect.objectContaining({ fetchMissing: true }),
        )
        expect(mockCreateQuotes).not.toHaveBeenCalled()
    })

    it('quotes again once the pair changes after a 404', async () => {
        mockCreateQuotes.mockRejectedValue({ response: { status: 404 } })

        const { rerender } = renderHook(
            (props: typeof baseParams) => useSwapQuotes(props),
            { initialProps: baseParams },
        )
        await waitFor(() => expect(mockCreateQuotes).toHaveBeenCalledTimes(1))

        mockAssetsQueryResult = makeAssetsResult(['0', '999'])
        rerender({ ...baseParams, toAssetId: '999' })

        await waitFor(() => expect(mockCreateQuotes).toHaveBeenCalledTimes(2))
    })

    it('retries the same pair after a non-404 failure', async () => {
        mockCreateQuotes.mockRejectedValue({ response: { status: 500 } })

        const { rerender } = renderHook(
            (props: typeof baseParams) => useSwapQuotes(props),
            { initialProps: baseParams },
        )
        await waitFor(() => expect(mockCreateQuotes).toHaveBeenCalledTimes(1))

        rerender({ ...baseParams, payAmount: new Decimal(2) })

        await waitFor(() => expect(mockCreateQuotes).toHaveBeenCalledTimes(2))
    })

    it('does not quote a pair with an asset missing on the active network', async () => {
        mockAssetsQueryResult = makeAssetsResult(['0'])

        const { result } = renderHook(() => useSwapQuotes(baseParams))

        await waitFor(() => expect(result.current.isQuoteError).toBe(true))
        expect(mockCreateQuotes).not.toHaveBeenCalled()
        expect(result.current.isQuoteFetching).toBe(false)
    })

    it('clears previously fetched quotes when the pair leaves the network', async () => {
        const quote = { quote_id: 'q1' }
        mockCreateQuotes.mockResolvedValue([quote])

        const { result, rerender } = renderHook(() => useSwapQuotes(baseParams))
        await waitFor(() => expect(result.current.allQuotes).toEqual([quote]))

        // Network switch: the persisted pair no longer resolves, so the old
        // quotes must not stay actionable next to the error banner.
        mockAssetsQueryResult = makeAssetsResult(['0'])
        rerender()

        await waitFor(() => expect(result.current.isQuoteError).toBe(true))
        expect(result.current.allQuotes).toEqual([])
        expect(result.current.quotedAmount).toBeNull()
    })

    it('waits for the pair check before quoting', () => {
        mockAssetsQueryResult = {
            data: new Map(),
            isPending: true,
            isFetched: false,
            isRefetching: false,
            isError: false,
        }

        const { result } = renderHook(() => useSwapQuotes(baseParams))

        expect(mockCreateQuotes).not.toHaveBeenCalled()
        expect(result.current.isQuoteError).toBe(false)
    })
})
