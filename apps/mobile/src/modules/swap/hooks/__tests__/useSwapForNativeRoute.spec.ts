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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type {
    ChainAssetBalance,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useSwapForNativeRoute } from '../useSwapForNativeRoute'

const state = vi.hoisted(() => ({
    hasReceiveScope: true,
    isMultisig: false,
    isPending: false,
    signChainIds: ['algorand', 'base'] as string[],
    balances: [] as unknown[],
    /** Spendable max in base units per pay chain; absent is still loading. */
    spendableMax: {} as Record<string, number>,
    isSpendablePending: false,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => [],
    useAccountChainStateStore: () => ({}),
    useCanSignWithCheck: () => (_account: unknown, chainId: string) =>
        state.signChainIds.includes(chainId),
    canSignWith: (_account: unknown, _accounts: unknown, chainId: string) =>
        state.signChainIds.includes(chainId),
    chainAccountOf: (account: WalletAccount, chainId: string) =>
        account.chains[chainId as keyof WalletAccount['chains']],
    isMultisigAccount: () => state.isMultisig,
    useAccountHoldingsAcrossChainsQuery: () => ({
        assetBalances: state.balances,
        isPending: state.isPending,
        isError: false,
    }),
}))

vi.mock('@perawallet/wallet-core-swaps', async () => {
    const { Decimal } = await import('decimal.js')
    return {
        isSwapChain: () => true,
        swapAdapterFor: () => ({ maxAmountFeeReserve: new Decimal(1000) }),
        useSwapScope: (_account: unknown, chainId: string) =>
            state.hasReceiveScope ? { chainId, networkId: 'mainnet' } : null,
    }
})

vi.mock('@perawallet/wallet-core-transactions', async () => {
    const { Decimal } = await import('decimal.js')
    return {
        useSpendableBalancesQuery: (
            inputs: { scope: { chainId: string } }[],
        ) => ({
            data: inputs.map(({ scope }) =>
                scope.chainId in state.spendableMax
                    ? { max: new Decimal(state.spendableMax[scope.chainId]!) }
                    : undefined,
            ),
            isPending: state.isSpendablePending,
        }),
    }
})

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useChainCapabilityCheck: () => () => true,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    nativeAssetFor: (chainId: string) => ({
        assetId: chainId === 'algorand' ? '0' : 'native',
    }),
}))

const account = {
    id: 'a',
    name: '',
    custody: { kind: 'local', seed: null },
    chains: {
        base: { address: '0xabc', keyPairId: 'k2' },
        algorand: { address: 'ALGO', keyPairId: 'k1' },
    },
} as unknown as WalletAccount

const algoHolding = {
    assetId: '0',
    amount: new Decimal(5),
    nativeValue: new Decimal(5),
    fiatValue: new Decimal(1),
    restriction: null,
    scope: { chainId: 'algorand', networkId: 'mainnet' },
} as unknown as ChainAssetBalance

describe('useSwapForNativeRoute', () => {
    beforeEach(() => {
        state.hasReceiveScope = true
        state.isMultisig = false
        state.isPending = false
        state.signChainIds = ['algorand', 'base']
        state.balances = [algoHolding]
        state.spendableMax = { algorand: 4_899_000, bsc: 1 }
        state.isSpendablePending = false
    })

    it("opens a swap into the network's native coin, paid from another network's", () => {
        const { result } = renderHook(() =>
            useSwapForNativeRoute(account, 'base'),
        )

        expect(result.current.params).toEqual({
            assetIn: { chainId: 'algorand', assetId: '0' },
            receive: {
                scope: { chainId: 'base', networkId: 'mainnet' },
                assetId: 'native',
                accountId: 'a',
            },
        })
    })

    it('offers nothing when the account holds nothing on another network', () => {
        state.balances = []

        const { result } = renderHook(() =>
            useSwapForNativeRoute(account, 'base'),
        )

        expect(result.current.params).toBeNull()
    })

    it('offers nothing when the account cannot sign on the network to receive there', () => {
        state.signChainIds = ['algorand']

        const { result } = renderHook(() =>
            useSwapForNativeRoute(account, 'base'),
        )

        expect(result.current.params).toBeNull()
    })

    it('offers nothing when nothing held can sign on its network', () => {
        state.signChainIds = ['base']

        const { result } = renderHook(() =>
            useSwapForNativeRoute(account, 'base'),
        )

        expect(result.current.params).toBeNull()
    })

    it('offers nothing when the network takes no swap', () => {
        state.hasReceiveScope = false

        const { result } = renderHook(() =>
            useSwapForNativeRoute(account, 'base'),
        )

        expect(result.current.params).toBeNull()
    })

    it('offers nothing on a shared account', () => {
        state.isMultisig = true

        const { result } = renderHook(() =>
            useSwapForNativeRoute(account, 'base'),
        )

        expect(result.current.params).toBeNull()
    })

    it('offers nothing when the held native coin is all locked or reserved', () => {
        state.spendableMax = { algorand: 0 }

        const { result } = renderHook(() =>
            useSwapForNativeRoute(account, 'base'),
        )

        expect(result.current.params).toBeNull()
    })

    it('pays with a cheaper coin when the most valuable one cannot be spent', () => {
        const bnbHolding = {
            ...algoHolding,
            assetId: 'native',
            fiatValue: new Decimal(0.5),
            scope: { chainId: 'bsc', networkId: 'mainnet' },
        }
        state.balances = [algoHolding, bnbHolding]
        state.spendableMax = { algorand: 0, bsc: 1 }
        state.signChainIds = ['algorand', 'base', 'bsc']

        const { result } = renderHook(() =>
            useSwapForNativeRoute(account, 'base'),
        )

        expect(result.current.params?.assetIn).toEqual({
            chainId: 'bsc',
            assetId: 'native',
        })
    })

    it('reports pending while spendable balances are still being read', () => {
        state.isSpendablePending = true

        const { result } = renderHook(() =>
            useSwapForNativeRoute(account, 'base'),
        )

        expect(result.current.isPending).toBe(true)
    })

    it('reports holdings on other networks still being read', () => {
        state.isPending = true

        const { result } = renderHook(() =>
            useSwapForNativeRoute(account, 'base'),
        )

        expect(result.current.isPending).toBe(true)
    })
})
