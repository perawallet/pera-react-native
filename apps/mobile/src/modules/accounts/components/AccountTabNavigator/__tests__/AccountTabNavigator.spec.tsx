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
import { AccountTabNavigator } from '../AccountTabNavigator'
import { WalletAccount } from '@perawallet/wallet-core-accounts'

// Mock the material top tabs navigator
vi.mock('@react-navigation/material-top-tabs', () => {
    const MockScreen = ({
        children,
        name,
        options,
    }: {
        children?: () => ReactNode
        name: string
        options?: { tabBarLabel?: string }
    }) => (
        <div data-testid={`tab-screen-${name}`}>
            <span>{options?.tabBarLabel || name}</span>
            {children && children()}
        </div>
    )

    const MockNavigator = ({
        children,
    }: {
        children: ReactNode
        screenOptions?: object
    }) => <div data-testid='tab-navigator'>{children}</div>

    return {
        createMaterialTopTabNavigator: () => ({
            Navigator: MockNavigator,
            Screen: MockScreen,
        }),
    }
})

// Use absolute module paths for the component mocks
vi.mock('@modules/accounts/components/AccountOverview', () => ({
    AccountOverview: () => <span data-testid='AccountOverview' />,
}))

vi.mock('@modules/accounts/components/AccountNfts', () => ({
    AccountNfts: () => <span data-testid='AccountNfts' />,
}))

vi.mock('@modules/accounts/components/AccountHistory', () => ({
    AccountHistory: () => <span data-testid='AccountHistory' />,
}))

const mockAccount: WalletAccount = {
    address: 'TEST_ADDRESS_123',
    name: 'Test Account',
    type: 'algo25',
    canSign: true,
}

describe('AccountTabNavigator', () => {
    it('renders all three tabs', () => {
        render(<AccountTabNavigator account={mockAccount} />)

        // In tests, i18n returns the keys, not the translated values
        expect(
            screen.getByText('account_details.main_screen.overview_tab'),
        ).toBeTruthy()
        expect(
            screen.getByText('account_details.main_screen.nfts_tab'),
        ).toBeTruthy()
        expect(
            screen.getByText('account_details.main_screen.history_tab'),
        ).toBeTruthy()
    })

    it('renders the tab navigator container', () => {
        render(<AccountTabNavigator account={mockAccount} />)

        expect(screen.getByTestId('tab-navigator')).toBeTruthy()
    })

    it('renders AccountOverview for the Overview tab', () => {
        render(<AccountTabNavigator account={mockAccount} />)

        expect(screen.getByTestId('AccountOverview')).toBeTruthy()
    })
})
