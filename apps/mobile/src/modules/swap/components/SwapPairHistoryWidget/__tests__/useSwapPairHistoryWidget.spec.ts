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

import type { ReactElement } from 'react'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SwapHistoryPair } from '@perawallet/wallet-core-swaps'
import { SwapEvent, AnalyticsMetadataKey } from '@analytics'
import { SwapHistoryContent } from '@modules/swap/components/SwapHistoryContent'
import { useSwapPairHistoryWidget } from '../useSwapPairHistoryWidget'

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

const {
    mockTrackEvent,
    mockSetAccountPair,
    mockSetSelectedAccountId,
    mockRequestBottomSheet,
    state,
} = vi.hoisted(() => ({
    mockTrackEvent: vi.fn(),
    mockSetAccountPair: vi.fn(),
    mockSetSelectedAccountId: vi.fn(),
    mockRequestBottomSheet: vi.fn(),
    state: {
        names: {
            names: [] as { accountId: string; name: string }[],
            isMultiAccount: false,
        },
        recent: {
            pairs: [] as SwapHistoryPair[],
            isLoading: false,
            isError: false,
            isEnabled: true,
        },
        sourceChainIds: ['algorand', 'ethereum'] as string[],
    },
}))

vi.mock('@analytics', async importOriginal => ({
    ...(await importOriginal<typeof import('@analytics')>()),
    trackEvent: mockTrackEvent,
}))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useSwapsStore: (select: (store: unknown) => unknown) =>
        select({ setAccountPair: mockSetAccountPair }),
    useRecentSwapPairsQuery: () => state.recent,
    useSwapSigningAccounts: () => [],
    useSwapAccountNames: () => state.names,
    useSwapSourceChainsByAccount: () => ({
        sourceChainIds: state.sourceChainIds,
    }),
    scopeOfSwapAsset: (ref: { chainId: string; networkId: string }) => ({
        chainId: ref.chainId,
        networkId: ref.networkId,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccountId: () => ({
        setSelectedAccountId: mockSetSelectedAccountId,
    }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequestBottomSheet }),
}))

vi.mock('@modules/swap/components/SwapHistoryContent', () => ({
    SwapHistoryContent: () => null,
}))

const ADDRESS = 'TESTADDRESS123'

const assetOn = (assetId: string, unitName: string) => ({
    assetId,
    ref: { ...SCOPE, assetId },
    unitName,
})

const pairPaidBy = (accountId: string) =>
    ({
        assetIn: assetOn('0', 'ALGO'),
        assetOut: assetOn('31566704', 'USDC'),
        sourceAccount: { scope: SCOPE, address: ADDRESS },
        swapDatetime: '2026-10-01T00:00:00Z',
        pairKey: 'algorand/0|algorand/31566704',
        accountId,
    }) as unknown as SwapHistoryPair

