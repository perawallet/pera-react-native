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
import { useEditParticipantScreen } from '../useEditParticipantScreen'
import { useMultisigCreationStore } from '../../../hooks/useMultisigCreation'

const mockGoBack = vi.fn()
const mockSaveContact = vi.fn()
const mockFindContacts = vi.fn(
    (): Array<{ address: string; name: string }> => [],
)

const mockRouteParams = { address: 'ADDR1' }

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

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContacts: () => ({
        findContacts: mockFindContacts,
        saveContact: mockSaveContact,
    }),
}))

describe('useEditParticipantScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFindContacts.mockReturnValue([])

        const store = useMultisigCreationStore.getState()
        store.resetState()
        store.addParticipant({ address: 'ADDR1' })
        store.addParticipant({ address: 'ADDR2' })
    })

    it('exposes the address from route params', () => {
        const { result } = renderHook(() => useEditParticipantScreen())

        expect(result.current.address).toBe('ADDR1')
    })

    it('initializes with empty name when no contact exists', () => {
        const { result } = renderHook(() => useEditParticipantScreen())

        expect(result.current.control._defaultValues.name).toBe('')
    })

    it('initializes with existing contact name as default', () => {
        mockFindContacts.mockReturnValue([{ address: 'ADDR1', name: 'Alice' }])

        const { result } = renderHook(() => useEditParticipantScreen())

        expect(result.current.control._defaultValues.name).toBe('Alice')
    })

    it('isDoneDisabled is true when form is invalid (empty name)', () => {
        const { result } = renderHook(() => useEditParticipantScreen())

        expect(result.current.isDoneDisabled).toBe(true)
    })

    it('isDoneDisabled is false once a valid name is entered', async () => {
        mockFindContacts.mockReturnValue([{ address: 'ADDR1', name: 'Alice' }])

        const { result } = renderHook(() => useEditParticipantScreen())

        await waitFor(() => {
            expect(result.current.isDoneDisabled).toBe(false)
        })
    })

    it('handleDone saves contact, updates participant, and navigates back', async () => {
        mockFindContacts.mockReturnValue([{ address: 'ADDR1', name: 'Alice' }])

        const { result } = renderHook(() => useEditParticipantScreen())

        await waitFor(() => {
            expect(result.current.isDoneDisabled).toBe(false)
        })

        await act(async () => {
            await result.current.handleDone()
        })

        expect(mockSaveContact).toHaveBeenCalledWith({
            name: 'Alice',
            address: 'ADDR1',
        })
        expect(
            useMultisigCreationStore
                .getState()
                .participants.find(p => p.address === 'ADDR1')?.name,
        ).toBe('Alice')
        expect(mockGoBack).toHaveBeenCalled()
    })

    it('handleRemove removes participant from store and navigates back', () => {
        const { result } = renderHook(() => useEditParticipantScreen())

        act(() => {
            result.current.handleRemove()
        })

        const participants = useMultisigCreationStore.getState().participants
        expect(participants.find(p => p.address === 'ADDR1')).toBeUndefined()
        expect(participants).toHaveLength(1)
        expect(mockGoBack).toHaveBeenCalled()
    })
})
