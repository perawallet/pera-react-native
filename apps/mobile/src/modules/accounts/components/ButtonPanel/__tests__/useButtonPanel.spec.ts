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
import { act, renderHook } from '@test-utils/render'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import { AnalyticsMetadataKey, HomeEvent } from '@analytics'
import { useButtonPanel } from '../useButtonPanel'

const overview = vi.hoisted(() => ({ account: null as unknown }))
const mockTrackEvent = vi.hoisted(() => vi.fn())
const mockReplace = vi.hoisted(() => vi.fn())

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: mockTrackEvent,
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ replace: mockReplace }),
}))

vi.mock('../../AccountOverview/AccountOverviewModalContext', () => ({
    useAccountOverviewModal: () => ({
        account: overview.account,
        openSendFunds: vi.fn(),
        openReceiveFunds: vi.fn(),
        openAccountOptions: vi.fn(),
    }),
}))

// The real useSwapScope is this one line; the package barrel drags in stores
// the global mocks can't satisfy.
vi.mock('@perawallet/wallet-core-swaps', async () => {
    const { useAccountCapabilityScope } = await vi.importActual<
        typeof import('@perawallet/wallet-core-accounts')
    >('@perawallet/wallet-core-accounts')
    return {
        useSwapScope: (account: WalletAccount | null) =>
            useAccountCapabilityScope(account, 'swap'),
    }
})

const onAlgorand: WalletAccount = {
    id: 'algo',
    custody: { kind: 'local', seed: null },
    chains: { algorand: { address: 'ALGO-ADDR' } },
}

const onEthereumOnly: WalletAccount = {
    id: 'eth',
    custody: { kind: 'local', seed: null },
    chains: { ethereum: { address: '0xabc' } },
}

describe('useButtonPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useRemoteConfigStore.getState().resetState()
        overview.account = onAlgorand
    })

    it("offers swapping when the account's chain has swap", () => {
        const { result } = renderHook(() => useButtonPanel())

        expect(result.current.canSwap).toBe(true)
    })

    it("removes swapping when the account's chain has swap off", () => {
        setCapabilityOverrides({ swap: false })

        const { result } = renderHook(() => useButtonPanel())

        expect(result.current.canSwap).toBe(false)
    })

    it('removes swapping for an account with no address on a swap chain', () => {
        registerEthereumChain()
        overview.account = onEthereumOnly

        const { result } = renderHook(() => useButtonPanel())

        expect(result.current.canSwap).toBe(false)
    })

    it('offers send and receive on an Algorand account', () => {
        const { result } = renderHook(() => useButtonPanel())

        expect(result.current.canSend).toBe(true)
        expect(result.current.canReceive).toBe(true)
    })

    it("offers only the actions an Ethereum account's chain has", () => {
        registerEthereumChain()
        overview.account = onEthereumOnly

        const { result } = renderHook(() => useButtonPanel())

        expect(result.current.canSwap).toBe(false)
        expect(result.current.canSend).toBe(true)
        expect(result.current.canReceive).toBe(true)
    })

    it('tracks swapping on algorand and opens the Swap tab', () => {
        const { result } = renderHook(() => useButtonPanel())

        act(() => {
            result.current.handleSwap()
        })

        expect(mockTrackEvent).toHaveBeenCalledWith(HomeEvent.Swap, {
            [AnalyticsMetadataKey.ChainId]: 'algorand',
        })
        expect(mockReplace).toHaveBeenCalledWith('TabBar', { screen: 'Swap' })
    })

    it('tracks swapping on ethereum for an Ethereum account', () => {
        registerEthereumChain()
        overview.account = onEthereumOnly

        const { result } = renderHook(() => useButtonPanel())

        act(() => {
            result.current.handleSwap()
        })

        expect(mockTrackEvent).toHaveBeenCalledWith(HomeEvent.Swap, {
            [AnalyticsMetadataKey.ChainId]: 'ethereum',
        })
    })
})
