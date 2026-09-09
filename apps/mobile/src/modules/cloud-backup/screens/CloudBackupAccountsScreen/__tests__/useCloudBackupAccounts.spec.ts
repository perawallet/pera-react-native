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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCloudBackupAccounts } from '../useCloudBackupAccounts'

const { navigateMock, backUpAccountMock, isBackedUpMock } = vi.hoisted(() => ({
    navigateMock: vi.fn(),
    backUpAccountMock: vi.fn(),
    isBackedUpMock: vi.fn((address: string) => address === 'A'),
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: navigateMock }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: (
        selector: (state: { accounts: { address: string }[] }) => unknown,
    ) => selector({ accounts: [{ address: 'A' }, { address: 'B' }] }),
}))

vi.mock('../../../hooks/useBackupAccountReview', () => ({
    useBackupAccountReview: () => ({
        isBackedUp: isBackedUpMock,
        notBackedUpAccounts: [{ address: 'B' }],
        availableFromBackup: ['GONE', 'ALSO_GONE'],
        busyAddress: 'B',
        backUpAccount: backUpAccountMock,
    }),
}))

beforeEach(() => {
    vi.clearAllMocks()
})

describe('useCloudBackupAccounts', () => {
    it('lists the device accounts alongside the counts awaiting review', () => {
        const { result } = renderHook(() => useCloudBackupAccounts())

        expect(result.current.accounts.map(a => a.address)).toEqual(['A', 'B'])
        expect(result.current.isBackedUp('A')).toBe(true)
        expect(result.current.isBackedUp('B')).toBe(false)
        expect(result.current.notBackedUpCount).toBe(1)
        expect(result.current.availableFromBackupCount).toBe(2)
        expect(result.current.busyAddress).toBe('B')
    })

    it('opens the review screen', () => {
        const { result } = renderHook(() => useCloudBackupAccounts())

        act(() => result.current.onReview())

        expect(navigateMock).toHaveBeenCalledWith('CloudBackupAccountsReview')
    })
})
