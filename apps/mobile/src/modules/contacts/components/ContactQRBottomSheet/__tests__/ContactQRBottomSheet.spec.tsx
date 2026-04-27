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
import type { Contact } from '@perawallet/wallet-core-contacts'
import { ContactQRBottomSheet } from '../ContactQRBottomSheet'
import { shareText } from '@utils/shareText'

const copyToClipboard = vi.fn()

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard }),
}))

vi.mock('@utils/shareText', () => ({
    shareText: vi.fn().mockResolvedValue(undefined),
}))

describe('ContactQRBottomSheet', () => {
    const contact: Contact = {
        name: 'Alice',
        address: 'ALICE123456789ABCDEFGHIJKLMNOPQRSTUVWXYZALICE12345ABC',
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders the contact name and address when a contact is provided', () => {
        render(
            <ContactQRBottomSheet
                contact={contact}
                onClose={vi.fn()}
            />,
        )
        expect(screen.getByText(contact.name)).toBeTruthy()
        // Full address is rendered at least once (short truncation + full).
        expect(screen.getAllByText(contact.address).length).toBeGreaterThan(0)
    })

    it('copies the contact address to the clipboard when Copy is pressed', () => {
        render(
            <ContactQRBottomSheet
                contact={contact}
                onClose={vi.fn()}
            />,
        )
        fireEvent.click(screen.getByText('contacts.list.qr_sheet_copy'))
        expect(copyToClipboard).toHaveBeenCalledWith(contact.address)
    })

    it('invokes the share sheet with the contact name + address when Share is pressed', () => {
        render(
            <ContactQRBottomSheet
                contact={contact}
                onClose={vi.fn()}
            />,
        )
        fireEvent.click(screen.getByText('contacts.list.qr_sheet_share'))
        expect(shareText).toHaveBeenCalledWith({
            title: contact.name,
            message: contact.address,
        })
    })

    it('renders nothing when contact is null', () => {
        render(
            <ContactQRBottomSheet
                contact={null}
                onClose={vi.fn()}
            />,
        )
        expect(screen.queryByText(contact.name)).toBeNull()
    })
})
