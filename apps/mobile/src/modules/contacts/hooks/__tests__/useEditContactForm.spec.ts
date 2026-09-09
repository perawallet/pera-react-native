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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    type Contact,
    DuplicateAddressError,
} from '@perawallet/wallet-core-contacts'
import { useEditContactForm } from '../useEditContactForm'

const editContactMock = vi.fn()
const deleteContactMock = vi.fn(() => true)
const setSelectedContactMock = vi.fn()
const goBackMock = vi.fn()
const replaceMock = vi.fn()
// Overridable per test: default (below) reflects the in-app path (a contact
// selected in the app, no route params); deeplink tests override the return.
const useContactsMock = vi.fn()
const showToastMock = vi.fn()
const isContactBackedUpMock = vi.fn(() => false)
const isCloudBackupEnabledMock = vi.fn(() => false)
const deleteContactFromBackupMock = vi.fn(async () => true)
const keepContactInBackupMock = vi.fn(async () => true)
// Overridable per test: default is the in-app path (no route params);
// deeplink/QR tests supply { params: { address, label } }.
const useRouteMock = vi.fn()

const selectedContact: Contact = {
    name: 'Alice',
    address: 'ALICE123',
}

vi.mock('@perawallet/wallet-core-contacts', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-contacts')
    >('@perawallet/wallet-core-contacts')
    return {
        ...actual,
        useContacts: () => useContactsMock(),
    }
})

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        goBack: goBackMock,
        replace: replaceMock,
    }),
    useRoute: () => useRouteMock(),
}))

vi.mock('@modules/cloud-backup', () => ({
    useIsContactBackedUp: () => isContactBackedUpMock(),
    DeleteFromBackupSheet: () => null,
}))

vi.mock('@hooks/useIsCloudBackupEnabled', () => ({
    useIsCloudBackupEnabled: () => isCloudBackupEnabledMock(),
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    getBackupSyncManager: () => ({
        deleteContactFromBackup: deleteContactFromBackupMock,
        keepContactInBackup: keepContactInBackupMock,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: showToastMock }),
}))

vi.mock('@hooks/useImagePicker', () => ({
    useImagePicker: () => ({
        pickFromGallery: vi.fn().mockResolvedValue(null),
    }),
}))

vi.mock('@hooks/useNfdResolve', () => ({
    useNfdResolve: () => ({
        resolvedAddress: '',
        isNfdResolved: false,
        isNfdResolving: false,
        nfdName: undefined,
    }),
}))

// Stub the underlying form hook so tests can control `isValid` / observe
// `setError` without wrestling with react-hook-form internals. It's a spy so
// tests can assert which contact the form was seeded from (the prefill).
const setErrorMock = vi.fn()
const formState = { isValid: false }
const useContactFormMock = vi.fn((_initialContact: Contact | null) => ({
    control: {} as unknown,
    handleSubmit: vi.fn(),
    setError: setErrorMock,
    errors: {},
    get isValid() {
        return formState.isValid
    },
    rawAddressInput: '',
    imageUri: undefined,
    nfd: {
        resolvedAddress: '',
        isNfdResolved: false,
        isNfdResolving: false,
        nfdName: undefined,
    },
    onAddressInputChange: vi.fn(),
    onPickImage: vi.fn(),
}))
vi.mock('../useContactForm', () => ({
    useContactForm: (initialContact: Contact | null) =>
        useContactFormMock(initialContact),
}))

