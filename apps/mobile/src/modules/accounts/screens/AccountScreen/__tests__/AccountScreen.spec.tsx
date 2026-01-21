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

import React, { ReactNode } from 'react'
import { render, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { AccountScreen } from '../AccountScreen'

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useSelectedAccount: vi.fn(() => ({ address: 'test', name: 'Test' })),
        useAllAccounts: vi.fn(() => []),
        useSelectedAccountAddress: vi.fn(() => ({
            selectedAccountAddress: 'test',
            setSelectedAccountAddress: vi.fn(),
        })),
        useAccountBalancesQuery: vi.fn(() => ({
            portfolioAlgoValue: '0',
            portfolioFiatValue: '0',
            isPending: false,
        })),
    }
})

vi.mock('react-native-drawer-layout', () => {
    return {
        Drawer: ({ children }: { children: ReactNode }) =>
            children as unknown as ReactNode,
    }
})

// Mock children to simplify test
vi.mock('@modules/accounts/components/AccountMenu', () => ({
    AccountMenu: 'AccountMenu',
}))
vi.mock('@modules/accounts/components/AccountOverview', () => ({
    AccountOverview: () => <span data-testid='AccountOverview' />,
}))
vi.mock('@modules/accounts/components/AccountTabNavigator', () => ({
    AccountTabNavigator: () => <span data-testid='AccountTabNavigator' />,
}))
vi.mock('@modules/accounts/components/AccountSelection', () => ({
    AccountSelection: 'AccountSelection',
}))
vi.mock('@modules/notifications/components/NotificationsIcon', () => ({
    NotificationsIcon: 'NotificationsIcon',
}))
vi.mock('@components/QRScannerView', () => ({ QRScannerView: 'QRScannerView' }))
vi.mock('@modules/accounts/components/ConfettiAnimation', () => ({
    ConfettiAnimation: 'ConfettiAnimation',
}))

describe('AccountScreen', () => {
    it('renders AccountTabNavigator when account is selected', () => {
        render(<AccountScreen />)
        expect(screen.getByTestId('AccountTabNavigator')).toBeTruthy()
    })
})
