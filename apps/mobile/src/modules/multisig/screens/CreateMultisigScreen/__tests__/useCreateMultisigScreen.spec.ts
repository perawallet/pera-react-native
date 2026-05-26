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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { DuplicateAddressError } from '@perawallet/wallet-core-contacts'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useCreateMultisigScreen } from '../useCreateMultisigScreen'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useMultisigCreationStore } from '../../../hooks/useMultisigCreation'

const { mockRequestBottomSheet } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

const mockAccounts = vi.fn<() => { address: string }[]>(() => [])

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-accounts')
    >('@perawallet/wallet-core-accounts')
    return {
        ...actual,
        useAllAccounts: () => mockAccounts(),
    }
})

const mockAddContact = vi.fn()
const mockContacts = vi.fn<() => { address: string; name: string }[]>(() => [])

vi.mock('@perawallet/wallet-core-contacts', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-contacts')
    >('@perawallet/wallet-core-contacts')
    return {
        ...actual,
        useContacts: () => ({
            contacts: mockContacts(),
            addContact: mockAddContact,
            editContact: vi.fn(),
            deleteContact: vi.fn(),
            findContacts: vi.fn(() => []),
            selectedContact: null,
            setSelectedContact: vi.fn(),
        }),
    }
})

describe('useCreateMultisigScreen', () => {
    const mockPush = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockAccounts.mockReturnValue([])
        mockContacts.mockReturnValue([])
        mockAddContact.mockReset()
        ;(useAppNavigation as Mock).mockReturnValue({
            push: mockPush,
        })
        useMultisigCreationStore.getState().resetState()
    })

    it('starts with no participants and continue disabled', () => {
        const { result } = renderHook(() => useCreateMultisigScreen())

        expect(result.current.participants).toEqual([])
        expect(result.current.canContinue).toBe(false)
    })

    it('adds a participant when the add-participant sheet resolves with an address', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce('ADDR1')
        const { result } = renderHook(() => useCreateMultisigScreen())

        await act(async () => {
            await result.current.handleOpenAddParticipant()
        })

        expect(result.current.participants).toHaveLength(1)
        expect(result.current.participants[0]?.address).toBe('ADDR1')
        expect(result.current.canContinue).toBe(false)
    })

    it('enables continue with 2 or more participants', async () => {
        mockRequestBottomSheet
            .mockResolvedValueOnce('ADDR1')
            .mockResolvedValueOnce('ADDR2')
        const { result } = renderHook(() => useCreateMultisigScreen())

        await act(async () => {
            await result.current.handleOpenAddParticipant()
        })

        await act(async () => {
            await result.current.handleOpenAddParticipant()
        })

        expect(result.current.participants).toHaveLength(2)
        expect(result.current.canContinue).toBe(true)
    })

    it('allows duplicate addresses', async () => {
        mockRequestBottomSheet
            .mockResolvedValueOnce('ADDR1')
            .mockResolvedValueOnce('ADDR1')
        const { result } = renderHook(() => useCreateMultisigScreen())

        await act(async () => {
            await result.current.handleOpenAddParticipant()
        })

        await act(async () => {
            await result.current.handleOpenAddParticipant()
        })

        expect(result.current.participants).toHaveLength(2)
        expect(result.current.participants[0]?.address).toBe('ADDR1')
        expect(result.current.participants[1]?.address).toBe('ADDR1')
    })

    it('preserves participant order across duplicate adds', async () => {
        mockRequestBottomSheet
            .mockResolvedValueOnce('A')
            .mockResolvedValueOnce('B')
            .mockResolvedValueOnce('B')
            .mockResolvedValueOnce('A')
        const { result } = renderHook(() => useCreateMultisigScreen())

        for (let i = 0; i < 4; i++) {
            await act(async () => {
                await result.current.handleOpenAddParticipant()
            })
        }

        expect(result.current.participants.map(p => p.address)).toEqual([
            'A',
            'B',
            'B',
            'A',
        ])
    })

    it('skips adding when the sheet is dismissed (resolves undefined)', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useCreateMultisigScreen())

        await act(async () => {
            await result.current.handleOpenAddParticipant()
        })

        expect(result.current.participants).toHaveLength(0)
    })

    it('requests the add-participant sheet with size=lg', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useCreateMultisigScreen())

        await act(async () => {
            await result.current.handleOpenAddParticipant()
        })

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        const arg = mockRequestBottomSheet.mock.calls[0][0]
        expect(arg.options).toEqual({
            size: 'modal',
            enablePanDownToClose: true,
            autoCreateContainer: false,
        })
    })

    it('navigates to EditParticipant on edit with index and address', () => {
        useMultisigCreationStore.getState().addParticipant({ address: 'ADDR1' })
        useMultisigCreationStore.getState().addParticipant({ address: 'ADDR2' })

        const { result } = renderHook(() => useCreateMultisigScreen())

        act(() => {
            result.current.handleEditParticipant(1)
        })

        expect(mockPush).toHaveBeenCalledWith('EditParticipant', {
            index: 1,
            address: 'ADDR2',
        })
    })

    it('navigates to SetThreshold on continue', () => {
        const { result } = renderHook(() => useCreateMultisigScreen())

        act(() => {
            result.current.handleContinue()
        })

        expect(mockPush).toHaveBeenCalledWith('SetThreshold')
    })

    it('isParticipantInWallet is true only for addresses that are wallet accounts', () => {
        mockAccounts.mockReturnValue([{ address: 'ADDR1' }])
        const { result } = renderHook(() => useCreateMultisigScreen())

        expect(result.current.isParticipantInWallet('ADDR1')).toBe(true)
        expect(result.current.isParticipantInWallet('ADDR2')).toBe(false)
    })

    it('handleRemoveParticipant removes the participant at the given index', () => {
        const store = useMultisigCreationStore.getState()
        store.addParticipant({ address: 'ADDR1' })
        store.addParticipant({ address: 'ADDR2' })

        const { result } = renderHook(() => useCreateMultisigScreen())

        act(() => {
            result.current.handleRemoveParticipant(0)
        })

        const participants = useMultisigCreationStore.getState().participants
        expect(participants).toHaveLength(1)
        expect(participants[0].address).toBe('ADDR2')
    })

    it('handleRemoveParticipant only removes the targeted duplicate', () => {
        const store = useMultisigCreationStore.getState()
        store.addParticipant({ address: 'ADDR1' })
        store.addParticipant({ address: 'ADDR1' })

        const { result } = renderHook(() => useCreateMultisigScreen())

        act(() => {
            result.current.handleRemoveParticipant(1)
        })

        const participants = useMultisigCreationStore.getState().participants
        expect(participants).toHaveLength(1)
        expect(participants[0].address).toBe('ADDR1')
    })

    describe('contact auto-save', () => {
        const ADDR = 'A'.repeat(58)

        it('auto-saves a new non-wallet address as a contact', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce(ADDR)
            const { result } = renderHook(() => useCreateMultisigScreen())

            await act(async () => {
                await result.current.handleOpenAddParticipant()
            })

            expect(mockAddContact).toHaveBeenCalledTimes(1)
            expect(mockAddContact).toHaveBeenCalledWith({
                name: truncateAlgorandAddress(ADDR),
                address: ADDR,
            })
            expect(result.current.participants).toHaveLength(1)
        })

        it('does not save a wallet account as a contact', async () => {
            mockAccounts.mockReturnValue([{ address: ADDR }])
            mockRequestBottomSheet.mockResolvedValueOnce(ADDR)
            const { result } = renderHook(() => useCreateMultisigScreen())

            await act(async () => {
                await result.current.handleOpenAddParticipant()
            })

            expect(mockAddContact).not.toHaveBeenCalled()
            expect(result.current.participants).toHaveLength(1)
        })

        it('skips an address already saved as a contact', async () => {
            mockContacts.mockReturnValue([{ address: ADDR, name: 'Alice' }])
            mockRequestBottomSheet.mockResolvedValueOnce(ADDR)
            const { result } = renderHook(() => useCreateMultisigScreen())

            await act(async () => {
                await result.current.handleOpenAddParticipant()
            })

            expect(mockAddContact).not.toHaveBeenCalled()
            expect(result.current.participants).toHaveLength(1)
        })

        it('hydrates name from an existing contact on duplicate adds', async () => {
            mockContacts.mockReturnValue([{ address: ADDR, name: 'Alice' }])
            mockRequestBottomSheet
                .mockResolvedValueOnce(ADDR)
                .mockResolvedValueOnce(ADDR)
            const { result } = renderHook(() => useCreateMultisigScreen())

            await act(async () => {
                await result.current.handleOpenAddParticipant()
            })
            await act(async () => {
                await result.current.handleOpenAddParticipant()
            })

            expect(result.current.participants).toHaveLength(2)
            expect(result.current.participants[0]?.name).toBe('Alice')
            expect(result.current.participants[1]?.name).toBe('Alice')
            expect(mockAddContact).not.toHaveBeenCalled()
        })

        it('does not auto-save a contact a second time on duplicate add', async () => {
            mockRequestBottomSheet
                .mockResolvedValueOnce(ADDR)
                .mockResolvedValueOnce(ADDR)
            mockAddContact.mockImplementation(c => {
                mockContacts.mockReturnValue([
                    { address: c.address, name: c.name },
                ])
            })
            const { result } = renderHook(() => useCreateMultisigScreen())

            await act(async () => {
                await result.current.handleOpenAddParticipant()
            })
            await act(async () => {
                await result.current.handleOpenAddParticipant()
            })

            expect(result.current.participants).toHaveLength(2)
            expect(mockAddContact).toHaveBeenCalledTimes(1)
        })

        it('swallows a duplicate-contact error', async () => {
            mockAddContact.mockImplementationOnce(() => {
                throw new DuplicateAddressError(ADDR)
            })
            mockRequestBottomSheet.mockResolvedValueOnce(ADDR)
            const { result } = renderHook(() => useCreateMultisigScreen())

            await act(async () => {
                await result.current.handleOpenAddParticipant()
            })

            expect(mockAddContact).toHaveBeenCalledTimes(1)
            expect(result.current.participants).toHaveLength(1)
        })
    })
})
