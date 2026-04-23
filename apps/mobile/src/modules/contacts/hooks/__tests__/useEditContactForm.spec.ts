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
import type { Contact } from '@perawallet/wallet-core-contacts'
import { useEditContactForm } from '../useEditContactForm'

const saveContactMock = vi.fn()
const deleteContactMock = vi.fn()
const setSelectedContactMock = vi.fn()
const findContactsMock = vi.fn<(...args: unknown[]) => Contact[]>(() => [])
const goBackMock = vi.fn()
const replaceMock = vi.fn()

const selectedContact: Contact = {
    id: 'test-id',
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
            saveContact: saveContactMock,
            deleteContact: deleteContactMock,
            selectedContact,
            setSelectedContact: setSelectedContactMock,
            contacts: [],
            findContacts: findContactsMock,
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
        findContactsMock.mockReturnValue([])
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

    it('exposes a confirmDelete modal handle with open/close', () => {
        const { result } = renderHook(() => useEditContactForm())
        expect(result.current.confirmDelete.isOpen).toBe(false)

        act(() => {
            result.current.confirmDelete.open()
        })
        expect(result.current.confirmDelete.isOpen).toBe(true)

        act(() => {
            result.current.confirmDelete.close()
        })
        expect(result.current.confirmDelete.isOpen).toBe(false)
    })

    it('no-ops save when the form is invalid (default state)', () => {
        const { result } = renderHook(() => useEditContactForm())

        act(() => {
            result.current.save({ ...selectedContact, name: 'Updated' })
        })

        expect(saveContactMock).not.toHaveBeenCalled()
        expect(goBackMock).not.toHaveBeenCalled()
    })

    describe('duplicate-address guard', () => {
        it('excludes the current contact when checking duplicates (self-edit succeeds)', () => {
            // findContacts returns the contact being edited — its own id must be
            // filtered out so saving without changing the address still works.
            findContactsMock.mockReturnValue([selectedContact])
            formState.isValid = true

            const { result } = renderHook(() => useEditContactForm())

            act(() => {
                result.current.save(selectedContact)
            })

            expect(setErrorMock).not.toHaveBeenCalled()
            expect(saveContactMock).toHaveBeenCalledWith(selectedContact)
            expect(goBackMock).toHaveBeenCalled()
        })

        it('blocks save when another contact already uses the target address', () => {
            const otherContact: Contact = {
                id: 'other-id',
                name: 'Bob',
                address: 'BOB999',
            }
            findContactsMock.mockReturnValue([otherContact])
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
            expect(saveContactMock).not.toHaveBeenCalled()
            expect(goBackMock).not.toHaveBeenCalled()
        })
    })
})
