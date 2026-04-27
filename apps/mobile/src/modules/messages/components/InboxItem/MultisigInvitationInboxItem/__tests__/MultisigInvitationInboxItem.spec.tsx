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

import { render, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { MultisigInvitationInboxItem } from '../MultisigInvitationInboxItem'
import type { InboxItem as InboxItemModel } from '@perawallet/wallet-core-messages'

vi.mock('@perawallet/wallet-core-shared', () => ({
    truncateAlgorandAddress: vi.fn((addr: string, maxLength: number = 11) => {
        const prefix = Math.floor(maxLength / 2)
        return `${addr.slice(0, prefix)}...${addr.slice(-prefix)}`
    }),
    formatRelativeTime: vi.fn(() => '21 minutes ago'),
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { changeLanguage: vi.fn(), language: 'en' },
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Trans: ({ i18nKey, values }: any) => {
        const valuesText = values ? ' ' + Object.values(values).join(' ') : ''
        return (
            <span>
                {i18nKey}
                {valuesText}
            </span>
        )
    },
}))

const invitationItem = {
    type: 'multisig_import',
    data: {
        customId: 'msig-1',
        createdAt: new Date('2025-01-15T00:00:00Z'),
        address: 'DUA4ABCDEFGHIJK2ETI',
        version: 1,
        threshold: 2,
        participantAddresses: ['ADDR1', 'ADDR2'],
    },
    createdAt: new Date('2025-01-15T00:00:00Z'),
} as const satisfies Extract<InboxItemModel, { type: 'multisig_import' }>

describe('MultisigInvitationInboxItem', () => {
    it('renders the bold title segment, truncated address, CTA, and timestamp', () => {
        const { getByText, getByTestId } = render(
            <MultisigInvitationInboxItem item={invitationItem} />,
        )

        expect(getByText(/messages\.inbox\.invitation_title/)).toBeTruthy()
        expect(getByText(/DUA4A\.\.\.K2ETI/)).toBeTruthy()
        expect(getByText('messages.inbox.view_invitation_details')).toBeTruthy()
        expect(getByText('21 minutes ago')).toBeTruthy()
        expect(getByTestId('icon-accounts/light/multisig-account')).toBeTruthy()
    })

    it('calls onPress when the row is pressed', () => {
        const onPress = vi.fn()
        const { getByTestId } = render(
            <MultisigInvitationInboxItem
                item={invitationItem}
                onPress={onPress}
            />,
        )

        fireEvent.click(getByTestId('multisig_invitation_inbox_item'))

        expect(onPress).toHaveBeenCalledTimes(1)
    })

    it('calls onPress when the CTA pill is pressed', () => {
        const onPress = vi.fn()
        const { getByTestId } = render(
            <MultisigInvitationInboxItem
                item={invitationItem}
                onPress={onPress}
            />,
        )

        fireEvent.click(getByTestId('multisig_invitation_inbox_item_cta'))

        expect(onPress).toHaveBeenCalled()
    })
})
