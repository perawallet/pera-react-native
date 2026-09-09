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

import { describe, expect, test, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCloudBackupContactsReview } from '../useCloudBackupContactsReview'

const { deleteFromBackupMock, requestMock, notBackedUpMock } = vi.hoisted(
    () => ({
        deleteFromBackupMock: vi.fn(),
        requestMock: vi.fn(async () => true as unknown),
        notBackedUpMock: {
            current: [] as { address: string; name: string }[],
        },
    }),
)

vi.mock('../../../hooks/useBackupContactReview', () => ({
    useBackupContactReview: () => ({
        contacts: [],
        backedUpContacts: [],
        notBackedUpContacts: notBackedUpMock.current,
        availableFromBackup: [{ address: 'GONE', name: 'Carol' }],
        isBackedUp: () => false,
        busyAddress: null,
        backUpContact: vi.fn(),
        addFromBackup: vi.fn(),
        deleteFromBackup: deleteFromBackupMock,
    }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: requestMock }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

beforeEach(() => {
    vi.clearAllMocks()
    requestMock.mockResolvedValue(true)
    notBackedUpMock.current = [{ address: 'A', name: 'Alice' }]
})

describe('useCloudBackupContactsReview', () => {
    test('starts collapsed while there is a Not Backed Up section below', () => {
        const { result } = renderHook(() => useCloudBackupContactsReview())

        expect(result.current.isExpanded).toBe(false)
    })

    test('starts expanded when the card is the whole screen', () => {
        notBackedUpMock.current = []
        const { result } = renderHook(() => useCloudBackupContactsReview())

        expect(result.current.isExpanded).toBe(true)
    })

    test('deletes from the backup only after the sheet is confirmed', async () => {
        const { result } = renderHook(() => useCloudBackupContactsReview())

        await act(() => result.current.onDelete('GONE'))

        expect(deleteFromBackupMock).toHaveBeenCalledWith('GONE')
    })

    test('leaves the backup alone when the sheet is dismissed', async () => {
        requestMock.mockResolvedValue(undefined)
        const { result } = renderHook(() => useCloudBackupContactsReview())

        await act(() => result.current.onDelete('GONE'))

        expect(deleteFromBackupMock).not.toHaveBeenCalled()
    })
})
