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

import { beforeEach, describe, expect, test, vi, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import { trackEvent, CloudBackupEvent } from '@analytics'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useCredentialsFileReadSources } from '../../../hooks/useCredentialsFileSources'
import { useRestoreBackupSheet } from '../useRestoreBackupSheet'

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics/events/contexts')),
    trackEvent: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: vi.fn(),
}))

vi.mock('../../../hooks/useCredentialsFileSources', () => ({
    useCredentialsFileReadSources: vi.fn(),
}))

const mockResolve = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    ;(useBottomSheetResult as Mock).mockReturnValue({
        resolve: mockResolve,
        dismiss: vi.fn(),
    })
    ;(useCredentialsFileReadSources as Mock).mockReturnValue([
        'device',
        'icloud',
        'googleDrive',
    ])
})

describe('useRestoreBackupSheet', () => {
    test.each([
        [
            ['device', 'icloud', 'googleDrive'],
            ['scan', 'device', 'icloud', 'googleDrive', 'manual'],
            'cloud_backup.restore.sheet_description_with_import',
        ],
        [
            ['device'],
            ['scan', 'device', 'manual'],
            'cloud_backup.restore.sheet_description_with_import',
        ],
        [[], ['scan', 'manual'], 'cloud_backup.restore.sheet_description'],
    ] as const)(
        'wraps the available file sources %j and describes only those',
        (fileSources, expectedOptions, expectedDescriptionKey) => {
            ;(useCredentialsFileReadSources as Mock).mockReturnValue(
                fileSources,
            )

            const { result } = renderHook(() => useRestoreBackupSheet())

            expect(result.current.options).toEqual(expectedOptions)
            expect(result.current.descriptionKey).toBe(expectedDescriptionKey)
        },
    )

    test.each([
        ['scan', CloudBackupEvent.RestoreScanQr],
        ['manual', CloudBackupEvent.RestoreEnterManually],
    ] as const)('tracks and resolves %s', (option, event) => {
        const { result } = renderHook(() => useRestoreBackupSheet())

        result.current.handleSelect(option)

        expect(trackEvent).toHaveBeenCalledWith(event)
        expect(mockResolve).toHaveBeenCalledWith(option)
    })

    test('resolves a file source without an event of its own', () => {
        const { result } = renderHook(() => useRestoreBackupSheet())

        result.current.handleSelect('googleDrive')

        expect(trackEvent).not.toHaveBeenCalled()
        expect(mockResolve).toHaveBeenCalledWith('googleDrive')
    })
})
