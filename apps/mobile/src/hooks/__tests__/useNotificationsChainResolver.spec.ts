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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    useRegisteredChainIds,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import {
    ETHEREUM_CHAIN_ID,
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { useNotificationsChainResolver } from '../useNotificationsChainResolver'

const algorandAccount: WalletAccount = {
    id: 'acc-algo',
    chains: { algorand: { address: 'ALGOADDRESS' } },
    custody: { kind: 'watch' },
}

const ethereumAccount: WalletAccount = {
    id: 'acc-eth',
    chains: {
        [ETHEREUM_CHAIN_ID]: {
            address: '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed',
        },
    },
    custody: { kind: 'watch' },
}

describe('useNotificationsChainResolver', () => {
    // The shared accounts mock pins the registry to Algorand; this spec varies it.
    beforeEach(() => {
        const byKey = new Map<string, ChainId[]>()
        vi.mocked(useRegisteredChainIds).mockImplementation(() => {
            const ids = getProvider()
                .chains.list()
                .map(({ id }) => id)
            const key = ids.join()
            if (!byKey.has(key)) byKey.set(key, ids)
            return byKey.get(key)!
        })
    })

    afterEach(() => {
        useRemoteConfigStore.getState().resetState()
        restoreAlgorandOnlyChains()
    })

    it('resolves an Algorand account to its chain', () => {
        const { result } = renderHook(() => useNotificationsChainResolver())

        expect(result.current(algorandAccount)).toBe('algorand')
    })

    it('keeps an Algorand account after notifications are switched off at runtime', () => {
        setCapabilityOverrides({ notifications: false })

        const { result } = renderHook(() => useNotificationsChainResolver())

        expect(result.current(algorandAccount)).toBe('algorand')
    })

    it('resolves an Ethereum-only account to nothing at the shipped defaults', () => {
        registerEthereumChain()

        const { result } = renderHook(() => useNotificationsChainResolver())

        expect(result.current(ethereumAccount)).toBeUndefined()
    })

    it('resolves an Ethereum-only account once notifications are switched on there', () => {
        registerEthereumChain()
        setCapabilityOverrides({ notifications: true }, ETHEREUM_CHAIN_ID)

        const { result } = renderHook(() => useNotificationsChainResolver())

        expect(result.current(ethereumAccount)).toBe(ETHEREUM_CHAIN_ID)
    })

    it('resolves to nothing, without throwing, for a chain this build does not register', () => {
        const { result } = renderHook(() => useNotificationsChainResolver())

        expect(result.current(ethereumAccount)).toBeUndefined()
    })

    it('keeps its identity when no capability changes', () => {
        const { result, rerender } = renderHook(() =>
            useNotificationsChainResolver(),
        )
        const first = result.current

        rerender()

        expect(result.current).toBe(first)
    })

    it('changes identity when notifications are switched on for another chain', () => {
        registerEthereumChain()
        const { result, rerender } = renderHook(() =>
            useNotificationsChainResolver(),
        )
        const first = result.current

        setCapabilityOverrides({ notifications: true }, ETHEREUM_CHAIN_ID)
        rerender()

        expect(result.current).not.toBe(first)
        expect(result.current(ethereumAccount)).toBe(ETHEREUM_CHAIN_ID)
    })
})
