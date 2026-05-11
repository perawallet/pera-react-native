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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@test-utils/render'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { ContactQRContent } from '../ContactQRContent'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: vi.fn() }),
}))

vi.mock('react-native-qrcode-svg', () => ({
    default: () => null,
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    truncateAlgorandAddress: (addr: string) => addr,
}))

const mockContact = {
    id: '1',
    name: 'Alice',
    address: 'ABC123',
}

const renderWithId = (id = 'sheet-1') =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <ContactQRContent contact={mockContact} />
        </BottomSheetIdContext.Provider>,
    )

describe('ContactQRContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
    })

    it('renders the contact name and address', () => {
        renderWithId()
        expect(screen.getByText('Alice')).toBeTruthy()
        expect(screen.getByText('ABC123')).toBeTruthy()
    })

    it('renders copy and share actions', () => {
        renderWithId()
        expect(screen.getByText('contacts.list.qr_sheet_copy')).toBeTruthy()
        expect(screen.getByText('contacts.list.qr_sheet_share')).toBeTruthy()
    })
})
