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
import { useAddContactForm } from '../useAddContactForm'

const saveContactMock = vi.fn()
const setSelectedContactMock = vi.fn()
const findContactsMock = vi.fn<() => Contact[]>(() => [])
const goBackMock = vi.fn()

vi.mock('@perawallet/wallet-core-contacts', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-contacts')
    >('@perawallet/wallet-core-contacts')
    return {
        ...actual,
        useContacts: vi.fn(() => ({
            saveContact: saveContactMock,
            findContacts: findContactsMock,
            setSelectedContact: setSelectedContactMock,
            contacts: [],
            deleteContact: vi.fn(),
            selectedContact: null,
        })),
    }
})

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ goBack: goBackMock }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
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

// Stub useContactForm so tests can control `isValid` / observe `setError`
// without wrestling with react-hook-form internals.
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

describe('useAddContactForm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        findContactsMock.mockReturnValue([])
        formState.isValid = false
    })

    it('no-ops save when the form is invalid (default state)', () => {
        const { result } = renderHook(() => useAddContactForm())

        act(() => {
            result.current.save({ name: '', address: '' })
        })

        expect(saveContactMock).not.toHaveBeenCalled()
        expect(goBackMock).not.toHaveBeenCalled()
        expect(setErrorMock).not.toHaveBeenCalled()
    })

    it('surfaces a duplicate-address error when findContacts returns matches', () => {
        const existing: Contact = {
            id: 'existing',
            name: 'Alice',
            address: 'ALICE123',
        }
        findContactsMock.mockReturnValue([existing])
        formState.isValid = true

        const { result } = renderHook(() => useAddContactForm())
        const newContact: Contact = { name: 'Bob', address: 'ALICE123' }

        act(() => {
            result.current.save(newContact)
        })

        expect(saveContactMock).not.toHaveBeenCalled()
        expect(goBackMock).not.toHaveBeenCalled()
        expect(setErrorMock).toHaveBeenCalledWith(
            'address',
            expect.objectContaining({
                message: 'contacts.add_contact.duplicate_address_error',
            }),
        )
    })

    it('saves and navigates back when form is valid and no duplicates', () => {
        formState.isValid = true

        const { result } = renderHook(() => useAddContactForm())
        const newContact: Contact = { name: 'Bob', address: 'BOB999' }

        act(() => {
            result.current.save(newContact)
        })

        expect(saveContactMock).toHaveBeenCalledWith(newContact)
        expect(setSelectedContactMock).toHaveBeenCalledWith(null)
        expect(goBackMock).toHaveBeenCalled()
    })
})
