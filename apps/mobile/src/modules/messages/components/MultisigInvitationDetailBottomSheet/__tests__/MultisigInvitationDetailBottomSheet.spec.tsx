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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MultisigInvitationDetailBottomSheet } from '../MultisigInvitationDetailBottomSheet'
import type { MultisigInvitationParam } from '../../../routes/types'

const mockHandleIgnore = vi.fn()
const mockHandleAccept = vi.fn()

const invitation: MultisigInvitationParam = {
    customId: 'invite-1',
    createdAt: '2025-01-15T00:00:00.000Z',
    address: 'MSIGADDRESS1234567890',
    version: 1,
    threshold: 2,
    participantAddresses: ['ADDR1', 'ADDR2', 'ADDR3'],
}

const hookResult = {
    renderedInvitation: invitation as MultisigInvitationParam | null,
    totalParticipants: invitation.participantAddresses.length,
    isIgnoring: false,
    isUserIncluded: true,
    handleIgnore: mockHandleIgnore,
    handleAccept: mockHandleAccept,
}

vi.mock('../useMultisigInvitationDetailBottomSheet', () => ({
    useMultisigInvitationDetailBottomSheet: () => hookResult,
}))

vi.mock('../components/ParticipantRow', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ParticipantRow: ({ address, testID }: any) => (
        <span data-testid={testID}>{address}</span>
    ),
}))

describe('MultisigInvitationDetailBottomSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        hookResult.renderedInvitation = invitation
        hookResult.totalParticipants = invitation.participantAddresses.length
        hookResult.isIgnoring = false
        hookResult.isUserIncluded = true
    })

    it('renders one row per participant address', () => {
        const { getByTestId } = render(
            <MultisigInvitationDetailBottomSheet
                invitation={invitation}
                onClose={vi.fn()}
            />,
        )

        invitation.participantAddresses.forEach(address => {
            expect(getByTestId(`participant_row_${address}`)).toBeTruthy()
        })
    })

    it('renders participant count and threshold value', () => {
        const { getByTestId } = render(
            <MultisigInvitationDetailBottomSheet
                invitation={invitation}
                onClose={vi.fn()}
            />,
        )

        expect(
            getByTestId('multisig_invitation_participant_count').textContent,
        ).toBe('3')
        expect(
            getByTestId('multisig_invitation_threshold_value').textContent,
        ).toBe('2')
    })

    it('shows "You included" copy when user is a participant', () => {
        const { getByText } = render(
            <MultisigInvitationDetailBottomSheet
                invitation={invitation}
                onClose={vi.fn()}
            />,
        )

        expect(getByText('multisig.invitation.you_included')).toBeTruthy()
    })

    it('hides "You included" copy when user is not a participant', () => {
        hookResult.isUserIncluded = false

        const { queryByText } = render(
            <MultisigInvitationDetailBottomSheet
                invitation={invitation}
                onClose={vi.fn()}
            />,
        )

        expect(queryByText('multisig.invitation.you_included')).toBeNull()
    })

    it('pressing Ignore calls handleIgnore', () => {
        const { getByTestId } = render(
            <MultisigInvitationDetailBottomSheet
                invitation={invitation}
                onClose={vi.fn()}
            />,
        )

        fireEvent.click(getByTestId('multisig_invitation_ignore_button'))

        expect(mockHandleIgnore).toHaveBeenCalled()
    })

    it('pressing Add to Accounts calls handleAccept', () => {
        const { getByTestId } = render(
            <MultisigInvitationDetailBottomSheet
                invitation={invitation}
                onClose={vi.fn()}
            />,
        )

        fireEvent.click(getByTestId('multisig_invitation_accept_button'))

        expect(mockHandleAccept).toHaveBeenCalled()
    })
})
