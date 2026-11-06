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
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'

import { registerFakeRampAdapters } from '../../__tests__/fakeRampAdapter'
import { useOnrampStore } from '../../store'
import {
    useOnrampDestinationChains,
    useOnrampDestinationScope,
    useOnrampScope,
    useOnrampSigningAccounts,
} from '../useOnrampScope'

type ChainOption = { chainId: ChainId; isEnabled: boolean }

const mocks = vi.hoisted(() => ({
    accounts: [] as WalletAccount[],
    capabilityScope: vi.fn(),
    optionsOf: vi.fn<(account: WalletAccount) => ChainOption[]>(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => mocks.accounts,
    useAccountCapabilityScope: mocks.capabilityScope,
    useAccountChainOptionsResolver: () => mocks.optionsOf,
}))

const ALGORAND = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETHEREUM = { chainId: 'ethereum', networkId: 'mainnet' } as const
const SCOPES: Record<string, typeof ALGORAND | typeof ETHEREUM> = {
    algorand: ALGORAND,
    ethereum: ETHEREUM,
}

const account = (id: string): WalletAccount => ({
    id,
    custody: { kind: 'local', seed: null },
    chains: { algorand: { address: id }, ethereum: { address: id } },
})

const enabled = (...chainIds: ChainId[]): ChainOption[] =>
    chainIds.map(chainId => ({ chainId, isEnabled: true }))

describe('onramp scope hooks', () => {
    const held = account('held')

    beforeEach(() => {
        useOnrampStore.getState().resetState()
        registerFakeRampAdapters(
            { chainId: 'algorand' },
            { chainId: 'ethereum' },
        )
        mocks.capabilityScope.mockReset()
        // Pinned resolution never falls back; unpinned takes the first chain.
        mocks.capabilityScope.mockImplementation(
            (_account, _capability, chainId?: ChainId) =>
                SCOPES[chainId ?? 'algorand'] ?? null,
        )
        mocks.optionsOf.mockReset()
        mocks.optionsOf.mockReturnValue(enabled('algorand', 'ethereum'))
    })

    describe('useOnrampScope', () => {
        test('asks for the onramp capability on the pinned chain', () => {
            const { result } = renderHook(() =>
                useOnrampScope(held, 'ethereum'),
            )

            expect(mocks.capabilityScope).toHaveBeenCalledWith(
                held,
                'onramp',
                'ethereum',
            )
            expect(result.current).toEqual(ETHEREUM)
        })

        test('is null when the pinned chain is not available, with no fallback', () => {
            mocks.capabilityScope.mockReturnValue(null)

            const { result } = renderHook(() =>
                useOnrampScope(held, 'ethereum'),
            )

            expect(result.current).toBeNull()
        })

        test('is null for a chain with no ramp adapter', () => {
            registerFakeRampAdapters({ chainId: 'algorand' })

            const { result } = renderHook(() =>
                useOnrampScope(held, 'ethereum'),
            )

            expect(result.current).toBeNull()
        })

        test('is null without an account', () => {
            mocks.capabilityScope.mockReturnValue(null)

            const { result } = renderHook(() => useOnrampScope(null))

            expect(result.current).toBeNull()
        })
    })

    describe('useOnrampDestinationChains', () => {
        test('lists the enabled chains with a ramp adapter, in order', () => {
            mocks.optionsOf.mockReturnValue([
                ...enabled('algorand'),
                { chainId: 'ethereum', isEnabled: false },
                ...enabled('base' as ChainId),
            ])

            const { result } = renderHook(() =>
                useOnrampDestinationChains(held),
            )

            expect(result.current).toEqual(['algorand'])
        })

        test('is empty without an account', () => {
            const { result } = renderHook(() =>
                useOnrampDestinationChains(null),
            )

            expect(result.current).toEqual([])
        })
    })

    describe('useOnrampDestinationScope', () => {
        test('is the first signing chain with none chosen', () => {
            const { result } = renderHook(() => useOnrampDestinationScope(held))

            expect(result.current).toEqual(ALGORAND)
        })

        test('defaults to the only chain something held signs on', () => {
            mocks.optionsOf.mockReturnValue(enabled('ethereum'))

            const { result } = renderHook(() => useOnrampDestinationScope(held))

            expect(result.current).toEqual(ETHEREUM)
        })

        test('is the chosen chain where the account can be funded', () => {
            useOnrampStore.getState().setSelectedChainId('ethereum')

            const { result } = renderHook(() => useOnrampDestinationScope(held))

            expect(result.current).toEqual(ETHEREUM)
        })

        test('falls back to the signing chain where the chosen one is unavailable', () => {
            useOnrampStore.getState().setSelectedChainId('ethereum')
            mocks.optionsOf.mockReturnValue(enabled('algorand'))
            mocks.capabilityScope.mockImplementation(
                (_account, _capability, chainId?: ChainId) =>
                    chainId === 'algorand' ? ALGORAND : null,
            )

            const { result } = renderHook(() => useOnrampDestinationScope(held))

            expect(result.current).toEqual(ALGORAND)
        })

        test('is null when no chain has onramp', () => {
            mocks.optionsOf.mockReturnValue([])
            mocks.capabilityScope.mockReturnValue(null)

            const { result } = renderHook(() => useOnrampDestinationScope(held))

            expect(result.current).toBeNull()
        })
    })

    describe('useOnrampSigningAccounts', () => {
        test('keeps accounts with a destination chain and drops the rest', () => {
            const signer = account('signer')
            const watch = account('watch')
            mocks.accounts = [signer, watch]
            mocks.optionsOf.mockImplementation(candidate =>
                candidate.id === 'signer' ? enabled('ethereum') : [],
            )

            const { result } = renderHook(() => useOnrampSigningAccounts())

            expect(result.current).toEqual([signer])
        })

        test('drops an account whose only chain has no ramp adapter', () => {
            mocks.accounts = [account('a')]
            mocks.optionsOf.mockReturnValue(enabled('base' as ChainId))

            const { result } = renderHook(() => useOnrampSigningAccounts())

            expect(result.current).toEqual([])
        })
    })
})
