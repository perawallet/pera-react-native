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
import { act, renderHook } from '@testing-library/react'
import type { Contact } from '@perawallet/wallet-core-contacts'
import { useContactListScreen } from '../useContactListScreen'

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    setSelectedContact: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContacts: () => ({
        contacts: [],
        findContacts: () => [],
        setSelectedContact: mocks.setSelectedContact,
    }),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mocks.navigate }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: vi.fn() }),
}))

vi.mock('@modules/contacts/components/ContactQRContent', () => ({
    ContactQRContent: () => null,
}))

describe('useContactListScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('clears the selected contact and opens the add-contact screen', () => {
        const { result } = renderHook(() => useContactListScreen())

        act(() => result.current.goToAddContact())

        expect(mocks.setSelectedContact).toHaveBeenCalledWith(null)
        expect(mocks.navigate).toHaveBeenCalledWith('AddContact')
    })

    it('keys a contact row by its id', () => {
        const { result } = renderHook(() => useContactListScreen())

        expect(
            result.current.keyExtractor({ id: 'contact-1' } as Contact),
        ).toBe('contact-1')
    })
})
