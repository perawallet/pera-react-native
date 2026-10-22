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
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type {
    AccountValueBasis,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import { useAccountWithBalance } from '../useAccountWithBalance'

const mockUseIsOnTestTier = vi.fn()
const mockIsSwitchedOff = vi.fn()
const mockBasis = { current: 'native' as AccountValueBasis }
const mockAccountValueTotals = new Map<
    string,
    { nativeValue: Decimal | null }
>()

vi.mock('@perawallet/wallet-core-accounts', () => {
    const chainOf = (account: WalletAccount) =>
        Object.keys(account.chains)[0] as string
    return {
        useAccountChainId: chainOf,
        useAccountValueBasis: () => mockBasis.current,
        accountValueOf: (
            account: WalletAccount,
            chainId: string,
            values: Map<string, unknown>,
        ) =>
            values.get(
                (account.chains as Record<string, { address: string }>)[chainId]
                    ?.address ?? '',
            ),
        useAccountValueTotalsQuery: () => ({
            accountValueTotals: mockAccountValueTotals,
        }),
        useRegisteredChainIds: () => ['algorand', 'ethereum'],
    }
})

vi.mock('@perawallet/wallet-core-assets', () => ({
    findNativeAsset: (chainId: string) => ({
        assetId: chainId === 'ethereum' ? 'eth' : '0',
    }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useIsOnTestTier: (chainIds: readonly string[]) =>
        mockUseIsOnTestTier(chainIds),
    useIsChainSwitchedOff: (chainId: string) => mockIsSwitchedOff(chainId),
}))

const ALGO_ADDRESS = 'A'.repeat(58)
const ETH_ADDRESS = `0x${'b'.repeat(40)}`

const ALGO_ACCOUNT: WalletAccount = {
    id: 'account-1',
    custody: { kind: 'watch' },
    chains: { algorand: { address: ALGO_ADDRESS } },
}

const ETH_ACCOUNT: WalletAccount = {
    id: 'account-2',
    custody: { kind: 'watch' },
    chains: { ethereum: { address: ETH_ADDRESS } },
}

const BOTH_CHAINS: WalletAccount = {
    ...ALGO_ACCOUNT,
    chains: {
        algorand: { address: ALGO_ADDRESS },
        ethereum: { address: ETH_ADDRESS },
    },
}

describe('useAccountWithBalance', () => {
    beforeAll(() => {
        registerEthereumChain()
    })

    beforeEach(() => {
        mockUseIsOnTestTier.mockReset().mockReturnValue(false)
        mockIsSwitchedOff.mockReset().mockReturnValue(false)
        mockBasis.current = 'native'
        mockAccountValueTotals.clear()
    })

    it("reads the given chain's address, scope and native asset over the account's own chain", () => {
        mockAccountValueTotals.set(ALGO_ADDRESS, {
            nativeValue: new Decimal(1),
        })
        mockAccountValueTotals.set(ETH_ADDRESS, {
            nativeValue: new Decimal(2),
        })

        const { result } = renderHook(() =>
            useAccountWithBalance(BOTH_CHAINS, 'ethereum'),
        )

        expect(result.current.nativeValue).toEqual(new Decimal(2))
        expect(result.current.scope.chainId).toBe('ethereum')
        expect(result.current.availability).toEqual({
            isAvailable: true,
            nativeAsset: { assetId: 'eth' },
        })
    })

    it('shows every chain the account holds, in registry order, when no chain is given', () => {
        const { result } = renderHook(() =>
            useAccountWithBalance({
                ...BOTH_CHAINS,
                chains: {
                    ethereum: { address: ETH_ADDRESS },
                    algorand: { address: ALGO_ADDRESS },
                },
            }),
        )

        expect(result.current.shownChainIds).toEqual(['algorand', 'ethereum'])
    })

    it('shows only the given chain on a row tied to one chain', () => {
        const { result } = renderHook(() =>
            useAccountWithBalance(BOTH_CHAINS, 'ethereum'),
        )

        expect(result.current.shownChainIds).toEqual(['ethereum'])
    })

    it('renders an Algorand-only wallet as a single-chain row', () => {
        mockAccountValueTotals.set(ALGO_ADDRESS, {
            nativeValue: new Decimal(12),
        })

        const { result } = renderHook(() => useAccountWithBalance(ALGO_ACCOUNT))

        expect(result.current).toMatchObject({
            scope: { chainId: 'algorand', networkId: 'mainnet' },
            availability: { isAvailable: true, nativeAsset: { assetId: '0' } },
            nativeValue: new Decimal(12),
            isMultiChain: false,
        })
    })

    it('values an Ethereum account in ETH on its own chain', () => {
        registerEthereumChain()
        mockBasis.current = 'fiat'
        mockAccountValueTotals.set(ETH_ADDRESS, {
            nativeValue: new Decimal('1.5'),
        })

        const { result } = renderHook(() => useAccountWithBalance(ETH_ACCOUNT))

        expect(result.current).toMatchObject({
            scope: { chainId: 'ethereum', networkId: 'mainnet' },
            chainName: 'Ethereum',
            availability: {
                isAvailable: true,
                nativeAsset: { assetId: 'eth' },
            },
            nativeValue: new Decimal('1.5'),
            isMultiChain: true,
        })
    })

    it('keeps an unknown native value unknown rather than 0', () => {
        mockAccountValueTotals.set(ETH_ADDRESS, { nativeValue: null })

        const { result } = renderHook(() => useAccountWithBalance(ETH_ACCOUNT))

        expect(result.current.nativeValue).toBeNull()
    })

    it("flags an account whose chain's kill switch is off", () => {
        mockIsSwitchedOff.mockReturnValue(true)

        const { result } = renderHook(() => useAccountWithBalance(ETH_ACCOUNT))

        expect(mockIsSwitchedOff).toHaveBeenCalledWith('ethereum')
        expect(result.current.availability).toEqual({ isAvailable: false })
    })

    it("marks the account as test tier from its chains' networks", () => {
        mockUseIsOnTestTier.mockReturnValue(true)

        const { result } = renderHook(() => useAccountWithBalance(ALGO_ACCOUNT))

        expect(mockUseIsOnTestTier).toHaveBeenCalledWith(['algorand'])
        expect(result.current.isTestTier).toBe(true)
    })
})
