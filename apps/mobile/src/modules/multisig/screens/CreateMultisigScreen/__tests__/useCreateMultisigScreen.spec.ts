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

describe('useCreateMultisigScreen', () => {
    const mockPush = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockAccounts.mockReturnValue([])
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

    it('ignores duplicate addresses', async () => {
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

        expect(result.current.participants).toHaveLength(1)
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
            size: 'lg',
            enablePanDownToClose: true,
            autoCreateContainer: false,
        })
    })

    it('navigates to EditParticipant on edit', () => {
        const { result } = renderHook(() => useCreateMultisigScreen())

        act(() => {
            result.current.handleEditParticipant('ADDR1')
        })

        expect(mockPush).toHaveBeenCalledWith('EditParticipant', {
            address: 'ADDR1',
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

    it('handleRemoveParticipant removes the participant from the store', () => {
        const store = useMultisigCreationStore.getState()
        store.addParticipant({ address: 'ADDR1' })
        store.addParticipant({ address: 'ADDR2' })

        const { result } = renderHook(() => useCreateMultisigScreen())

        act(() => {
            result.current.handleRemoveParticipant('ADDR1')
        })

        const participants = useMultisigCreationStore.getState().participants
        expect(participants.find(p => p.address === 'ADDR1')).toBeUndefined()
        expect(participants).toHaveLength(1)
    })
})
