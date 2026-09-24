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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useForgotPasswordView } from '../useForgotPasswordView'

const { mockWipe, mockClearAccounts, mockVaultReset } = vi.hoisted(() => ({
    mockWipe: vi.fn(),
    mockClearAccounts: vi.fn(),
    mockVaultReset: vi.fn(),
}))

vi.mock('@hooks/useDeleteAllData', () => ({
    useDeleteAllData: () => ({ wipeAllUserData: mockWipe }),
    clearAccountsStore: mockClearAccounts,
}))

describe('useForgotPasswordView', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockWipe.mockResolvedValue(undefined)
        mockVaultReset.mockResolvedValue(undefined)
    })

    it('wipes nothing until the user acknowledges the loss', async () => {
        const { result } = renderHook(() =>
            useForgotPasswordView({ onVaultReset: mockVaultReset }),
        )

        await act(async () => {
            await result.current.handleReset()
        })

        expect(mockWipe).not.toHaveBeenCalled()
        expect(mockClearAccounts).not.toHaveBeenCalled()
        expect(mockVaultReset).not.toHaveBeenCalled()
    })

    it('wipes all data, vault included, and drops the accounts once acknowledged', async () => {
        const { result } = renderHook(() =>
            useForgotPasswordView({ onVaultReset: mockVaultReset }),
        )

        act(() => {
            result.current.toggleAcknowledged()
        })
        await act(async () => {
            await result.current.handleReset()
        })

        expect(mockWipe).toHaveBeenCalledTimes(1)
        expect(mockClearAccounts).toHaveBeenCalledTimes(1)
        // Destroying a locked vault fires no lock event, so the gate is told.
        expect(mockVaultReset).toHaveBeenCalledTimes(1)
    })

    it('keeps the accounts and reports the failure when the wipe throws', async () => {
        mockWipe.mockRejectedValue(new Error('wipe failed'))
        const { result } = renderHook(() =>
            useForgotPasswordView({ onVaultReset: mockVaultReset }),
        )

        act(() => {
            result.current.toggleAcknowledged()
        })
        await act(async () => {
            await result.current.handleReset()
        })

        expect(result.current.hasError).toBe(true)
        expect(result.current.isResetting).toBe(false)
        expect(mockClearAccounts).not.toHaveBeenCalled()
        expect(mockVaultReset).not.toHaveBeenCalled()
    })
})
