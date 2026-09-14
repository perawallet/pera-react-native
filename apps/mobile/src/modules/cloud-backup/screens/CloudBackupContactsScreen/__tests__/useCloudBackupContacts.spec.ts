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
import { renderHook } from '@testing-library/react'
import { useCloudBackupContacts } from '../useCloudBackupContacts'

const { navigateMock, reviewMock } = vi.hoisted(() => ({
    navigateMock: vi.fn(),
    reviewMock: {
        current: {
            contacts: [] as { address: string; name: string }[],
            backedUpContacts: [] as { address: string; name: string }[],
            notBackedUpContacts: [] as { address: string; name: string }[],
            availableFromBackup: [] as { address: string; name: string }[],
            isBackedUp: (_address: string) => false,
            busyAddress: null as string | null,
            backUpContact: vi.fn(),
            addFromBackup: vi.fn(),
            deleteFromBackup: vi.fn(),
        },
    },
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: navigateMock }),
}))

vi.mock('../../../hooks/useBackupContactReview', () => ({
    useBackupContactReview: () => reviewMock.current,
}))

beforeEach(() => {
    vi.clearAllMocks()
    reviewMock.current = {
        ...reviewMock.current,
        contacts: [{ address: 'A', name: 'Alice' }],
        notBackedUpContacts: [{ address: 'A', name: 'Alice' }],
        availableFromBackup: [{ address: 'GONE', name: 'Carol' }],
    }
})

describe('useCloudBackupContacts', () => {
    test('surfaces both review counts', () => {
        const { result } = renderHook(() => useCloudBackupContacts())

        expect(result.current.notBackedUpCount).toBe(1)
        expect(result.current.availableFromBackupCount).toBe(1)
    })

    test('navigates to the review screen', () => {
        const { result } = renderHook(() => useCloudBackupContacts())

        result.current.onReview()

        expect(navigateMock).toHaveBeenCalledWith('CloudBackupContactsReview')
    })
})
