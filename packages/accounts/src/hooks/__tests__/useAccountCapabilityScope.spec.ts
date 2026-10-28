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
import { testAccount } from '../../__tests__/accountFactory'
import {
    useAccountCapabilityScope,
    useCapabilityChainResolver,
} from '../useAccountCapabilityScope'

const gate = vi.hoisted(() => ({
    swapOn: new Set<string>(),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useChainCapabilityCheck:
        () =>
        ({ chain }: { chain?: { chainId: ChainId; capability: string } }) =>
            chain !== undefined &&
            chain.capability === 'swap' &&
            gate.swapOn.has(chain.chainId),
}))

const descriptor = (id: ChainId): ChainDescriptor =>
    ({
        id,
        networks: [
            { id: 'mainnet', tier: 'mainnet', isDefaultForTier: true },
            { id: 'testnet', tier: 'testnet', isDefaultForTier: true },
        ],
    }) as unknown as ChainDescriptor

const ALL_ON = Object.fromEntries(
    CHAIN_CAPABILITIES.map(capability => [capability, true]),
) as ChainCapabilities

const onBothChains: WalletAccount = {
    id: 'both',
    custody: { kind: 'watch' },
    chains: {
        algorand: { address: 'ALGO-ADDR' },
        ethereum: { address: '0xabc' },
    },
}

const onEthereumOnly: WalletAccount = {
    id: 'eth',
    custody: { kind: 'watch' },
    chains: { ethereum: { address: '0xabc' } },
}

describe('useAccountCapabilityScope', () => {
    beforeEach(() => {
        gate.swapOn = new Set(['algorand'])
        getProvider().chains.register(descriptor('algorand'), ALL_ON)
        getProvider().chains.register(descriptor('ethereum'), ALL_ON)
        useNetworkStore.getState().setMode('live')
    })

    it('scopes to the chain the account is on, at its selected network', () => {
        const account = testAccount('local')

        const { result } = renderHook(() =>
            useAccountCapabilityScope(account, 'swap'),
        )

        expect(result.current).toEqual({
            chainId: 'algorand',
            networkId: 'mainnet',
        })
    })

    it('is null when the capability is off on the account chain', () => {
        gate.swapOn = new Set()

        const { result } = renderHook(() =>
            useAccountCapabilityScope(testAccount('local'), 'swap'),
        )

        expect(result.current).toBeNull()
    })

    it('is null when the account has no entry on a capable chain', () => {
        const { result } = renderHook(() =>
            useAccountCapabilityScope(onEthereumOnly, 'swap'),
        )

        expect(result.current).toBeNull()
    })

    it('is null without an account', () => {
        const { result } = renderHook(() =>
            useAccountCapabilityScope(null, 'swap'),
        )

        expect(result.current).toBeNull()
    })

    it('picks the first chain in registry order that has the capability', () => {
        gate.swapOn = new Set(['ethereum'])

        const { result } = renderHook(() =>
            useAccountCapabilityScope(onBothChains, 'swap'),
        )

        expect(result.current).toEqual({
            chainId: 'ethereum',
            networkId: 'mainnet',
        })
    })

    it('moves to the developer network when the mode switches', () => {
        const account = testAccount('local')
        const { result } = renderHook(() =>
            useAccountCapabilityScope(account, 'swap'),
        )

        act(() => {
            useNetworkStore.getState().setMode('developer')
        })

        expect(result.current).toEqual({
            chainId: 'algorand',
            networkId: 'testnet',
        })
    })

    it('resolves a pinned chain instead of the first capable one', () => {
        gate.swapOn = new Set(['algorand', 'ethereum'])

        const { result } = renderHook(() =>
            useAccountCapabilityScope(onBothChains, 'swap', 'ethereum'),
        )

        expect(result.current).toEqual({
            chainId: 'ethereum',
            networkId: 'mainnet',
        })
    })

    it('is null when the pinned chain has the capability off, never falling back', () => {
        const { result } = renderHook(() =>
            useAccountCapabilityScope(onBothChains, 'swap', 'ethereum'),
        )

        expect(result.current).toBeNull()
    })

    it('is null when the account is not on the pinned chain', () => {
        gate.swapOn = new Set(['algorand', 'ethereum'])

        const { result } = renderHook(() =>
            useAccountCapabilityScope(testAccount('local'), 'swap', 'ethereum'),
        )

        expect(result.current).toBeNull()
    })

    it('is null when the pinned chain is not registered', () => {
        gate.swapOn = new Set(['algorand', 'solana'])

        const { result } = renderHook(() =>
            useAccountCapabilityScope(
                onBothChains,
                'swap',
                'solana' as ChainId,
            ),
        )

        expect(result.current).toBeNull()
    })

    it('skips account entries on chains that are not registered', () => {
        getProvider().chains.reset()
        getProvider().chains.register(descriptor('algorand'), ALL_ON)

        const { result } = renderHook(() => useCapabilityChainResolver('swap'))

        expect(result.current(onEthereumOnly)).toBeUndefined()
        expect(result.current(onBothChains)).toBe('algorand')
    })
})
