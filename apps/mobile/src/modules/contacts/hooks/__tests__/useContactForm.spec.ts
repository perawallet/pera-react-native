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
import { beforeEach, describe, it, expect, vi } from 'vitest'
import type { Contact } from '@perawallet/wallet-core-contacts'
import { registerAlgorandAddressCodec } from '@test-utils/algorandAccountsAdapter'
import { useContactForm } from '../useContactForm'

const ALICE: Contact = {
    id: 'alice-id',
    name: 'Alice',
    addresses: { algorand: 'ALICE123' },
}

// Override the global vitest-setup mock so contactSchema (used by the hook's
// zod resolver) is available from the real module.
vi.mock('@perawallet/wallet-core-contacts', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-contacts')
    >('@perawallet/wallet-core-contacts')
    return {
        ...actual,
        useContacts: vi.fn(() => ({
            contacts: [ALICE],
            findContacts: vi.fn(() => []),
            addContact: vi.fn(),
            editContact: vi.fn(),
            deleteContact: vi.fn(),
            selectedContact: null,
            setSelectedContact: vi.fn(),
        })),
    }
})

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

beforeEach(() => {
    registerAlgorandAddressCodec()
})

describe('useContactForm', () => {
    it('exposes the raw address input and updates it via onAddressInputChange', () => {
        const { result } = renderHook(() => useContactForm(null))
        expect(result.current.rawAddressInput).toBe('')

        act(() => {
            result.current.onAddressInputChange('ABC123')
        })

        expect(result.current.rawAddressInput).toBe('ABC123')
    })

    it('seeds initial values from the provided contact', () => {
        const { result } = renderHook(() => useContactForm(ALICE))
        expect(result.current.rawAddressInput).toBe('ALICE123')
    })

    it('flags an address another contact holds', () => {
        const { result } = renderHook(() => useContactForm(null))

        act(() => {
            result.current.onAddressInputChange('ALICE123')
        })

        expect(result.current.isDuplicateAddress).toBe(true)
    })

    it('does not flag the address of the contact being edited', () => {
        const { result } = renderHook(() => useContactForm(ALICE))

        expect(result.current.isDuplicateAddress).toBe(false)
    })
})
