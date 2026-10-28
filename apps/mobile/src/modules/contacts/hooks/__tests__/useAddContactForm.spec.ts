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
import { useAddContactForm } from '../useAddContactForm'

const addContactMock = vi.fn()
const setSelectedContactMock = vi.fn()
const goBackMock = vi.fn()

vi.mock('@perawallet/wallet-core-contacts', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-contacts')
    >('@perawallet/wallet-core-contacts')
    return {
        ...actual,
        useContacts: vi.fn(() => ({
            addContact: addContactMock,
            setSelectedContact: setSelectedContactMock,
            contacts: [],
            deleteContact: vi.fn(),
            selectedContact: null,
        })),
    }
})

const routeParamsRef: {
    params: { address?: string; label?: string; chainId?: string }
} = {
    params: {},
}

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ goBack: goBackMock }),
    useRoute: () => ({ params: routeParamsRef.params }),
}))

vi.mock('../../utils/contactFamily', () => ({
    contactFamilyOf: (chainId?: string) =>
        chainId === 'ethereum' ? 'evm' : 'algorand',
}))

// Stub useContactForm so tests can control `isValid` / observe `setError`
// without wrestling with react-hook-form internals. The `useContactFormMock`
// also captures the `initialContact` arg so we can assert that route-param
// prefill is forwarded.
const setErrorMock = vi.fn()
const formState = { isValid: false }
const useContactFormMock = vi.fn((_initialContact: unknown) => ({
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
    useContactForm: (initialContact: unknown) =>
        useContactFormMock(initialContact),
}))

describe('useAddContactForm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        addContactMock.mockReset()
        formState.isValid = false
        routeParamsRef.params = {}
    })

    it('forwards address + label route params as the form prefill', () => {
        routeParamsRef.params = { address: 'PREFILLED', label: 'Alice' }

        renderHook(() => useAddContactForm())

        expect(useContactFormMock).toHaveBeenCalledWith({
            addresses: { algorand: 'PREFILLED' },
            name: 'Alice',
        })
    })

    it("prefills the entry of the link's chain family", () => {
        routeParamsRef.params = {
            address: '0xABC',
            label: 'Vitalik',
            chainId: 'ethereum',
        }

        renderHook(() => useAddContactForm())

        expect(useContactFormMock).toHaveBeenCalledWith({
            addresses: { evm: '0xABC' },
            name: 'Vitalik',
        })
    })

    it('passes null when no route params are present', () => {
        renderHook(() => useAddContactForm())

        expect(useContactFormMock).toHaveBeenCalledWith(null)
    })

    it('no-ops save when the form is invalid (default state)', () => {
        const { result } = renderHook(() => useAddContactForm())

        act(() => {
            result.current.save({ name: '', addresses: {} })
        })

        expect(addContactMock).not.toHaveBeenCalled()
        expect(goBackMock).not.toHaveBeenCalled()
        expect(setErrorMock).not.toHaveBeenCalled()
    })

    it('saves every family the form holds and navigates back', () => {
        formState.isValid = true

        const { result } = renderHook(() => useAddContactForm())

        act(() => {
            result.current.save({
                name: 'Bob',
                addresses: { algorand: 'BOB999', evm: '0xB0B' },
            })
        })

        expect(addContactMock).toHaveBeenCalledWith({
            name: 'Bob',
            addresses: { algorand: 'BOB999', evm: '0xB0B' },
        })
        expect(setSelectedContactMock).toHaveBeenCalledWith(null)
        expect(goBackMock).toHaveBeenCalled()
    })
})
