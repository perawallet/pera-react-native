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
import { renderHook } from '@test-utils/render'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { HomeEvent, AnalyticsMetadataKey } from '@analytics'
import { useNetworkFundingState } from '../useNetworkFundingState'

const { mockTrackEvent, mockNavigate, mockReplace, mockOpenReceiveFundsOn } =
    vi.hoisted(() => ({
        mockTrackEvent: vi.fn(),
        mockNavigate: vi.fn(),
        mockReplace: vi.fn(),
        mockOpenReceiveFundsOn: vi.fn(),
    }))

const actions = vi.hoisted(() => ({
    canReceive: true,
    canBuy: true,
}))

const signer = vi.hoisted(() => ({ canSign: true }))

const SWAP_PARAMS = {
    assetIn: { chainId: 'algorand', assetId: '0' },
    receive: {
        scope: { chainId: 'base', networkId: 'mainnet' },
        assetId: 'native',
        accountId: 'a',
    },
}

const swap = vi.hoisted(() => ({
    params: null as unknown,
    isPending: false,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useCanSignWith: () => signer.canSign,
}))

vi.mock('@modules/swap', () => ({
    useSwapForNativeRoute: () => ({
        params: swap.params,
        isPending: swap.isPending,
    }),
}))

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: mockTrackEvent,
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate, replace: mockReplace }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, options?: Record<string, string>) =>
            options ? `${key}|${JSON.stringify(options)}` : key,
    }),
}))

vi.mock('@modules/assets', () => ({
    useAssetActionButtons: () => actions,
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    chainDisplayNameOf: (chainId: string) =>
        chainId === 'base' ? 'Base' : undefined,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    findNativeAsset: (chainId: string) =>
        chainId === 'base' ? { unitName: 'ETH' } : undefined,
}))

vi.mock('../../../AccountOverview/AccountOverviewModalContext', () => ({
    useAccountOverviewModal: () => ({
        openReceiveFundsOn: mockOpenReceiveFundsOn,
    }),
}))

const account = {
    id: 'a',
    custody: { kind: 'local', seed: null },
    chains: { base: { address: '0xabc' } },
} as unknown as WalletAccount

describe('useNetworkFundingState', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        actions.canReceive = true
        actions.canBuy = true
        signer.canSign = true
        swap.params = SWAP_PARAMS
        swap.isPending = false
    })

    it('names the network and its native token in the copy', () => {
        const { result } = renderHook(() =>
            useNetworkFundingState({ account, chainId: 'base' }),
        )

        expect(result.current.title).toBe(
            'account_details.assets.funding_title|{"network":"Base"}',
        )
        expect(result.current.body).toBe(
            'account_details.assets.funding_body|{"network":"Base","nativeSymbol":"ETH"}',
        )
    })

    it('opens Receive pinned to the network', () => {
        const { result } = renderHook(() =>
            useNetworkFundingState({ account, chainId: 'base' }),
        )

        result.current.handleReceive()

        expect(mockOpenReceiveFundsOn).toHaveBeenCalledWith(account, 'base')
    })

    it('opens Fund and tracks it on the network', () => {
        const { result } = renderHook(() =>
            useNetworkFundingState({ account, chainId: 'base' }),
        )

        result.current.handleBuy()

        expect(mockTrackEvent).toHaveBeenCalledWith(HomeEvent.Fund, {
            [AnalyticsMetadataKey.ChainId]: 'base',
        })
        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Fund',
            params: { chainId: 'base' },
        })
    })

    it('offers Swap for the native coin and opens the cross-chain route', () => {
        const { result } = renderHook(() =>
            useNetworkFundingState({ account, chainId: 'base' }),
        )

        expect(result.current.canSwap).toBe(true)
        expect(result.current.swapTitle).toBe(
            'account_details.assets.funding_swap_for|{"symbol":"ETH"}',
        )

        result.current.handleSwap()

        expect(mockTrackEvent).toHaveBeenCalledWith(HomeEvent.Swap, {
            [AnalyticsMetadataKey.ChainId]: 'base',
        })
        expect(mockReplace).toHaveBeenCalledWith('TabBar', {
            screen: 'Swap',
            params: SWAP_PARAMS,
        })
    })

    it('hides Swap when no cross-chain route gets the native coin', () => {
        swap.params = null

        const { result } = renderHook(() =>
            useNetworkFundingState({ account, chainId: 'base' }),
        )

        expect(result.current.canSwap).toBe(false)
        result.current.handleSwap()
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('keeps Swap off, but not Receive or Buy, while the route is undecided', () => {
        swap.isPending = true

        const { result } = renderHook(() =>
            useNetworkFundingState({ account, chainId: 'base' }),
        )

        expect(result.current).toMatchObject({
            canReceive: true,
            canBuy: true,
            canSwap: false,
        })
    })

    it('offers Buy only where the network supports it', () => {
        actions.canBuy = false

        const { result } = renderHook(() =>
            useNetworkFundingState({ account, chainId: 'base' }),
        )

        expect(result.current).toMatchObject({
            canReceive: true,
            canBuy: false,
        })
    })

    it('offers only Receive when the account cannot sign on the network', () => {
        signer.canSign = false

        const { result } = renderHook(() =>
            useNetworkFundingState({ account, chainId: 'base' }),
        )

        expect(result.current).toMatchObject({
            canReceive: true,
            canBuy: false,
        })
    })
})
