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

import { describe, it, expect, vi } from 'vitest'
import React, { PropsWithChildren } from 'react'
import { render, screen, fireEvent } from '@test-utils/render'
import Decimal from 'decimal.js'
import { AccountOverview } from '../AccountOverview'
import { WalletAccount } from '@perawallet/wallet-core-accounts'

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountBalancesQuery: vi.fn(() => ({
        portfolioAlgoValue: new Decimal('100'),
        portfolioFiatValue: new Decimal('200'),
        isPending: false,
        accountBalances: new Map(),
        isFetched: true,
        isRefetching: false,
        isError: false,
    })),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(() => ({ preferredCurrency: 'USD' })),
}))

vi.mock('@hooks/useIsDarkMode', () => ({
    useIsDarkMode: vi.fn(() => false),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: vi.fn(() => ({
        getPreference: vi.fn(() => true),
        setPreference: vi.fn(),
    })),
    useSettings: vi.fn(() => ({
        privacyMode: false,
        setPrivacyMode: vi.fn(),
    })),
}))

vi.mock('@hooks/useChartInteraction', () => ({
    useChartInteraction: vi.fn(() => ({
        period: '24H',
        setPeriod: vi.fn(),
        selectedPoint: null,
        setSelectedPoint: vi.fn(),
    })),
}))

vi.mock('@components/WealthChart', () => ({
    WealthChart: () => null,
}))
vi.mock('@components/ChartPeriodSelection', () => ({
    ChartPeriodSelection: () => null,
}))
vi.mock('@components/WealthTrend', () => ({
    WealthTrend: () => null,
}))
vi.mock('@components/CurrencyDisplay', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    CurrencyDisplay: ({ value }: any) => <div>{value?.toString()}</div>,
}))
vi.mock('@components/ExpandablePanel', () => ({
    ExpandablePanel: ({ children }: PropsWithChildren) => children,
}))

// Mock sub-components to keep test focused
vi.mock('../../ButtonPanel', () => ({
    ButtonPanel: () => null,
}))
vi.mock('../../AccountAssetList', () => ({
    AccountAssetList: ({ children }: PropsWithChildren) => children,
}))

vi.mock(
    '@modules/transactions/components/SendFunds/PWBottomSheet/SendFundsBottomSheet',
    () => ({
        SendFundsBottomSheet: () => null,
    }),
)

describe('AccountOverview', () => {
    const mockAccount = { address: 'addr' } as WalletAccount

    it('renders balance values', () => {
        render(<AccountOverview account={mockAccount} />)
        // Primary and secondary values
        expect(screen.getByText('100')).toBeTruthy()
        expect(screen.getByText('200')).toBeTruthy()
    })

    it('toggles privacy mode on press', async () => {
        const { useSettings } = await import('@perawallet/wallet-core-settings')
        const setPrivacyMode = vi.fn()
        vi.mocked(useSettings).mockReturnValue({
            privacyMode: false,
            setPrivacyMode,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

        render(<AccountOverview account={mockAccount} />)
        fireEvent.click(screen.getByText('100'))

        expect(setPrivacyMode).toHaveBeenCalledWith(true)
    })

    it('renders "no balance" when account has zero balance', async () => {
        const { useAccountBalancesQuery } = await import(
            '@perawallet/wallet-core-accounts'
        )
        vi.mocked(useAccountBalancesQuery).mockReturnValue({
            portfolioAlgoValue: new Decimal('0'),
            portfolioFiatValue: new Decimal('0'),
            isPending: false,
            accountBalances: new Map(),
            isFetched: true,
            isRefetching: false,
            isError: false,
        })

        render(<AccountOverview account={mockAccount} />)
        expect(
            screen.getByText('account_details.no_balance.welcome'),
        ).toBeTruthy()
    })
})
