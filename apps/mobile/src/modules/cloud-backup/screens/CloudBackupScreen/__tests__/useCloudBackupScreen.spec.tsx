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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNavigation } from '@react-navigation/native'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useCloudBackupScreen } from '../useCloudBackupScreen'

vi.mock('@react-navigation/native', () => ({
    useNavigation: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: vi.fn(),
}))

// RestoreBackupSheet renders nothing relevant here; mock to avoid pulling its deps.
vi.mock('../../../components/RestoreBackupSheet', () => ({
    RestoreBackupSheet: () => null,
}))

const mockNavigate = vi.fn()
const mockRequest = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    ;(useNavigation as ReturnType<typeof vi.fn>).mockReturnValue({
        navigate: mockNavigate,
    })
    ;(useBottomSheet as ReturnType<typeof vi.fn>).mockReturnValue({
        request: mockRequest,
    })
})

describe('useCloudBackupScreen', () => {
    it('navigates to the setup screen on set-up', () => {
        const { result } = renderHook(() => useCloudBackupScreen())

        result.current.handleSetUpBackup()

        expect(mockNavigate).toHaveBeenCalledWith('CloudBackupSetup')
    })

    it('opens the restore sheet and navigates to the passphrase screen on continue', async () => {
        mockRequest.mockResolvedValue('continue')
        const { result } = renderHook(() => useCloudBackupScreen())

        await act(async () => {
            result.current.handleRestoreBackup()
        })

        expect(mockRequest).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith(
            'CloudBackupRestorePassphrase',
        )
    })

    it('does not navigate when the sheet is dismissed', async () => {
        mockRequest.mockResolvedValue(undefined)
        const { result } = renderHook(() => useCloudBackupScreen())

        await act(async () => {
            result.current.handleRestoreBackup()
        })

        expect(mockNavigate).not.toHaveBeenCalledWith(
            'CloudBackupRestorePassphrase',
        )
    })
})
