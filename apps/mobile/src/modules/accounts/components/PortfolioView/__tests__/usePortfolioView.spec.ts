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
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import {
    useAccountValueBasis,
    useAccountValueTotalsQuery,
    useSigningAccountsOnOwnChain,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import { usePortfolioView } from '../usePortfolioView'

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAllAccounts: vi.fn(() => []),
    useSigningAccountsOnOwnChain: vi.fn(() => []),
    useAccountValueBasis: vi.fn(),
    useAccountValueTotalsQuery: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useSelectedScope: vi.fn(() => ({
        chainId: 'algorand',
        networkId: 'mainnet',
    })),
}))

// Doubles the USD amount so the assertions show which total was converted.
vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(() => ({
        usdToPreferred: (amount: Decimal | null) =>
            amount === null ? null : amount.times(2),
    })),
}))

const totals = (
    portfolioUsdValue: Decimal | null,
    portfolioFiatValue: Decimal | null,
) =>
    ({
        accountValueTotals: new Map(),
        portfolioNativeValue: new Decimal(50),
        portfolioUsdValue,
        portfolioFiatValue,
        isPending: false,
    }) as unknown as ReturnType<typeof useAccountValueTotalsQuery>

describe('usePortfolioView', () => {
    beforeEach(() => {
        vi.mocked(useAccountValueTotalsQuery).mockReturnValue(
            totals(new Decimal(10), new Decimal(30)),
        )
    })

    it('converts the USD total and keeps the native total with Algorand only', () => {
        vi.mocked(useAccountValueBasis).mockReturnValue('native')

        const { result } = renderHook(() => usePortfolioView())

        expect(result.current.basis).toBe('native')
        expect(result.current.portfolioNativeValue).toEqual(new Decimal(50))
        expect(result.current.portfolioPreferredValue).toEqual(new Decimal(20))
    })

    it('converts the fiat total once an account is on another chain', () => {
        vi.mocked(useAccountValueBasis).mockReturnValue('fiat')

        const { result } = renderHook(() => usePortfolioView())

        expect(result.current.basis).toBe('fiat')
        expect(result.current.portfolioPreferredValue).toEqual(new Decimal(60))
    })

    it('leaves the total unknown, not zero, when an account is unpriced', () => {
        vi.mocked(useAccountValueBasis).mockReturnValue('fiat')
        vi.mocked(useAccountValueTotalsQuery).mockReturnValue(
            totals(new Decimal(10), null),
        )

        const { result } = renderHook(() => usePortfolioView())

        expect(result.current.portfolioPreferredValue).toBeNull()
    })

    it('totals every account that signs on its own chain, Ethereum included', () => {
        registerEthereumChain()
        const ethAccount: WalletAccount = {
            id: 'eth',
            custody: { kind: 'local', seed: null },
            chains: {
                ethereum: { address: `0x${'a'.repeat(40)}`, keyPairId: 'k' },
            },
        }
        vi.mocked(useSigningAccountsOnOwnChain).mockReturnValue([ethAccount])
        vi.mocked(useAccountValueBasis).mockReturnValue('fiat')

        const { result } = renderHook(() => usePortfolioView())

        expect(result.current.accounts).toEqual([ethAccount])
        expect(vi.mocked(useAccountValueTotalsQuery)).toHaveBeenCalledWith(
            [ethAccount],
            expect.objectContaining({ chainId: 'algorand' }),
        )
    })

    it('keeps the chart while every counted chain has balance history', () => {
        vi.mocked(useSigningAccountsOnOwnChain).mockReturnValue([
            {
                id: 'algo',
                custody: { kind: 'local', seed: null },
                chains: { algorand: { address: 'ALGO', keyPairId: 'k' } },
            },
        ])
        vi.mocked(useAccountValueBasis).mockReturnValue('native')

        const { result } = renderHook(() => usePortfolioView())

        expect(result.current.hasBalanceHistory).toBe(true)
    })

    it('drops the chart once the total counts a chain the chart leaves out', () => {
        registerEthereumChain()
        vi.mocked(useSigningAccountsOnOwnChain).mockReturnValue([
            {
                id: 'eth',
                custody: { kind: 'local', seed: null },
                chains: {
                    ethereum: {
                        address: `0x${'a'.repeat(40)}`,
                        keyPairId: 'k',
                    },
                },
            },
        ])
        vi.mocked(useAccountValueBasis).mockReturnValue('fiat')

        const { result } = renderHook(() => usePortfolioView())

        expect(result.current.hasBalanceHistory).toBe(false)
    })
})
