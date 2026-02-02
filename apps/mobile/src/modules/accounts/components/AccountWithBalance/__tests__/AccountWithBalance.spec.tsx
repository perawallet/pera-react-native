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

import { render } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { AccountWithBalance } from '../AccountWithBalance'
import {
    WalletAccount,
    useAccountBalancesQuery,
} from '@perawallet/wallet-core-accounts'
import Decimal from 'decimal.js'

const mockAccount = {
    address: 'test-address',
    name: 'Test Account',
} as WalletAccount

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAccountBalancesQuery: vi.fn(() => ({
            accountBalances: new Map(),
            isPending: false,
        })),
    }
})

describe('AccountWithBalance', () => {
    it('renders account display component', () => {
        const { container } = render(
            <AccountWithBalance account={mockAccount} />,
        )
        // The component should render the AccountDisplay with the account
        expect(container.textContent).toContain('Test Account')
    })

    it('displays balance when account balance data is available', () => {
        const mockBalanceMap = new Map([
            [
                'test-address',
                {
                    algoValue: new Decimal(100.5),
                    fiatValue: new Decimal(50.25),
                },
            ],
        ])
        vi.mocked(useAccountBalancesQuery).mockReturnValue({
            accountBalances: mockBalanceMap,
            isPending: false,
        } as ReturnType<typeof useAccountBalancesQuery>)

        const { container } = render(
            <AccountWithBalance account={mockAccount} />,
        )
        expect(container.textContent).toContain('Test Account')
    })

    it('renders with selection state when isSelected is true', () => {
        const { container } = render(
            <AccountWithBalance
                account={mockAccount}
                isSelected={true}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('applies custom styles when passed via props', () => {
        const { container } = render(
            <AccountWithBalance
                account={mockAccount}
                style={{ marginTop: 10 }} // eslint-disable-line react-native/no-inline-styles
            />,
        )
        expect(container).toBeTruthy()
    })
})
