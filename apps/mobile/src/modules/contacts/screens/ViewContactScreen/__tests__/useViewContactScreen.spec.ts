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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { type Contact, useContacts } from '@perawallet/wallet-core-contacts'

import { useViewContactScreen } from '../useViewContactScreen'

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    requestBottomSheet: vi.fn(),
    shareText: vi.fn(),
    useNfdForAddressQuery: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-nfd', () => ({
    useNfdForAddressQuery: mocks.useNfdForAddressQuery,
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mocks.requestBottomSheet }),
}))

vi.mock('@modules/contacts/components/ContactQRContent', () => ({
    ContactQRContent: () => null,
}))

vi.mock('@utils/shareText', () => ({
    shareText: mocks.shareText,
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mocks.navigate }),
}))

const CONTACT: Contact = {
    id: 'contact-1',
    name: 'Alice',
    addresses: { algorand: 'ALICE_ADDRESS' },
}

const selectContact = (contact: Contact | null): void => {
    vi.mocked(useContacts).mockReturnValue({
        selectedContact: contact,
    } as unknown as ReturnType<typeof useContacts>)
}

describe('useViewContactScreen', () => {
    beforeEach(() => {
        selectContact(CONTACT)
        mocks.useNfdForAddressQuery.mockReturnValue({
            data: [{ name: 'alice.algo' }, { name: 'second.algo' }],
        })
        mocks.shareText.mockResolvedValue(undefined)
    })

    it('exposes the contact address and its first NFD name', () => {
        const { result } = renderHook(() => useViewContactScreen())

        expect(result.current.address).toBe('ALICE_ADDRESS')
        expect(result.current.nfdName).toBe('alice.algo')
        expect(mocks.useNfdForAddressQuery).toHaveBeenCalledWith(
            expect.anything(),
            'ALICE_ADDRESS',
            { enabled: true },
        )
    })

    it('opens the contact QR sheet', () => {
        const { result } = renderHook(() => useViewContactScreen())

        act(() => result.current.openQR())

        expect(mocks.requestBottomSheet).toHaveBeenCalledWith({
            contents: expect.objectContaining({
                props: { contact: CONTACT },
            }),
            options: { size: 'auto', enablePanDownToClose: true },
        })
    })

    it('navigates to the edit screen', () => {
        const { result } = renderHook(() => useViewContactScreen())

        act(() => result.current.goToEdit())

        expect(mocks.navigate).toHaveBeenCalledWith('EditContact')
    })

    it('shares the contact name and address', async () => {
        const { result } = renderHook(() => useViewContactScreen())

        await act(() => result.current.handleShare())

        expect(mocks.shareText).toHaveBeenCalledWith({
            title: 'Alice',
            message: 'ALICE_ADDRESS',
        })
    })

    it('swallows a cancelled share', async () => {
        mocks.shareText.mockRejectedValue(new Error('cancelled'))
        const { result } = renderHook(() => useViewContactScreen())

        await expect(
            act(() => result.current.handleShare()),
        ).resolves.toBeUndefined()
    })

    describe('when the contact is missing or was deleted', () => {
        beforeEach(() => {
            selectContact(null)
            mocks.useNfdForAddressQuery.mockReturnValue({ data: undefined })
        })

        it('has an empty address and skips the NFD lookup', () => {
            const { result } = renderHook(() => useViewContactScreen())

            expect(result.current.address).toBe('')
            expect(result.current.nfdName).toBeUndefined()
            expect(mocks.useNfdForAddressQuery).toHaveBeenCalledWith(
                expect.anything(),
                '',
                { enabled: false },
            )
        })

        it('opens no QR sheet', () => {
            const { result } = renderHook(() => useViewContactScreen())

            act(() => result.current.openQR())

            expect(mocks.requestBottomSheet).not.toHaveBeenCalled()
        })

        it('shares nothing', async () => {
            const { result } = renderHook(() => useViewContactScreen())

            await act(() => result.current.handleShare())

            expect(mocks.shareText).not.toHaveBeenCalled()
        })
    })
})
