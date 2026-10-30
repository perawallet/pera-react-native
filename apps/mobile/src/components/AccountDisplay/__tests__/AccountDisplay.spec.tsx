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

import { render, screen, within } from '@test-utils/render'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { PWText } from '@components/core'
import { AccountDisplay } from '../AccountDisplay'

const mockDisplayResult = {
    displayName: 'Main account',
    secondaryText: 'Standard' as string | undefined,
    renderSecondary: true,
    showTypeAsSecondary: true,
    showBackupBadge: false,
    chainId: 'ethereum',
}

vi.mock('../useAccountDisplay', () => ({
    useAccountDisplay: () => mockDisplayResult,
}))

vi.mock('@components/AccountIcon', () => ({
    AccountIcon: () => null,
}))

const ACCOUNT: WalletAccount = {
    id: 'account-1',
    custody: { kind: 'watch' },
    chains: { algorand: { address: 'A'.repeat(58) } },
}

const SECONDARY_ROW = 'account_display_secondary_row'

describe('AccountDisplay', () => {
    beforeEach(() => {
        mockDisplayResult.secondaryText = 'Standard'
        mockDisplayResult.renderSecondary = true
        mockDisplayResult.showBackupBadge = false
    })

    it("badges the avatar with the displayed chain's icon when asked", () => {
        render(
            <AccountDisplay
                account={ACCOUNT}
                showChainBadge
            />,
        )

        expect(screen.getByTestId('chain_avatar_badge_ethereum')).toBeTruthy()
    })

    it('shows no chain badge unless asked', () => {
        render(<AccountDisplay account={ACCOUNT} />)

        expect(screen.queryByTestId('chain_avatar_badge_ethereum')).toBeNull()
    })

    it('shows the chain badge beside the backup badge on the same avatar', () => {
        mockDisplayResult.showBackupBadge = true

        render(
            <AccountDisplay
                account={ACCOUNT}
                showChainBadge
            />,
        )

        expect(screen.getByTestId('account_backup_badge')).toBeTruthy()
        expect(screen.getByTestId('chain_avatar_badge_ethereum')).toBeTruthy()
    })

    it('puts the badges on the line under the name, beside the secondary label', () => {
        render(
            <AccountDisplay
                account={ACCOUNT}
                badges={<PWText>BADGE</PWText>}
            />,
        )

        const secondaryRow = screen.getByTestId(SECONDARY_ROW)
        expect(within(secondaryRow).getByText('BADGE')).toBeTruthy()
        expect(within(secondaryRow).getByText('Standard')).toBeTruthy()
        expect(within(secondaryRow).queryByText('Main account')).toBeNull()
        expect(screen.getByText('Main account')).toBeTruthy()
    })

    it('keeps the badges line when there is no secondary label', () => {
        mockDisplayResult.secondaryText = undefined
        mockDisplayResult.renderSecondary = false

        render(
            <AccountDisplay
                account={ACCOUNT}
                badges={<PWText>BADGE</PWText>}
            />,
        )

        expect(
            within(screen.getByTestId(SECONDARY_ROW)).getByText('BADGE'),
        ).toBeTruthy()
    })

    it('renders no second line with neither badges nor a secondary label', () => {
        mockDisplayResult.secondaryText = undefined
        mockDisplayResult.renderSecondary = false

        render(<AccountDisplay account={ACCOUNT} />)

        expect(screen.queryByTestId(SECONDARY_ROW)).toBeNull()
    })

    it('renders no second line for a badges slot that resolved to nothing', () => {
        mockDisplayResult.secondaryText = undefined
        mockDisplayResult.renderSecondary = false

        render(
            <AccountDisplay
                account={ACCOUNT}
                badges={null}
            />,
        )

        expect(screen.queryByTestId(SECONDARY_ROW)).toBeNull()
    })

    it('ignores badges on the Pera Card presentation', () => {
        render(
            <AccountDisplay
                card={{ title: 'Pera Card', subtitle: 'Linked' }}
                badges={<PWText>BADGE</PWText>}
            />,
        )

        expect(screen.getByText('Pera Card')).toBeTruthy()
        expect(screen.queryByText('BADGE')).toBeNull()
    })
})
