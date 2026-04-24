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

import { render, screen } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ParticipantRow } from '../ParticipantRow'

const mockUseAllAccounts = vi.fn(() => [] as unknown[])
const mockFindContacts = vi.fn(() => [] as unknown[])
const mockUseNfdForAddress = vi.fn(() => ({
    data: undefined as { name: string }[] | undefined,
    isPending: false,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => mockUseAllAccounts(),
}))

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContacts: () => ({ findContacts: mockFindContacts }),
}))

vi.mock('@perawallet/wallet-core-nfd', () => ({
    useNfdForAddressQuery: (...args: Parameters<typeof mockUseNfdForAddress>) =>
        mockUseNfdForAddress(...args),
}))

describe('ParticipantRow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAllAccounts.mockReturnValue([])
        mockFindContacts.mockReturnValue([])
        mockUseNfdForAddress.mockReturnValue({
            data: undefined,
            isPending: false,
        })
    })

    it('renders only the truncated address when no NFD, contact or local account matches', () => {
        const address = 'ABCDEFGHIJ1234567890KLMNOPQRST'
        render(<ParticipantRow address={address} />)

        const matches = screen.getAllByText(/ABC/)
        expect(matches).toHaveLength(1)
    })

    it('renders NFD name as primary with truncated address as secondary', () => {
        mockUseNfdForAddress.mockReturnValue({
            data: [{ name: 'alice.algo' }],
            isPending: false,
        })

        const address = 'ABCDEFGHIJ1234567890KLMNOPQRST'
        render(<ParticipantRow address={address} />)

        expect(screen.getByText('alice.algo')).toBeTruthy()
        expect(screen.getByText(/ABC/)).toBeTruthy()
    })

    it('renders truncated address as primary and contact name as secondary when the address matches a contact', () => {
        const address = 'ABCDEFGHIJ1234567890KLMNOPQRST'
        mockFindContacts.mockReturnValue([{ name: 'Joseph', address }])

        render(<ParticipantRow address={address} />)

        expect(screen.getByText('Joseph')).toBeTruthy()
        expect(screen.getByText(/ABC/)).toBeTruthy()
    })

    it('renders the "(You)" label when the address matches a local account', () => {
        const address = 'ABCDEFGHIJ1234567890KLMNOPQRST'
        mockUseAllAccounts.mockReturnValue([{ name: 'My Wallet', address }])

        render(<ParticipantRow address={address} />)

        expect(
            screen.getByText('multisig.invitation.participant_address_you'),
        ).toBeTruthy()
        expect(screen.queryByText('My Wallet')).toBeNull()
    })

    it('prefers the "(You)" label over NFD and contact matches', () => {
        const address = 'ABCDEFGHIJ1234567890KLMNOPQRST'
        mockUseAllAccounts.mockReturnValue([{ name: 'My Wallet', address }])
        mockUseNfdForAddress.mockReturnValue({
            data: [{ name: 'alice.algo' }],
            isPending: false,
        })
        mockFindContacts.mockReturnValue([{ name: 'Joseph', address }])

        render(<ParticipantRow address={address} />)

        expect(
            screen.getByText('multisig.invitation.participant_address_you'),
        ).toBeTruthy()
        expect(screen.queryByText('alice.algo')).toBeNull()
        expect(screen.queryByText('Joseph')).toBeNull()
    })

    it('passes the given testID to the row', () => {
        render(
            <ParticipantRow
                address='ABCDEFGHIJ1234567890'
                testID='participant_row_test'
            />,
        )

        expect(screen.getByTestId('participant_row_test')).toBeTruthy()
    })
})
