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
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    CHAIN_CAPABILITIES,
    type ChainCapabilities,
    type ChainDescriptor,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { WalletAccount } from '../../models'
import { useAccountHoldingSources } from '../useAccountHoldingSources'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...original,
        registerStore: vi.fn(),
        createPersistStorage: createMockPersistStorage,
    }
})

const ALL_ON = Object.fromEntries(
    CHAIN_CAPABILITIES.map(capability => [capability, true]),
) as ChainCapabilities

const register = (...ids: ChainId[]) => {
    for (const id of ids) {
        getProvider().chains.register(
            {
                id,
                networks: [
                    { id: 'mainnet', tier: 'mainnet', isDefaultForTier: true },
                    { id: 'testnet', tier: 'testnet', isDefaultForTier: true },
                ],
            } as unknown as ChainDescriptor,
            ALL_ON,
        )
    }
}

const BOTH_CHAINS: WalletAccount = {
    id: 'both',
    custody: { kind: 'local', seed: null },
    chains: {
        ethereum: { address: '0xETH', keyPairId: 'e' },
        algorand: { address: 'ALGO', keyPairId: 'a' },
    },
}

describe('useAccountHoldingSources', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        useNetworkStore.getState().setMode('live')
    })

    it("lists the account's chains in registry order at their selected network", () => {
        register('algorand', 'ethereum')

        const { result } = renderHook(() =>
            useAccountHoldingSources(BOTH_CHAINS),
        )

        expect(result.current).toEqual([
            {
                address: 'ALGO',
                scope: { chainId: 'algorand', networkId: 'mainnet' },
            },
            {
                address: '0xETH',
                scope: { chainId: 'ethereum', networkId: 'mainnet' },
            },
        ])
    })

    it('leaves out a registered chain the account has no entry on', () => {
        register('algorand', 'ethereum')
        const algorandOnly: WalletAccount = {
            ...BOTH_CHAINS,
            chains: { algorand: { address: 'ALGO', keyPairId: 'a' } },
        }

        const { result } = renderHook(() =>
            useAccountHoldingSources(algorandOnly),
        )

        expect(result.current.map(s => s.scope.chainId)).toEqual(['algorand'])
    })

    it('leaves out an entry on a chain this build does not register', () => {
        register('algorand')

        const { result } = renderHook(() =>
            useAccountHoldingSources(BOTH_CHAINS),
        )

        expect(result.current.map(s => s.scope.chainId)).toEqual(['algorand'])
    })

    it('leaves out a chain whose kill switch is on', () => {
        register('algorand', 'ethereum')
        vi.spyOn(getProvider().chains, 'isSwitchedOff').mockImplementation(
            chainId => chainId === 'ethereum',
        )

        const { result } = renderHook(() =>
            useAccountHoldingSources(BOTH_CHAINS),
        )

        expect(result.current.map(s => s.scope.chainId)).toEqual(['algorand'])
    })

    it('follows the selected network', () => {
        register('algorand', 'ethereum')
        const { result } = renderHook(() =>
            useAccountHoldingSources(BOTH_CHAINS),
        )

        act(() => useNetworkStore.getState().setMode('developer'))

        expect(result.current.map(s => s.scope.networkId)).toEqual([
            'testnet',
            'testnet',
        ])
    })

    it('keeps its identity across renders while nothing changes', () => {
        register('algorand', 'ethereum')
        const { result, rerender } = renderHook(() =>
            useAccountHoldingSources(BOTH_CHAINS),
        )
        const first = result.current

        rerender()

        expect(result.current).toBe(first)
    })

    it('is empty without an account', () => {
        register('algorand')

        const { result } = renderHook(() => useAccountHoldingSources(null))

        expect(result.current).toEqual([])
    })
})
