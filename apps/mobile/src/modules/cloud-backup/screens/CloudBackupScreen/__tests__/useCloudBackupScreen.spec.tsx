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
import { useCloudBackupScreen } from '../useCloudBackupScreen'

const { mockChooseRestoreRoute } = vi.hoisted(() => ({
    mockChooseRestoreRoute: vi.fn(),
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: vi.fn(),
}))

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics/events/contexts')),
    trackEvent: vi.fn(),
}))

vi.mock('../../../hooks/useRestoreBackupOptions', () => ({
    useRestoreBackupOptions: () => ({
        chooseRestoreRoute: mockChooseRestoreRoute,
        isReadingCredentials: false,
    }),
}))

const mockNavigate = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    ;(useNavigation as ReturnType<typeof vi.fn>).mockReturnValue({
        navigate: mockNavigate,
    })
})

describe('useCloudBackupScreen', () => {
    it('tracks set-up and navigates to the setup screen', () => {
        const { result } = renderHook(() => useCloudBackupScreen())

        result.current.handleSetUpBackup()

        expect(trackEvent).toHaveBeenCalledWith(CloudBackupEvent.SetUpNew)
        expect(mockNavigate).toHaveBeenCalledWith('CloudBackupSetup')
    })

    it('tracks the restore tap and navigates to the route the restore options pick', async () => {
        const params = { importedKey: { salt: 'c2FsdA==' } }
        mockChooseRestoreRoute.mockResolvedValueOnce([
            'CloudBackupRestorePassphrase',
            params,
        ])
        const { result } = renderHook(() => useCloudBackupScreen())

        await act(async () => {
            await result.current.handleRestoreBackup()
        })

        expect(trackEvent).toHaveBeenCalledWith(CloudBackupEvent.Restore)
        expect(mockNavigate).toHaveBeenCalledWith(
            'CloudBackupRestorePassphrase',
            params,
        )
    })

    it('navigates nowhere when no route is picked', async () => {
        mockChooseRestoreRoute.mockResolvedValueOnce(null)
        const { result } = renderHook(() => useCloudBackupScreen())

        await act(async () => {
            await result.current.handleRestoreBackup()
        })

        expect(mockNavigate).not.toHaveBeenCalled()
    })
})
