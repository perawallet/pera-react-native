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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { AccountDetailsEvent } from '@analytics'
import { setChainEnabled } from '@test-utils/capability-overrides'
import { registerEthereumChain } from '@test-utils/chain-fixtures'

import { useAccountTabNavigator } from '../useAccountTabNavigator'

const mocks = vi.hoisted(() => ({ trackEvent: vi.fn() }))

vi.mock('@analytics', async importOriginal => ({
    ...(await importOriginal<typeof import('@analytics')>()),
    trackEvent: mocks.trackEvent,
}))

const ALGORAND_ACCOUNT: WalletAccount = {
    id: 'algo',
    custody: { kind: 'watch' },
    chains: { algorand: { address: 'ALGO' } },
}

const ETHEREUM_ACCOUNT: WalletAccount = {
    id: 'eth',
    custody: { kind: 'watch' },
    chains: { ethereum: { address: `0x${'f'.repeat(40)}` } },
}

const keysOf = (tabs: { key: string }[]) => tabs.map(tab => tab.key)

describe('useAccountTabNavigator', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useRemoteConfigStore.getState().resetState()
    })

    it('starts on the first tab with only that page mounted', () => {
        const { result } = renderHook(() =>
            useAccountTabNavigator(ALGORAND_ACCOUNT),
        )

        expect(result.current.index).toBe(0)
        expect(result.current.isPageVisited(0)).toBe(true)
        expect(result.current.isPageVisited(1)).toBe(false)
        expect(result.current.isPageVisited(2)).toBe(false)
    })

    it('keeps a page mounted after leaving it, so returning is instant', () => {
        const { result } = renderHook(() =>
            useAccountTabNavigator(ALGORAND_ACCOUNT),
        )

        act(() => result.current.handleIndexChange(1))
        act(() => result.current.handleIndexChange(2))

        expect(result.current.index).toBe(2)
        expect(result.current.isPageVisited(1)).toBe(true)
        expect(result.current.isPageVisited(2)).toBe(true)
    })

    it('reports the tab that was opened', () => {
        const { result } = renderHook(() =>
            useAccountTabNavigator(ALGORAND_ACCOUNT),
        )

        act(() => result.current.handleIndexChange(2))

        expect(mocks.trackEvent).toHaveBeenCalledWith(
            AccountDetailsEvent.History,
        )
    })

    it('offers every tab on a chain with NFTs and history', () => {
        const { result } = renderHook(() =>
            useAccountTabNavigator(ALGORAND_ACCOUNT),
        )

        expect(keysOf(result.current.tabs)).toEqual([
            'Overview',
            'Nfts',
            'History',
        ])
    })

    it('leaves out the NFTs tab on a chain without NFTs', () => {
        registerEthereumChain()

        const { result } = renderHook(() =>
            useAccountTabNavigator(ETHEREUM_ACCOUNT),
        )

        expect(keysOf(result.current.tabs)).toEqual(['Overview', 'History'])
        act(() => result.current.handleIndexChange(1))
        expect(mocks.trackEvent).toHaveBeenCalledWith(
            AccountDetailsEvent.History,
        )
    })

    it("keeps only Overview while the chain's kill switch is on", () => {
        act(() => setChainEnabled('algorand', false))

        const { result } = renderHook(() =>
            useAccountTabNavigator(ALGORAND_ACCOUNT),
        )

        expect(keysOf(result.current.tabs)).toEqual(['Overview'])
    })

    it('falls back to Overview when the open tab goes away', () => {
        registerEthereumChain()
        const { result, rerender } = renderHook(
            ({ account }) => useAccountTabNavigator(account),
            { initialProps: { account: ALGORAND_ACCOUNT } },
        )
        act(() => result.current.handleIndexChange(1))
        expect(result.current.index).toBe(1)

        rerender({ account: ETHEREUM_ACCOUNT })

        expect(result.current.index).toBe(0)
    })
})
