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
    canSwap: true,
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
    custody: { kind: 'watch' },
    chains: { base: { address: '0xabc' } },
} as unknown as WalletAccount

describe('useNetworkFundingState', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        actions.canReceive = true
        actions.canBuy = true
        actions.canSwap = true
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
        expect(mockNavigate).toHaveBeenCalledWith('TabBar', { screen: 'Fund' })
    })

    it('opens Swap and tracks it on the network', () => {
        const { result } = renderHook(() =>
            useNetworkFundingState({ account, chainId: 'base' }),
        )

        result.current.handleSwap()

        expect(mockTrackEvent).toHaveBeenCalledWith(HomeEvent.Swap, {
            [AnalyticsMetadataKey.ChainId]: 'base',
        })
        expect(mockReplace).toHaveBeenCalledWith('TabBar', { screen: 'Swap' })
    })

    it('offers only the actions the network supports', () => {
        actions.canBuy = false
        actions.canSwap = false

        const { result } = renderHook(() =>
            useNetworkFundingState({ account, chainId: 'base' }),
        )

        expect(result.current).toMatchObject({
            canReceive: true,
            canBuy: false,
            canSwap: false,
        })
    })
})
