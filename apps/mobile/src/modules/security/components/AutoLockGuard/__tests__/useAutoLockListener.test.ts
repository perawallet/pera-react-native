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
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAutoLockListener } from '../useAutoLockListener'
import { usePinCode } from '@perawallet/wallet-core-security'
import { useDeleteAllData } from '@modules/settings/hooks/useDeleteAllData'
import { AppState } from 'react-native'

vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: vi.fn(),
}))

vi.mock('@modules/settings/hooks/useDeleteAllData', () => ({
    useDeleteAllData: vi.fn(),
}))

vi.mock('react-native', () => ({
    AppState: {
        currentState: 'active',
        addEventListener: vi.fn(() => ({
            remove: vi.fn(),
        })),
    },
}))

describe('useAutoLockListener', () => {
    const mockCheckAutoLock = vi.fn()
    const mockSetAutoLockStartedAt = vi.fn()
    const mockCheckPinEnabled = vi.fn()
    const mockDeleteAllData = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockCheckPinEnabled.mockResolvedValue(false)
        mockCheckAutoLock.mockResolvedValue(false)
        ;(usePinCode as Mock).mockReturnValue({
            checkAutoLock: mockCheckAutoLock,
            setAutoLockStartedAt: mockSetAutoLockStartedAt,
            checkPinEnabled: mockCheckPinEnabled,
        })
        ;(useDeleteAllData as Mock).mockReturnValue(mockDeleteAllData)
    })

    it('should return initial state', () => {
        const { result } = renderHook(() => useAutoLockListener())

        expect(result.current.isLocked).toBe(false)
        expect(result.current.isChecking).toBe(true)
        expect(typeof result.current.unlock).toBe('function')
        expect(typeof result.current.handleResetData).toBe('function')
    })

    it('should check PIN enabled on mount', async () => {
        renderHook(() => useAutoLockListener())

        await waitFor(() => {
            expect(mockCheckPinEnabled).toHaveBeenCalled()
        })
    })

    it('should set isLocked to true when PIN is enabled on initialization', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)

        const { result } = renderHook(() => useAutoLockListener())

        await waitFor(() => {
            expect(result.current.isLocked).toBe(true)
        })
    })

    it('should set isLocked to false when PIN is disabled on initialization', async () => {
        mockCheckPinEnabled.mockResolvedValue(false)

        const { result } = renderHook(() => useAutoLockListener())

        await waitFor(() => {
            expect(result.current.isLocked).toBe(false)
            expect(result.current.isChecking).toBe(false)
        })
    })

    it('should unlock and reset state when unlock is called', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)

        const { result } = renderHook(() => useAutoLockListener())

        await waitFor(() => {
            expect(result.current.isLocked).toBe(true)
        })

        act(() => {
            result.current.unlock()
        })

        expect(result.current.isLocked).toBe(false)
        expect(result.current.isChecking).toBe(false)
        expect(mockSetAutoLockStartedAt).toHaveBeenCalledWith(null)
    })

    it('should delete all data and reset state when handleResetData is called', async () => {
        mockDeleteAllData.mockResolvedValue(undefined)
        mockCheckPinEnabled.mockResolvedValue(true)

        const { result } = renderHook(() => useAutoLockListener())

        await waitFor(() => {
            expect(result.current.isLocked).toBe(true)
        })

        await act(async () => {
            await result.current.handleResetData()
        })

        expect(mockDeleteAllData).toHaveBeenCalled()
        expect(result.current.isLocked).toBe(false)
        expect(result.current.isChecking).toBe(false)
        expect(mockSetAutoLockStartedAt).toHaveBeenCalledWith(null)
    })

    it('should register AppState listener on mount', () => {
        renderHook(() => useAutoLockListener())

        expect(AppState.addEventListener).toHaveBeenCalledWith(
            'change',
            expect.any(Function),
        )
    })

    it('should remove AppState listener on unmount', () => {
        const mockRemove = vi.fn()
        ;(AppState.addEventListener as Mock).mockReturnValue({
            remove: mockRemove,
        })

        const { unmount } = renderHook(() => useAutoLockListener())

        unmount()

        expect(mockRemove).toHaveBeenCalled()
    })
})