describe('useSwapPairHistoryWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        state.names = {
            names: [
                { accountId: 'main', name: 'Main' },
                { accountId: 'other', name: 'Savings' },
            ],
            isMultiAccount: true,
        }
        state.recent = {
            pairs: [],
            isLoading: false,
            isError: false,
            isEnabled: true,
        }
        state.sourceChainIds = ['algorand', 'ethereum']
    })

    it('passes through the recent pairs and their state', () => {
        const pair = pairPaidBy('main')
        state.recent = {
            pairs: [pair],
            isLoading: true,
            isError: true,
            isEnabled: false,
        }

        const { result } = renderHook(() => useSwapPairHistoryWidget(SCOPE))

        expect(result.current).toMatchObject({
            pairs: [pair],
            isLoading: true,
            isError: true,
            isEnabled: false,
        })
    })

    it('restores the pair on the account that paid for it, leaving the selected account', () => {
        const { result } = renderHook(() => useSwapPairHistoryWidget(SCOPE))

        act(() => result.current.handlePairPress(pairPaidBy('other')))

        expect(mockSetAccountPair).toHaveBeenCalledWith({
            accountId: 'other',
            chainId: 'algorand',
            fromAsset: '0',
            toAsset: '31566704',
            toAssetScope: null,
        })
        expect(mockSetSelectedAccountId).not.toHaveBeenCalled()
        expect(mockTrackEvent).toHaveBeenCalledWith(SwapEvent.SelectHistory, {
            [AnalyticsMetadataKey.ChainId]: 'algorand',
            [AnalyticsMetadataKey.SwapPairing]: 'ALGO/USDC',
        })
    })

    it('restores a cross-chain pair with its destination network', () => {
        const ETH = { chainId: 'ethereum', networkId: 'mainnet' } as const
        const crossChain = {
            ...pairPaidBy('main'),
            assetOut: {
                assetId: 'eth',
                ref: { ...ETH, assetId: 'eth' },
                unitName: 'ETH',
            },
        } as unknown as SwapHistoryPair
        const { result } = renderHook(() => useSwapPairHistoryWidget(SCOPE))

        act(() => result.current.handlePairPress(crossChain))

        expect(mockSetAccountPair).toHaveBeenCalledWith({
            accountId: 'main',
            chainId: 'algorand',
            fromAsset: '0',
            toAsset: 'eth',
            toAssetScope: ETH,
        })
    })

    it('opens the full history sheet on see all', () => {
        const { result } = renderHook(() => useSwapPairHistoryWidget(SCOPE))

        act(() => result.current.handleSeeAllPress())

        expect(mockTrackEvent).toHaveBeenCalledWith(SwapEvent.HistorySeeAll, {
            [AnalyticsMetadataKey.ChainId]: 'algorand',
        })
        const [request] = mockRequestBottomSheet.mock.calls[0] as [
            { contents: ReactElement; options: unknown },
        ]
        expect(request.contents.type).toBe(SwapHistoryContent)
        expect(request.contents.props).toEqual({})
        expect(request.options).toEqual({
            size: 'modal',
            enablePanDownToClose: true,
            autoCreateContainer: false,
        })
    })

    it('names the account that paid on each chip', () => {
        const { result } = renderHook(() => useSwapPairHistoryWidget(SCOPE))

        const chip = result.current.renderPair({
            item: pairPaidBy('other'),
        }) as ReactElement<{ accountName: string }>

        expect(chip.props.accountName).toBe('Savings')
    })

    it('names the EVM account that paid an Ethereum chip', () => {
        const ETH = { chainId: 'ethereum', networkId: 'mainnet' } as const
        state.names = {
            names: [
                { accountId: 'main', name: 'Main' },
                { accountId: 'evm', name: 'EVM Test 1' },
            ],
            isMultiAccount: true,
        }
        const ethPair = {
            ...pairPaidBy('evm'),
            assetIn: { assetId: 'usdc', ref: { ...ETH, assetId: 'usdc' } },
            assetOut: { assetId: 'eth', ref: { ...ETH, assetId: 'eth' } },
        } as unknown as SwapHistoryPair
        const { result } = renderHook(() => useSwapPairHistoryWidget(SCOPE))

        const chip = result.current.renderPair({
            item: ethPair,
        }) as ReactElement<{ accountName: string }>

        expect(chip.props.accountName).toBe('EVM Test 1')
    })

    it("shows each chip's chain only when the wallet swaps on more than one", () => {
        const render = () =>
            renderHook(() =>
                useSwapPairHistoryWidget(SCOPE),
            ).result.current.renderPair({
                item: pairPaidBy('main'),
            }) as ReactElement<{ isChainShown: boolean }>

        expect(render().props.isChainShown).toBe(true)

        state.sourceChainIds = ['algorand']

        expect(render().props.isChainShown).toBe(false)
    })

    it('leaves the account name off the chips of a wallet with one swap account', () => {
        state.names = {
            names: [{ accountId: 'main', name: 'Main' }],
            isMultiAccount: false,
        }
        const { result } = renderHook(() => useSwapPairHistoryWidget(SCOPE))

        const chip = result.current.renderPair({
            item: pairPaidBy('main'),
        }) as ReactElement<{ accountName?: string }>

        expect(chip.props.accountName).toBeUndefined()
    })
})
