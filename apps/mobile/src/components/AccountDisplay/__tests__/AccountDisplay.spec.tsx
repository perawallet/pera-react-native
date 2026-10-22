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
import { render, screen } from '@test-utils/render'
import { PWText } from '@components/core'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { AccountDisplay } from '../AccountDisplay'

const mockDisplay = vi.hoisted(() => ({
    renderSecondary: true,
}))

vi.mock('../useAccountDisplay', () => ({
    useAccountDisplay: () => ({
        displayName: 'Savings',
        secondaryText: 'Watch account',
        renderSecondary: mockDisplay.renderSecondary,
        showTypeAsSecondary: true,
        showBackupBadge: false,
    }),
}))

vi.mock('@components/AccountIcon', () => ({
    AccountIcon: () => null,
}))

const ACCOUNT: WalletAccount = {
    id: 'account-1',
    custody: { kind: 'watch' },
    chains: { algorand: { address: 'A'.repeat(58) } },
}

describe('AccountDisplay', () => {
    beforeEach(() => {
        mockDisplay.renderSecondary = true
    })

    it('renders the secondary accessory after the secondary line', () => {
        render(
            <AccountDisplay
                account={ACCOUNT}
                secondaryAccessory={<PWText>Ethereum</PWText>}
            />,
        )

        expect(screen.getByText('Watch account')).toBeTruthy()
        expect(screen.getByText('Ethereum')).toBeTruthy()
    })

    it('still renders the accessory when there is no secondary text', () => {
        mockDisplay.renderSecondary = false

        render(
            <AccountDisplay
                account={ACCOUNT}
                secondaryAccessory={<PWText>Ethereum</PWText>}
            />,
        )

        expect(screen.queryByText('Watch account')).toBeNull()
        expect(screen.getByText('Ethereum')).toBeTruthy()
    })
})
