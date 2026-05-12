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

import { fireEvent, render, screen } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ViewContactScreen } from '../ViewContactScreen'

const mockUseContacts = vi.fn()
const mockUseNfdForAddress = vi.fn()
const mockNavigate = vi.fn()
const mockShareText = vi.fn()
const mockRequestBottomSheet = vi.fn()

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
    }),
}))

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContacts: (...args: Parameters<typeof mockUseContacts>) =>
        mockUseContacts(...args),
}))

vi.mock('@perawallet/wallet-core-nfd', () => ({
    useNfdForAddressQuery: (...args: Parameters<typeof mockUseNfdForAddress>) =>
        mockUseNfdForAddress(...args),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

vi.mock('@utils/shareText', () => ({
    shareText: (...args: Parameters<typeof mockShareText>) =>
        mockShareText(...args),
}))

// Capture the header config so we can exercise share/edit buttons that
// live outside the screen's rendered output.
let capturedHeaderRight: React.ReactNode = null
vi.mock('@hooks/useNavigationHeader', () => ({
    useNavigationHeader: ({ right }: { right: React.ReactNode }) => {
        capturedHeaderRight = right
    },
}))

const CONTACT = {
    id: 'c1',
    name: 'Alice',
    // 58-char Algorand-shaped address so truncation produces a distinct
    // shortened form from the full address.
    address: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
}

describe('ViewContactScreen', () => {
    beforeEach(() => {
        mockUseContacts.mockReset()
        mockUseNfdForAddress.mockReset()
        mockNavigate.mockReset()
        mockShareText.mockReset()
        mockRequestBottomSheet.mockReset()
        capturedHeaderRight = null

        mockUseContacts.mockReturnValue({ selectedContact: CONTACT })
        mockUseNfdForAddress.mockReturnValue({ data: [] })
    })

    it('renders the contact name and full address', () => {
        render(<ViewContactScreen />)
        expect(screen.getByText(CONTACT.name)).toBeTruthy()
        // Full address shows inside the copyable block; there are also
        // truncated views of it, so assert at least one match.
        expect(screen.getAllByText(CONTACT.address).length).toBeGreaterThan(0)
    })

    it('renders an EmptyView when no contact is selected', () => {
        mockUseContacts.mockReturnValue({ selectedContact: null })
        render(<ViewContactScreen />)
        expect(
            screen.getByText('contacts.view_contact.no_contact_title'),
        ).toBeTruthy()
        expect(screen.queryByText(CONTACT.name)).toBeNull()
    })

    it('renders the NFD section when a name is resolved', () => {
        mockUseNfdForAddress.mockReturnValue({
            data: [{ name: 'alice.algo' }],
        })
        render(<ViewContactScreen />)
        // AddressDisplay also consults NFD internally — `alice.algo` may
        // appear twice (once from our NFD section, once inside AddressDisplay
        // under the mocked response). We only care that the NFD label mounts.
        expect(screen.getAllByText('alice.algo').length).toBeGreaterThanOrEqual(
            1,
        )
        expect(screen.getByText('contacts.view_contact.nfd_label')).toBeTruthy()
    })

    it('does not render the NFD section when no name resolves', () => {
        render(<ViewContactScreen />)
        expect(screen.queryByText('contacts.view_contact.nfd_label')).toBeNull()
    })

    it('opens the QR sheet when the QR icon is pressed', () => {
        render(<ViewContactScreen />)
        const qrIcon = screen.getByTestId('touchable-icon-qr')
        fireEvent.click(qrIcon)
        // The QR sheet is requested via the bottom-sheet manager; assert that
        // the request was issued with a ContactQRContent element bound to this
        // contact rather than reaching into the sheet's rendered output.
        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        const arg = mockRequestBottomSheet.mock.calls[0][0]
        const contents = arg.contents as React.ReactElement<{
            contact: typeof CONTACT
        }>
        expect(contents.props.contact).toBe(CONTACT)
    })

    it('navigates to the EditContact screen when the header edit icon is pressed', () => {
        render(<ViewContactScreen />)
        // Render the captured header-right subtree and click the edit icon.
        render(<>{capturedHeaderRight}</>)
        fireEvent.click(screen.getByTestId('touchable-icon-edit-pen'))
        expect(mockNavigate).toHaveBeenCalledWith('EditContact')
    })

    it('invokes shareText with the contact name and address when share is pressed', () => {
        mockShareText.mockResolvedValue(undefined)
        render(<ViewContactScreen />)
        render(<>{capturedHeaderRight}</>)
        fireEvent.click(screen.getByTestId('touchable-icon-share'))
        expect(mockShareText).toHaveBeenCalledWith({
            title: CONTACT.name,
            message: CONTACT.address,
        })
    })

    it('swallows share rejection (user-cancelled) without throwing', async () => {
        mockShareText.mockRejectedValue(new Error('user cancelled'))
        render(<ViewContactScreen />)
        render(<>{capturedHeaderRight}</>)
        // This must not throw — the screen's catch-all handles it.
        expect(() =>
            fireEvent.click(screen.getByTestId('touchable-icon-share')),
        ).not.toThrow()
    })
})
