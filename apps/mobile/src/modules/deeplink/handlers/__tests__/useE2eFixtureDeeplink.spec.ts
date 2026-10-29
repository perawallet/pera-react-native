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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const {
    mockReplaceAllContacts,
    mockReset,
    mockIsReady,
    mockHasAccounts,
    mockDismissAll,
} = vi.hoisted(() => ({
    mockReplaceAllContacts: vi.fn(),
    mockHasAccounts: vi.fn(() => true),
    mockDismissAll: vi.fn(),
    mockReset: vi.fn(),
    mockIsReady: vi.fn(() => true),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useHasAccounts: mockHasAccounts,
}))

vi.mock('@perawallet/wallet-core-contacts', () => ({
    replaceAllContacts: mockReplaceAllContacts,
}))

vi.mock('react-native', () => ({
    LogBox: { ignoreAllLogs: vi.fn() },
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetStore: { getState: () => ({ dismissAll: mockDismissAll }) },
}))

vi.mock('../e2eNavTracer', () => ({
    startNavTracer: vi.fn(),
    snapshotOnNextState: vi.fn(),
}))

vi.mock('@routes/navigationRef', () => ({
    navigationRef: { reset: mockReset, isReady: mockIsReady },
}))

import { useE2eFixtureDeeplink } from '../useE2eFixtureDeeplink'

describe('useE2eFixtureDeeplink', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockIsReady.mockReturnValue(true)
        mockHasAccounts.mockReturnValue(true)
    })

    it('changes nothing before a wallet exists', () => {
        mockHasAccounts.mockReturnValue(false)
        const { result } = renderHook(() => useE2eFixtureDeeplink())

        result.current({ fixture: 'contacts-one' })

        expect(mockReplaceAllContacts).not.toHaveBeenCalled()
        expect(mockReset).not.toHaveBeenCalled()
    })

    it('empties contacts and lands on the contacts list', () => {
        const { result } = renderHook(() => useE2eFixtureDeeplink())

        result.current({ fixture: 'contacts-empty' })

        expect(mockDismissAll).toHaveBeenCalled()
        expect(mockReplaceAllContacts).toHaveBeenCalledWith([])
        expect(mockReset).toHaveBeenCalledWith({
            index: 1,
            routes: [
                { name: 'TabBar', key: expect.stringMatching(/^TabBar-e2e-/) },
                {
                    name: 'Contacts',
                    state: { routes: [{ name: 'ContactsList' }] },
                },
            ],
        })
    })

    it('seeds exactly one contact', () => {
        const { result } = renderHook(() => useE2eFixtureDeeplink())

        result.current({ fixture: 'contacts-one' })

        expect(mockReplaceAllContacts).toHaveBeenCalledWith([
            {
                id: 'e2e-fixture-contact',
                name: 'AutoTestContact',
                addresses: {
                    algorand:
                        'CBLWUBRWCWNKZ2Y2Q5HFKN7XISNBVAN47422MZOKH5OGCZ3H5JYLTDPLOA',
                },
            },
        ])
    })

    it('lands on Home without touching contacts', () => {
        const { result } = renderHook(() => useE2eFixtureDeeplink())

        result.current({ fixture: 'home' })

        expect(mockDismissAll).toHaveBeenCalled()
        expect(mockReplaceAllContacts).not.toHaveBeenCalled()
        expect(mockReset).toHaveBeenCalledWith({
            index: 0,
            routes: [
                { name: 'TabBar', key: expect.stringMatching(/^TabBar-e2e-/) },
            ],
        })
    })

    it('applies the fixture once navigation becomes ready', () => {
        vi.useFakeTimers()
        mockIsReady.mockReturnValue(false)
        const { result } = renderHook(() => useE2eFixtureDeeplink())

        result.current({ fixture: 'contacts-empty' })
        expect(mockReset).not.toHaveBeenCalled()

        mockIsReady.mockReturnValue(true)
        vi.advanceTimersByTime(100)

        expect(mockReset).toHaveBeenCalled()
        vi.useRealTimers()
    })

    it('changes nothing while navigation is not mounted yet', () => {
        mockIsReady.mockReturnValue(false)
        const { result } = renderHook(() => useE2eFixtureDeeplink())

        result.current({ fixture: 'contacts-empty' })

        expect(mockReplaceAllContacts).not.toHaveBeenCalled()
        expect(mockReset).not.toHaveBeenCalled()
    })
})
