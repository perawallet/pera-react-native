/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { render, screen } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { PortfolioView } from '../PortfolioView'
import { WalletAccount } from '@perawallet/wallet-core-accounts'

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(() => ({
        preferredCurrency: 'USD',
        fallbackCurrency: 'USD',
        usdToPreferred: vi.fn((amount: Decimal) => amount),
        algoUsdPrice: new Decimal(0),
    })),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAccountBalancesQuery: vi.fn(() => ({
            portfolioAlgoValue: '100',
            isPending: false,
            accountBalances: new Map(),
        })),
        usePortfolioTotals: vi.fn(() => ({
            portfolioUsdValue: '200',
            accountUsdValues: new Map(),
            isPending: false,
        })),
        useAllAccounts: vi.fn(() => []),
    }
})

vi.mock('@perawallet/wallet-core-settings', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-settings')
        >()
    return {
        ...actual,
        usePreferences: () => ({
            getPreference: () => true,
            setPreference: vi.fn(),
        }),
    }
})

// Mock complex child components
vi.mock('@components/WealthChart', () => ({
    WealthChart: 'WealthChart',
}))
vi.mock('@components/WealthTrend', () => ({
    WealthTrend: 'WealthTrend',
}))
vi.mock('@components/ChartPeriodSelection', () => ({
    ChartPeriodSelection: 'ChartPeriodSelection',
}))

describe('PortfolioView', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders correctly', () => {
        render(<PortfolioView />)
        expect(screen.getByText('portfolio.title')).toBeTruthy()
    })

    it('excludes watch accounts from portfolio balance queries', async () => {
        const { useAllAccounts, useAccountBalancesQuery } =
            await import('@perawallet/wallet-core-accounts')

        const standardAccount = {
            address: 'standard-addr',
            type: 'algo25',
        } as WalletAccount

        const watchAccount = {
            address: 'watch-addr',
            type: 'watch',
        } as WalletAccount

        vi.mocked(useAllAccounts).mockReturnValue([
            standardAccount,
            watchAccount,
        ])

        render(<PortfolioView />)

        expect(vi.mocked(useAccountBalancesQuery)).toHaveBeenCalledWith([
            standardAccount,
        ])
    })

    it('passes only non-watch account addresses for history queries', async () => {
        const { useAllAccounts } =
            await import('@perawallet/wallet-core-accounts')

        const standardAccount1 = {
            address: 'standard-addr-1',
            type: 'algo25',
        } as WalletAccount

        const standardAccount2 = {
            address: 'standard-addr-2',
            type: 'hdWallet',
        } as WalletAccount

        const watchAccount = {
            address: 'watch-addr',
            type: 'watch',
        } as WalletAccount

        vi.mocked(useAllAccounts).mockReturnValue([
            standardAccount1,
            watchAccount,
            standardAccount2,
        ])

        render(<PortfolioView />)

        expect(screen.getByText('portfolio.title')).toBeTruthy()
    })

    it('handles all accounts being watch accounts', async () => {
        const { useAllAccounts, useAccountBalancesQuery } =
            await import('@perawallet/wallet-core-accounts')

        const watchAccount1 = {
            address: 'watch-addr-1',
            type: 'watch',
        } as WalletAccount

        const watchAccount2 = {
            address: 'watch-addr-2',
            type: 'watch',
        } as WalletAccount

        vi.mocked(useAllAccounts).mockReturnValue([
            watchAccount1,
            watchAccount2,
        ])

        render(<PortfolioView />)

        expect(vi.mocked(useAccountBalancesQuery)).toHaveBeenCalledWith([])
    })
})
