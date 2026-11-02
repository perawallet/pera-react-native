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
import { createElement, type ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import {
    useAccountValueTotalsQuery,
    useSigningAccountsOnOwnChain,
    type AccountHoldingSource,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import {
    AccountDrawerContext,
    type AccountDrawerContextValue,
} from '../../AccountDrawer/AccountDrawerContext'
import { usePortfolioView } from '../usePortfolioView'

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAllAccounts: vi.fn(() => []),
    useSigningAccountsOnOwnChain: vi.fn(() => []),
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

const ALGO_SOURCE: AccountHoldingSource = {
    address: 'ALGO',
    scope: { chainId: 'algorand', networkId: 'mainnet' },
}
const ETH_SOURCE: AccountHoldingSource = {
    address: `0x${'a'.repeat(40)}`,
    scope: { chainId: 'ethereum', networkId: 'mainnet' },
}

const totals = (
    portfolioUsdValue: Decimal | null,
    portfolioFiatValue: Decimal | null,
    isPortfolioFiatValuePartial = false,
    sources: {
        fiat?: AccountHoldingSource[]
    } = {},
) =>
    ({
        accountValueTotals: new Map(),
        fiatTotalSources: sources.fiat ?? [],
        portfolioUsdValue,
        portfolioFiatValue,
        isPortfolioFiatValuePartial,
        isPending: false,
    }) as unknown as ReturnType<typeof useAccountValueTotalsQuery>

describe('usePortfolioView', () => {
    beforeEach(() => {
        vi.mocked(useAccountValueTotalsQuery).mockReturnValue(
            totals(new Decimal(10), new Decimal(30)),
        )
    })

    it.each([
        [false, false],
        [true, true],
    ])('with the drawer open=%s, isDrawerOpen is %s', (isOpen, expected) => {
        const wrapper = ({ children }: { children: ReactNode }) =>
            createElement(
                AccountDrawerContext.Provider,
                { value: { isOpen } as AccountDrawerContextValue },
                children,
            )

        const { result } = renderHook(() => usePortfolioView(), { wrapper })

        expect(result.current.isDrawerOpen).toBe(expected)
    })

    it('counts the drawer as open where none is mounted', () => {
        const { result } = renderHook(() => usePortfolioView())

        expect(result.current.isDrawerOpen).toBe(true)
    })

    it('totals in fiat for a wallet on Algorand only too', () => {
        const { result } = renderHook(() => usePortfolioView())

        expect(result.current.portfolioPreferredValue).toEqual(new Decimal(60))
    })

    it('leaves the total unknown, not zero, when nothing counted is priced', () => {
        vi.mocked(useAccountValueTotalsQuery).mockReturnValue(
            totals(new Decimal(10), null),
        )

        const { result } = renderHook(() => usePortfolioView())

        expect(result.current.portfolioPreferredValue).toBeNull()
        expect(result.current.isPreferredValuePartial).toBe(false)
    })

    it('flags a fiat total that leaves unpriced holdings out', () => {
        vi.mocked(useAccountValueTotalsQuery).mockReturnValue(
            totals(new Decimal(10), new Decimal(30), true),
        )

        const { result } = renderHook(() => usePortfolioView())

        expect(result.current.portfolioPreferredValue).toEqual(new Decimal(60))
        expect(result.current.isPreferredValuePartial).toBe(true)
    })

    it('does not flag a total the unresolved rate leaves unknown', () => {
        vi.mocked(useAccountValueTotalsQuery).mockReturnValue(
            totals(new Decimal(10), new Decimal(30), true),
        )
        vi.mocked(useCurrency).mockReturnValueOnce({
            usdToPreferred: () => null,
        } as unknown as ReturnType<typeof useCurrency>)

        const { result } = renderHook(() => usePortfolioView())

        expect(result.current.portfolioPreferredValue).toBeNull()
        expect(result.current.isPreferredValuePartial).toBe(false)
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

        const { result } = renderHook(() => usePortfolioView())

        expect(vi.mocked(useAccountValueTotalsQuery)).toHaveBeenCalledWith(
            [ethAccount],
            expect.objectContaining({ chainId: 'algorand' }),
        )
    })

    it('plots the chains the fiat total sums, on a wallet with Algorand only', () => {
        vi.mocked(useAccountValueTotalsQuery).mockReturnValue(
            totals(new Decimal(10), new Decimal(30), false, {
                fiat: [ALGO_SOURCE],
            }),
        )

        const { result } = renderHook(() => usePortfolioView())

        expect(result.current.chartSources).toEqual([ALGO_SOURCE])
        expect(result.current.hasBalanceHistory).toBe(true)
    })

    it('plots every chain the fiat total sums once the wallet spans chains', () => {
        registerEthereumChain()
        vi.mocked(useAccountValueTotalsQuery).mockReturnValue(
            totals(new Decimal(10), new Decimal(30), false, {
                fiat: [ALGO_SOURCE, ETH_SOURCE],
            }),
        )

        const { result } = renderHook(() => usePortfolioView())

        expect(result.current.chartSources).toEqual([ALGO_SOURCE, ETH_SOURCE])
        expect(result.current.hasBalanceHistory).toBe(true)
    })

    it('drops the chart when a chain in the total has no balance history', () => {
        registerEthereumChain()
        setCapabilityOverrides({ balanceHistory: false }, 'ethereum')
        vi.mocked(useAccountValueTotalsQuery).mockReturnValue(
            totals(new Decimal(10), new Decimal(30), false, {
                fiat: [ALGO_SOURCE, ETH_SOURCE],
            }),
        )

        const { result } = renderHook(() => usePortfolioView())

        expect(result.current.hasBalanceHistory).toBe(false)
    })

    it('has no chart when nothing counted can be plotted', () => {
        const { result } = renderHook(() => usePortfolioView())

        expect(result.current.chartSources).toEqual([])
        expect(result.current.hasBalanceHistory).toBe(false)
    })
})