describe('useEditContactForm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        editContactMock.mockReset()
        formState.isValid = false
        // Defaults = in-app path: a contact selected in the app, no route
        // params. Deeplink tests override useRouteMock / useContactsMock.
        useContactsMock.mockReturnValue({
            editContact: editContactMock,
            deleteContact: deleteContactMock,
            selectedContact,
            setSelectedContact: setSelectedContactMock,
            contacts: [],
        })
        useRouteMock.mockReturnValue({ params: undefined })
        deleteContactMock.mockReturnValue(true)
        isContactBackedUpMock.mockReturnValue(false)
        isCloudBackupEnabledMock.mockReturnValue(false)
        deleteContactFromBackupMock.mockResolvedValue(true)
        keepContactInBackupMock.mockResolvedValue(true)
    })

    it('exposes the selected contact from the store', () => {
        const { result } = renderHook(() => useEditContactForm())
        expect(result.current.contact).toEqual(selectedContact)
        // In-app path: the form is seeded from the store selection.
        expect(useContactFormMock).toHaveBeenCalledWith(selectedContact)
    })

    describe('deeplink / QR (route params)', () => {
        const bob: Contact = { name: 'Bob', address: 'BOB999' }

        it('targets the contact named by the deeplink address, not the stale in-app selection', () => {
            // Alice is selected in-app, but the link is for Bob's address.
            useContactsMock.mockReturnValue({
                editContact: editContactMock,
                deleteContact: deleteContactMock,
                selectedContact,
                setSelectedContact: setSelectedContactMock,
                contacts: [selectedContact, bob],
            })
            useRouteMock.mockReturnValue({ params: { address: bob.address } })

            const { result } = renderHook(() => useEditContactForm())

            // Form is seeded from Bob (resolved from the store by address).
            expect(result.current.contact).toEqual(bob)
            expect(useContactFormMock).toHaveBeenCalledWith(bob)

            // Delete targets Bob — NOT the stale Alice selection.
            act(() => {
                result.current.removeContact()
            })
            expect(deleteContactMock).toHaveBeenCalledWith(bob)
        })

        it('saves against the deeplink address', () => {
            useContactsMock.mockReturnValue({
                editContact: editContactMock,
                deleteContact: deleteContactMock,
                selectedContact,
                setSelectedContact: setSelectedContactMock,
                contacts: [selectedContact, bob],
            })
            useRouteMock.mockReturnValue({ params: { address: bob.address } })
            formState.isValid = true

            const { result } = renderHook(() => useEditContactForm())

            const updated: Contact = { name: 'Bobby', address: bob.address }
            act(() => {
                result.current.save(updated)
            })

            expect(editContactMock).toHaveBeenCalledWith(bob.address, updated)
            expect(goBackMock).toHaveBeenCalled()
        })

        it('prefills from the deeplink address+label when the contact is not in the store', () => {
            // Cold-start / force-quit case: nothing selected, contact absent.
            useContactsMock.mockReturnValue({
                editContact: editContactMock,
                deleteContact: deleteContactMock,
                selectedContact: null,
                setSelectedContact: setSelectedContactMock,
                contacts: [],
            })
            useRouteMock.mockReturnValue({
                params: { address: 'CAROL789', label: 'Carol' },
            })

            const { result } = renderHook(() => useEditContactForm())

            const expected: Contact = { address: 'CAROL789', name: 'Carol' }
            expect(result.current.contact).toEqual(expected)
            expect(useContactFormMock).toHaveBeenCalledWith(expected)
        })
    })

    it('deletes the selected contact and returns to the list on removeContact', () => {
        const { result } = renderHook(() => useEditContactForm())

        act(() => {
            result.current.removeContact()
        })

        expect(deleteContactMock).toHaveBeenCalledWith(selectedContact)
        expect(setSelectedContactMock).toHaveBeenCalledWith(null)
        expect(replaceMock).toHaveBeenCalledWith('Contacts')
    })

    it('no-ops save when the form is invalid (default state)', () => {
        const { result } = renderHook(() => useEditContactForm())

        act(() => {
            result.current.save({ ...selectedContact, name: 'Updated' })
        })

        expect(editContactMock).not.toHaveBeenCalled()
        expect(goBackMock).not.toHaveBeenCalled()
    })

    describe('duplicate-address guard', () => {
        it('forwards previousAddress so the store can identify the row being updated', () => {
            formState.isValid = true

            const { result } = renderHook(() => useEditContactForm())

            act(() => {
                result.current.save(selectedContact)
            })

            expect(setErrorMock).not.toHaveBeenCalled()
            expect(editContactMock).toHaveBeenCalledWith(
                selectedContact.address,
                selectedContact,
            )
            expect(goBackMock).toHaveBeenCalled()
        })

        it('blocks save and surfaces a form error when editContact throws DuplicateAddressError', () => {
            editContactMock.mockImplementation(() => {
                throw new DuplicateAddressError('BOB999')
            })
            formState.isValid = true

            const { result } = renderHook(() => useEditContactForm())

            act(() => {
                result.current.save({
                    ...selectedContact,
                    address: 'BOB999',
                })
            })

            expect(setErrorMock).toHaveBeenCalledWith(
                'address',
                expect.objectContaining({
                    message: expect.any(String),
                }),
            )
            expect(goBackMock).not.toHaveBeenCalled()
        })
    })

    // The store reports a no-match; a deeplink can name an address that was
    // never saved, so the target is synthesized and there is nothing to delete.
    it('does not report a delete when the store had nothing to remove', () => {
        deleteContactMock.mockReturnValue(false)
        useRouteMock.mockReturnValue({
            params: { address: 'NOTSAVED', label: 'Ghost' },
        })

        const { result } = renderHook(() => useEditContactForm())

        act(() => {
            result.current.removeContact()
        })

        expect(deleteContactMock).toHaveBeenCalled()
        expect(setSelectedContactMock).not.toHaveBeenCalled()
        expect(replaceMock).toHaveBeenCalledWith('Contacts')
    })

    describe('removing a contact the cloud backup holds', () => {
        beforeEach(() => {
            isCloudBackupEnabledMock.mockReturnValue(true)
            isContactBackedUpMock.mockReturnValue(true)
        })

        it('asks for a choice only when backup is on and the contact is in it', () => {
            const { result } = renderHook(() => useEditContactForm())

            expect(result.current.needsBackupChoice).toBe(true)

            isCloudBackupEnabledMock.mockReturnValue(false)
            const { result: off } = renderHook(() => useEditContactForm())

            expect(off.current.needsBackupChoice).toBe(false)
        })

        it('deletes the cloud copy when the user chooses Delete', async () => {
            const { result } = renderHook(() => useEditContactForm())

            await act(() => result.current.removeContact('delete'))

            expect(deleteContactFromBackupMock).toHaveBeenCalledWith(
                selectedContact.address,
            )
            expect(deleteContactMock).toHaveBeenCalledWith(selectedContact)
        })

        it('keeps the cloud copy, named, when the user chooses Keep it', async () => {
            const { result } = renderHook(() => useEditContactForm())

            await act(() => result.current.removeContact('keep'))

            expect(keepContactInBackupMock).toHaveBeenCalledWith(
                selectedContact.address,
                selectedContact.name,
            )
            expect(deleteContactMock).toHaveBeenCalledWith(selectedContact)
        })

        it('leaves the contact on the device when the backup choice fails', async () => {
            deleteContactFromBackupMock.mockResolvedValue(false)
            const { result } = renderHook(() => useEditContactForm())

            await act(() => result.current.removeContact('delete'))

            expect(deleteContactMock).not.toHaveBeenCalled()
            expect(replaceMock).not.toHaveBeenCalled()
            expect(showToastMock).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'error' }),
            )
        })
    })
})
