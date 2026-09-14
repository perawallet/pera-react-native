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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCloudBackupAccountsReview } from '../useCloudBackupAccountsReview'

const {
    requestBottomSheetMock,
    deleteFromBackupMock,
    addFromBackupMock,
    backUpAccountMock,
    notBackedUpMock,
} = vi.hoisted(() => ({
    requestBottomSheetMock: vi.fn(),
    deleteFromBackupMock: vi.fn(),
    addFromBackupMock: vi.fn(),
    backUpAccountMock: vi.fn(),
    notBackedUpMock: { current: [{ address: 'B' }] as { address: string }[] },
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: requestBottomSheetMock }),
}))

vi.mock('../../../components/DeleteFromBackupSheet', () => ({
    DeleteFromBackupSheet: () => null,
}))

vi.mock('../../../hooks/useBackupAccountReview', () => ({
    useBackupAccountReview: () => ({
        availableFromBackup: ['GONE'],
        notBackedUpAccounts: notBackedUpMock.current,
        busyAddress: null,
        addFromBackup: addFromBackupMock,
        deleteFromBackup: deleteFromBackupMock,
        backUpAccount: backUpAccountMock,
    }),
}))

beforeEach(() => {
    vi.clearAllMocks()
    notBackedUpMock.current = [{ address: 'B' }]
})

describe('useCloudBackupAccountsReview', () => {
    test('starts collapsed beside a Not Backed Up section, and toggles', () => {
        const { result } = renderHook(() => useCloudBackupAccountsReview())

        expect(result.current.isExpanded).toBe(false)
        act(() => result.current.onToggleExpanded())
        expect(result.current.isExpanded).toBe(true)
    })

    test('starts expanded when the card is the only section', () => {
        notBackedUpMock.current = []

        const { result } = renderHook(() => useCloudBackupAccountsReview())

        expect(result.current.isExpanded).toBe(true)
    })

    test('deletes from the backup only once the sheet is confirmed', async () => {
        requestBottomSheetMock.mockResolvedValue(true)
        const { result } = renderHook(() => useCloudBackupAccountsReview())

        await act(() => result.current.onDelete('GONE'))

        expect(deleteFromBackupMock).toHaveBeenCalledWith('GONE')
    })

    test('leaves the backup alone when the sheet is dismissed', async () => {
        requestBottomSheetMock.mockResolvedValue(undefined)
        const { result } = renderHook(() => useCloudBackupAccountsReview())

        await act(() => result.current.onDelete('GONE'))

        expect(deleteFromBackupMock).not.toHaveBeenCalled()
    })
})
