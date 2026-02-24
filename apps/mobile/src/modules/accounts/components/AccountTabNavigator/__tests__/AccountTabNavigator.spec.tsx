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

import React from 'react'
import { render, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { AccountTabNavigator } from '../AccountTabNavigator'
import { WalletAccount } from '@perawallet/wallet-core-accounts'

vi.mock('@perawallet/wallet-core-accounts', () => ({
    getAccountDisplayName: vi.fn(account => account.name),
}))

const { capturedOverviewProps } = vi.hoisted(() => ({
    capturedOverviewProps: { current: {} as Record<string, unknown> },
}))

// Use absolute module paths for the component mocks
vi.mock('../../AccountOverview', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AccountOverview: (props: any) => {
        capturedOverviewProps.current = props
        return <span data-testid='AccountOverview' />
    },
}))

vi.mock('../../AccountNfts', () => ({
    AccountNfts: () => <span data-testid='AccountNfts' />,
}))

vi.mock('../../AccountHistory', () => ({
    AccountHistory: () => <span data-testid='AccountHistory' />,
}))

const mockAccount: WalletAccount = {
    address: 'TEST_ADDRESS_123',
    name: 'Test Account',
    type: 'algo25',
    keyPairId: 'pk',
}

describe('AccountTabNavigator', () => {
    it('renders all three tabs', () => {
        render(
            <AccountTabNavigator
                account={mockAccount}
                chartVisible={true}
            />,
        )

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

    it('renders AccountOverview for the initial tab', () => {
        render(
            <AccountTabNavigator
                account={mockAccount}
                chartVisible={true}
            />,
        )

        expect(screen.getByTestId('AccountOverview')).toBeTruthy()
    })

    it('passes onSwipeEnabledChange to AccountOverview', () => {
        render(
            <AccountTabNavigator
                account={mockAccount}
                chartVisible={true}
            />,
        )

        expect(capturedOverviewProps.current.onSwipeEnabledChange).toBeTypeOf(
            'function',
        )
    })
})
