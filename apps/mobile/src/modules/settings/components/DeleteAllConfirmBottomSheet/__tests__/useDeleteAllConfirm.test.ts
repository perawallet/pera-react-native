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
import { useDeleteAllConfirm } from '../useDeleteAllConfirm'
import { useDeleteAllData } from '@modules/settings/hooks/useDeleteAllData'

vi.mock('@modules/settings/hooks/useDeleteAllData', () => ({
    useDeleteAllData: vi.fn(),
}))

describe('useDeleteAllConfirm', () => {
    const mockClearAllData = vi.fn().mockResolvedValue(undefined)
    const mockOnClose = vi.fn()
    const mockOnSuccess = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useDeleteAllData as Mock).mockReturnValue(mockClearAllData)
    })

    it('returns handleDeleteAllAccounts function', () => {
        const { result } = renderHook(() =>
            useDeleteAllConfirm({
                onClose: mockOnClose,
                onSuccess: mockOnSuccess,
            }),
        )

        expect(result.current).toHaveProperty('handleDeleteAllAccounts')
        expect(typeof result.current.handleDeleteAllAccounts).toBe('function')
    })

    it('clears all data when handleDeleteAllAccounts is called', async () => {
        const { result } = renderHook(() =>
            useDeleteAllConfirm({
                onClose: mockOnClose,
                onSuccess: mockOnSuccess,
            }),
        )

        await act(async () => {
            await result.current.handleDeleteAllAccounts()
        })

        expect(mockClearAllData).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when handleDeleteAllAccounts is called', async () => {
        const { result } = renderHook(() =>
            useDeleteAllConfirm({
                onClose: mockOnClose,
                onSuccess: mockOnSuccess,
            }),
        )

        await act(async () => {
            await result.current.handleDeleteAllAccounts()
        })

        expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('calls onSuccess after clearing data and closing', async () => {
        const { result } = renderHook(() =>
            useDeleteAllConfirm({
                onClose: mockOnClose,
                onSuccess: mockOnSuccess,
            }),
        )

        await act(async () => {
            await result.current.handleDeleteAllAccounts()
        })

        expect(mockOnSuccess).toHaveBeenCalledTimes(1)
        expect(mockClearAllData).toHaveBeenCalledBefore(mockOnClose)
        expect(mockOnClose).toHaveBeenCalledBefore(mockOnSuccess)
    })
})
