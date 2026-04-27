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
import { InboxItem } from '../InboxItem'
import type { InboxItem as InboxItemModel } from '@perawallet/wallet-core-messages'
import type { Nullable } from '@perawallet/wallet-core-shared'

vi.mock('@perawallet/wallet-core-shared', () => ({
    truncateAlgorandAddress: vi.fn(
        (addr: string) => `${addr.slice(0, 5)}...${addr.slice(-5)}`,
    ),
    formatRelativeTime: vi.fn(() => 'just now'),
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

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn(() => []),
    getAccountDisplayName: vi.fn((account: Nullable<{ address: string }>) =>
        account
            ? `${account.address.slice(0, 5)}...${account.address.slice(-5)}`
            : 'No Account',
    ),
    AccountTypes: {},
}))

describe('InboxItem', () => {
    it('renders ASA inbox item with request count', () => {
        const item: InboxItemModel = {
            type: 'asa_inbox',
            data: {
                address: 'TESTADDRESS123456789',
                inboxAddress: 'INBOX_ADDR',
                requestCount: 3,
            },
            createdAt: new Date(0),
        }

        const { getByText, getByTestId } = render(<InboxItem item={item} />)
        expect(getByText('messages.inbox.asa_requests')).toBeTruthy()
        expect(getByTestId('unread_indicator_dot')).toBeTruthy()
    })

    it('hides the unread dot for ASA inbox item with no pending requests', () => {
        const item: InboxItemModel = {
            type: 'asa_inbox',
            data: {
                address: 'TESTADDRESS123456789',
                inboxAddress: null,
                requestCount: 0,
            },
            createdAt: new Date(0),
        }

        const { queryByTestId } = render(<InboxItem item={item} />)
        expect(queryByTestId('unread_indicator_dot')).toBeNull()
    })

    it('renders ASA inbox item with account display name', () => {
        const item: InboxItemModel = {
            type: 'asa_inbox',
            data: {
                address: 'TESTADDRESS123456789',
                inboxAddress: null,
                requestCount: 1,
            },
            createdAt: new Date(0),
        }

        const { getByText } = render(<InboxItem item={item} />)
        expect(getByText('No Account')).toBeTruthy()
    })

    it('renders joint account import invitation with new layout', () => {
        const item: InboxItemModel = {
            type: 'multisig_import',
            data: {
                customId: 'msig-1',
                createdAt: new Date('2025-01-15T00:00:00Z'),
                address: 'MSIGADDRESS12345678',
                version: 1,
                threshold: 2,
                participantAddresses: ['ADDR1', 'ADDR2'],
            },
            createdAt: new Date('2025-01-15T00:00:00Z'),
        }

        const { getByText, getByTestId } = render(<InboxItem item={item} />)
        expect(getByText(/messages\.inbox\.invitation_title/)).toBeTruthy()
        expect(getByText('messages.inbox.view_invitation_details')).toBeTruthy()
        expect(getByTestId('multisig_invitation_inbox_item')).toBeTruthy()
        expect(getByTestId('unread_indicator_dot')).toBeTruthy()
    })

    it('renders joint account sign request item with status', () => {
        const item: InboxItemModel = {
            type: 'multisig_sign',
            data: {
                id: '1',
                status: 'pending',
                type: 'transfer',
                createdAt: new Date('2025-01-20T00:00:00Z'),
                expectedExpireDatetime: new Date('2025-01-21T00:00:00Z'),
                failReasonDisplay: null,
                multisigAccount: {
                    customId: 'msig-1',
                    createdAt: new Date('2025-01-10T00:00:00Z'),
                    address: 'MSIG_ADDR',
                    version: 1,
                    threshold: 2,
                    participantAddresses: ['ADDR1', 'ADDR2'],
                },
                transactionLists: [],
            },
            createdAt: new Date('2025-01-20T00:00:00Z'),
        }

        const { getByText, getByTestId } = render(<InboxItem item={item} />)
        expect(getByText('messages.inbox.multisig_sign')).toBeTruthy()
        expect(getByText('pending')).toBeTruthy()
        expect(getByTestId('unread_indicator_dot')).toBeTruthy()
    })

    it('hides the unread dot for a confirmed joint account sign request', () => {
        const item: InboxItemModel = {
            type: 'multisig_sign',
            data: {
                id: '2',
                status: 'confirmed',
                type: 'transfer',
                createdAt: new Date('2025-01-20T00:00:00Z'),
                expectedExpireDatetime: new Date('2025-01-21T00:00:00Z'),
                failReasonDisplay: null,
                multisigAccount: {
                    customId: 'msig-1',
                    createdAt: new Date('2025-01-10T00:00:00Z'),
                    address: 'MSIG_ADDR',
                    version: 1,
                    threshold: 2,
                    participantAddresses: ['ADDR1', 'ADDR2'],
                },
                transactionLists: [],
            },
            createdAt: new Date('2025-01-20T00:00:00Z'),
        }

        const { queryByTestId } = render(<InboxItem item={item} />)
        expect(queryByTestId('unread_indicator_dot')).toBeNull()
    })

    it('renders correct icon for each item type', () => {
        const asaItem: InboxItemModel = {
            type: 'asa_inbox',
            data: {
                address: 'ADDR1',
                inboxAddress: null,
                requestCount: 1,
            },
            createdAt: new Date(0),
        }

        const { getByTestId } = render(<InboxItem item={asaItem} />)
        expect(getByTestId('icon-inbox')).toBeTruthy()
    })

    it('renders multisig-account avatar for joint account import', () => {
        const importItem: InboxItemModel = {
            type: 'multisig_import',
            data: {
                customId: 'msig-1',
                createdAt: new Date('2025-01-15T00:00:00Z'),
                address: 'MSIG_ADDR',
                version: 1,
                threshold: 2,
                participantAddresses: ['ADDR1', 'ADDR2'],
            },
            createdAt: new Date('2025-01-15T00:00:00Z'),
        }

        const { getByTestId } = render(<InboxItem item={importItem} />)
        expect(getByTestId('icon-accounts/light/multisig-account')).toBeTruthy()
    })

    it('renders edit-pen icon for sign requests', () => {
        const signItem: InboxItemModel = {
            type: 'multisig_sign',
            data: {
                id: '1',
                status: 'ready',
                type: 'transfer',
                createdAt: new Date('2025-01-20T00:00:00Z'),
                expectedExpireDatetime: new Date('2025-01-21T00:00:00Z'),
                failReasonDisplay: null,
                multisigAccount: {
                    customId: 'msig-1',
                    createdAt: new Date('2025-01-10T00:00:00Z'),
                    address: 'MSIG_ADDR',
                    version: 1,
                    threshold: 2,
                    participantAddresses: ['ADDR1', 'ADDR2'],
                },
                transactionLists: [],
            },
            createdAt: new Date('2025-01-20T00:00:00Z'),
        }

        const { getByTestId } = render(<InboxItem item={signItem} />)
        expect(getByTestId('icon-edit-pen')).toBeTruthy()
    })
})
