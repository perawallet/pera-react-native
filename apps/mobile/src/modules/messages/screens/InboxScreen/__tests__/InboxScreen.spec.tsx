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
import { InboxScreen } from '../InboxScreen'
import { useInboxQuery } from '@perawallet/wallet-core-messages'

vi.mock('@modules/messages/components/InboxItem/InboxItem', () => ({
    InboxItem: ({ item }: { item: { type: string } }) => (
        <span>{item.type}</span>
    ),
}))

vi.mock(
    '@modules/messages/components/MultisigInvitationDetailBottomSheet',
    () => ({
        MultisigInvitationDetailBottomSheet: () => null,
    }),
)

vi.mock('@perawallet/wallet-core-messages', () => ({
    useInboxQuery: vi.fn(() => ({
        inboxItems: [],
        isPending: false,
        isRefetching: false,
        refetch: vi.fn(),
    })),
}))

describe('InboxScreen', () => {
    it('renders loading state when pending', () => {
        vi.mocked(useInboxQuery).mockReturnValue({
            data: undefined,
            isPending: true,
            isError: false,
            isRefetching: false,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useInboxQuery>)

        const { getAllByTestId } = render(<InboxScreen />)
        expect(getAllByTestId('RNESkeleton').length).toBeGreaterThan(0)
    })

    it('renders empty state when no inbox items', () => {
        vi.mocked(useInboxQuery).mockReturnValue({
            data: [],
            isPending: false,
            isRefetching: false,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useInboxQuery>)

        const { getByText } = render(<InboxScreen />)
        expect(getByText('messages.inbox.empty_title')).toBeTruthy()
    })

    it('renders inbox items when data is available', () => {
        vi.mocked(useInboxQuery).mockReturnValue({
            data: [
                {
                    type: 'asa_inbox',
                    data: {
                        address: 'ADDR1',
                        inboxAddress: 'INBOX1',
                        requestCount: 3,
                    },
                    createdAt: new Date(0),
                },
                {
                    type: 'multisig_import',
                    data: {
                        customId: 'msig-1',
                        createdAt: new Date('2025-01-15T00:00:00Z'),
                        address: 'MSIG_ADDR1',
                        version: 1,
                        threshold: 2,
                        participantAddresses: ['ADDR1', 'ADDR2'],
                    },
                    createdAt: new Date('2025-01-15T00:00:00Z'),
                },
            ],
            isPending: false,
            isRefetching: false,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useInboxQuery>)

        const { getByText } = render(<InboxScreen />)
        expect(getByText('asa_inbox')).toBeTruthy()
        expect(getByText('multisig_import')).toBeTruthy()
    })
})
