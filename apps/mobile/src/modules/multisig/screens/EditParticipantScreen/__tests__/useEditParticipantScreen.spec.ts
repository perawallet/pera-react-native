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

import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Contact } from '@perawallet/wallet-core-contacts'
import { useEditParticipantScreen } from '../useEditParticipantScreen'
import { useMultisigCreationStore } from '../../../hooks/useMultisigCreation'

const ADDR1 = 'A'.repeat(58)
const ADDR2 = 'B'.repeat(58)
const PICKED_IMAGE_URI = 'file:///mock/avatar.jpg'

const mockGoBack = vi.fn()
const mockAddContact = vi.fn()
const mockEditContact = vi.fn()
const mockFindContacts = vi.fn((): Contact[] => [])
const mockPickFromGallery = vi.fn<() => Promise<string | null>>(() =>
    Promise.resolve(null),
)

const mockRouteParams = { address: ADDR1 }

vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        useRoute: () => ({ params: mockRouteParams }),
    }
})

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        goBack: mockGoBack,
    }),
}))

vi.mock('@hooks/useImagePicker', () => ({
    useImagePicker: () => ({
        pickFromGallery: mockPickFromGallery,
        permissionDenied: {
            isVisible: false,
            close: vi.fn(),
            openSettings: vi.fn(),
        },
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

vi.mock('@perawallet/wallet-core-contacts', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-contacts')
    >('@perawallet/wallet-core-contacts')
    return {
        ...actual,
        useContacts: () => ({
            findContacts: mockFindContacts,
            addContact: mockAddContact,
            editContact: mockEditContact,
            deleteContact: vi.fn(),
            contacts: [],
            selectedContact: null,
            setSelectedContact: vi.fn(),
        }),
    }
})

describe('useEditParticipantScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFindContacts.mockReturnValue([])
        mockPickFromGallery.mockResolvedValue(null)

        const store = useMultisigCreationStore.getState()
        store.resetState()
        store.addParticipant({ address: ADDR1 })
        store.addParticipant({ address: ADDR2 })
    })

    it('exposes the address from route params', () => {
        const { result } = renderHook(() => useEditParticipantScreen())

        expect(result.current.address).toBe(ADDR1)
    })

    it('initializes with empty name when no contact exists', () => {
        const { result } = renderHook(() => useEditParticipantScreen())

        expect(result.current.control._defaultValues.name).toBe('')
        expect(result.current.control._defaultValues.address).toBe(ADDR1)
    })

    it('initializes with existing contact values as defaults', () => {
        mockFindContacts.mockReturnValue([
            {
                address: ADDR1,
                name: 'Alice',
                image: 'file:///existing.jpg',
            },
        ])

        const { result } = renderHook(() => useEditParticipantScreen())

        expect(result.current.control._defaultValues.name).toBe('Alice')
        expect(result.current.control._defaultValues.image).toBe(
            'file:///existing.jpg',
        )
        expect(result.current.imageUri).toBe('file:///existing.jpg')
    })

    it('isDoneDisabled is true when form is invalid (empty name)', () => {
        const { result } = renderHook(() => useEditParticipantScreen())

        expect(result.current.isDoneDisabled).toBe(true)
    })

    it('isDoneDisabled is false once a valid contact is loaded', async () => {
        mockFindContacts.mockReturnValue([{ address: ADDR1, name: 'Alice' }])

        const { result } = renderHook(() => useEditParticipantScreen())

        await waitFor(() => {
            expect(result.current.isDoneDisabled).toBe(false)
        })
    })

    it('handleDone edits the existing contact, updates participant, and navigates back', async () => {
        mockFindContacts.mockReturnValue([{ address: ADDR1, name: 'Alice' }])

        const { result } = renderHook(() => useEditParticipantScreen())

        await waitFor(() => {
            expect(result.current.isDoneDisabled).toBe(false)
        })

        await act(async () => {
            await result.current.handleDone()
        })

        expect(mockEditContact).toHaveBeenCalledWith(
            ADDR1,
            expect.objectContaining({ name: 'Alice', address: ADDR1 }),
        )
        expect(mockAddContact).not.toHaveBeenCalled()
        expect(
            useMultisigCreationStore
                .getState()
                .participants.find(p => p.address === ADDR1)?.name,
        ).toBe('Alice')
        expect(mockGoBack).toHaveBeenCalled()
    })

    it('persists a picked avatar image when saving', async () => {
        mockFindContacts.mockReturnValue([{ address: ADDR1, name: 'Alice' }])
        mockPickFromGallery.mockResolvedValue(PICKED_IMAGE_URI)

        const { result } = renderHook(() => useEditParticipantScreen())

        await waitFor(() => {
            expect(result.current.isDoneDisabled).toBe(false)
        })

        await act(async () => {
            await result.current.onPickImage()
        })

        await waitFor(() => {
            expect(result.current.imageUri).toBe(PICKED_IMAGE_URI)
        })

        await act(async () => {
            await result.current.handleDone()
        })

        expect(mockEditContact).toHaveBeenCalledWith(
            ADDR1,
            expect.objectContaining({
                name: 'Alice',
                address: ADDR1,
                image: PICKED_IMAGE_URI,
            }),
        )
    })

    it('handleRemove removes participant from store and navigates back', () => {
        const { result } = renderHook(() => useEditParticipantScreen())

        act(() => {
            result.current.handleRemove()
        })

        const participants = useMultisigCreationStore.getState().participants
        expect(participants.find(p => p.address === ADDR1)).toBeUndefined()
        expect(participants).toHaveLength(1)
        expect(mockGoBack).toHaveBeenCalled()
    })
})
