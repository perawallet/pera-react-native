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
import { trackEvent, CloudBackupEvent } from '@analytics'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useCloudBackupScreen } from '../useCloudBackupScreen'

vi.mock('@react-navigation/native', () => ({
    useNavigation: vi.fn(),
}))

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics/events/contexts')),
    trackEvent: vi.fn(),
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
    it('tracks set-up and navigates to the setup screen', () => {
        const { result } = renderHook(() => useCloudBackupScreen())

        result.current.handleSetUpBackup()

        expect(trackEvent).toHaveBeenCalledWith(CloudBackupEvent.SetUpNew)
        expect(mockNavigate).toHaveBeenCalledWith('CloudBackupSetup')
    })

    it('navigates to the scanner when the sheet returns scan', async () => {
        mockRequest.mockResolvedValue('scan')
        const { result } = renderHook(() => useCloudBackupScreen())

        await act(async () => {
            await result.current.handleRestoreBackup()
        })

        expect(mockRequest).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('CloudBackupRestoreScan')
    })

    it('navigates to manual entry when the sheet returns manual', async () => {
        mockRequest.mockResolvedValue('manual')
        const { result } = renderHook(() => useCloudBackupScreen())

        await act(async () => {
            await result.current.handleRestoreBackup()
        })

        expect(mockRequest).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith(
            'CloudBackupRestorePassphrase',
        )
    })

    it('tracks the restore tap but navigates nowhere when the sheet is dismissed', async () => {
        mockRequest.mockResolvedValue(undefined)
        const { result } = renderHook(() => useCloudBackupScreen())

        await act(async () => {
            await result.current.handleRestoreBackup()
        })

        expect(trackEvent).toHaveBeenCalledWith(CloudBackupEvent.Restore)
        expect(mockNavigate).not.toHaveBeenCalled()
    })
})
