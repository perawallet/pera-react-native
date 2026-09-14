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

import { describe, test, expect, vi, beforeEach, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import { trackEvent, CloudBackupEvent } from '@analytics'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useRestoreBackupSheet } from '../useRestoreBackupSheet'

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics/events/contexts')),
    trackEvent: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: vi.fn(),
}))

const mockResolve = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    ;(useBottomSheetResult as Mock).mockReturnValue({
        resolve: mockResolve,
        dismiss: vi.fn(),
    })
})

describe('useRestoreBackupSheet', () => {
    test('tracks and resolves the QR scan option', () => {
        const { result } = renderHook(() => useRestoreBackupSheet())

        result.current.handleScan()

        expect(trackEvent).toHaveBeenCalledWith(CloudBackupEvent.RestoreScanQr)
        expect(mockResolve).toHaveBeenCalledWith('scan')
    })

    test('tracks and resolves the manual entry option', () => {
        const { result } = renderHook(() => useRestoreBackupSheet())

        result.current.handleManual()

        expect(trackEvent).toHaveBeenCalledWith(
            CloudBackupEvent.RestoreEnterManually,
        )
        expect(mockResolve).toHaveBeenCalledWith('manual')
    })
})
