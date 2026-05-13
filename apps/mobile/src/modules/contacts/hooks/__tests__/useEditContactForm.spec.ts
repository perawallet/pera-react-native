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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    type Contact,
    DuplicateAddressError,
} from '@perawallet/wallet-core-contacts'
import { useEditContactForm } from '../useEditContactForm'

const editContactMock = vi.fn()
const deleteContactMock = vi.fn()
const setSelectedContactMock = vi.fn()
const goBackMock = vi.fn()
const replaceMock = vi.fn()

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
        useContacts: vi.fn(() => ({
            editContact: editContactMock,
            deleteContact: deleteContactMock,
            selectedContact,
            setSelectedContact: setSelectedContactMock,
            contacts: [],
        })),
    }
})

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        goBack: goBackMock,
        replace: replaceMock,
    }),
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
// `setError` without wrestling with react-hook-form internals.
const setErrorMock = vi.fn()
const formState = { isValid: false }
vi.mock('../useContactForm', () => ({
    useContactForm: () => ({
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
    }),
}))

describe('useEditContactForm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        editContactMock.mockReset()
        formState.isValid = false
    })

    it('exposes the selected contact from the store', () => {
        const { result } = renderHook(() => useEditContactForm())
        expect(result.current.selectedContact).toEqual(selectedContact)
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
})
