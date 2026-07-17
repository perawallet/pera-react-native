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

import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useImportRekeyedAddressesScreen } from '../useImportRekeyedAddressesScreen'
import { useRoute } from '@react-navigation/native'
import {
    useAllAccounts,
    useSetAccounts,
    useSelectedAccountAddress,
    AccountTypes,
} from '@perawallet/wallet-core-accounts'
import { useExitAccountFlow } from '@modules/onboarding/hooks'

// Real rekeyed candidates are watch accounts WITHOUT keyPairId, pointing at
// the discovered auth address (account-discovery.ts) — LRK-022 fixture
// realism, so shape drift in the discovery output fails loudly here.
const MOCK_ACCOUNTS = [
    {
        id: '1',
        address: 'ACC1',
        type: AccountTypes.watch,
        rekeyAddress: 'REKEY',
    },
    {
        id: '2',
        address: 'ACC2',
        type: AccountTypes.watch,
        rekeyAddress: 'REKEY',
    },
]

vi.mock('@react-navigation/native', () => ({
    useRoute: vi.fn(),
}))

const mockStoreAccounts: { current: unknown[] } = { current: [] }

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn(),
    useSetAccounts: vi.fn(),
    useSelectedAccountAddress: vi.fn(),
    useAccountsStore: {
        getState: () => ({ accounts: mockStoreAccounts.current }),
    },
    AccountTypes: {
        algo25: 'algo25',
        watch: 'watch',
    },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (k: string) => k }),
}))

vi.mock('@modules/onboarding/hooks', () => ({
    useExitAccountFlow: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    deferToNextCycle: (cb: () => void) => setTimeout(cb, 0),
}))

describe('useImportRekeyedAddressesScreen', () => {
    const mockExitAccountFlow = vi.fn()
    const mockSetAccounts = vi.fn()
    const mockSetSelectedAccountAddress = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        mockStoreAccounts.current = []

        vi.mocked(useRoute).mockReturnValue({
            params: { accounts: MOCK_ACCOUNTS },
        } as unknown as ReturnType<typeof useRoute>)

        vi.mocked(useAllAccounts).mockReturnValue([])

        vi.mocked(useSetAccounts).mockReturnValue({
            setAccounts: mockSetAccounts,
        })

        vi.mocked(useSelectedAccountAddress).mockReturnValue({
            selectedAccountAddress: null,
            setSelectedAccountAddress: mockSetSelectedAccountAddress,
        })

        vi.mocked(useExitAccountFlow).mockReturnValue({
            exitAccountFlow: mockExitAccountFlow,
        })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('initializes with no accounts selected', () => {
        const { result } = renderHook(() => useImportRekeyedAddressesScreen())

        expect(result.current.selectedAddresses.size).toBe(0)
        expect(result.current.canContinue).toBe(false)
    })

    it('toggling selection updates state', () => {
        const { result } = renderHook(() => useImportRekeyedAddressesScreen())

        act(() => {
            result.current.toggleSelection('ACC1')
        })

        expect(result.current.selectedAddresses.has('ACC1')).toBe(true)
        expect(result.current.selectedAddresses.has('ACC2')).toBe(false)
        expect(result.current.canContinue).toBe(true)

        act(() => {
            result.current.toggleSelection('ACC1')
        })

        expect(result.current.selectedAddresses.size).toBe(0)
        expect(result.current.canContinue).toBe(false)
    })

    it('tracks already imported addresses without selecting any', () => {
        vi.mocked(useAllAccounts).mockReturnValue([
            { ...MOCK_ACCOUNTS[0] }, // ACC1 is already imported
        ])

        const { result } = renderHook(() => useImportRekeyedAddressesScreen())

        expect(result.current.alreadyImportedAddresses.has('ACC1')).toBe(true)
        expect(result.current.selectedAddresses.size).toBe(0)
    })

    it('handleContinue imports selected accounts and finishes onboarding', () => {
        const { result } = renderHook(() => useImportRekeyedAddressesScreen())

        // Select both accounts
        act(() => {
            result.current.toggleSelection('ACC1')
            result.current.toggleSelection('ACC2')
        })

        act(() => {
            result.current.handleContinue()
        })

        // Immediate state update
        expect(result.current.isImporting).toBe(true)

        // Run deferred task
        act(() => {
            vi.runAllTimers()
        })

        expect(mockSetAccounts).toHaveBeenCalledWith(MOCK_ACCOUNTS)
        // Pin the persisted shape: watch + rekeyAddress, never a signer type.
        const persisted = mockSetAccounts.mock.calls[0][0] as Array<{
            type: string
            rekeyAddress?: string
            keyPairId?: string
        }>
        for (const account of persisted) {
            expect(account.type).toBe(AccountTypes.watch)
            expect(account.rekeyAddress).toBe('REKEY')
            expect(account.keyPairId).toBeUndefined()
        }
        expect(mockSetSelectedAccountAddress).not.toHaveBeenCalled()
        expect(mockExitAccountFlow).toHaveBeenCalled()
    })

    it('reads the store fresh inside the deferred write so a concurrent add is not dropped', () => {
        const concurrent = {
            id: 'c',
            address: 'CONCURRENT',
            type: AccountTypes.algo25,
            keyPairId: 'pkc',
        }
        // Lands after render (useAllAccounts snapshot) but before the
        // deferred commit — e.g. background sync or another import flow.
        mockStoreAccounts.current = [concurrent]

        const { result } = renderHook(() => useImportRekeyedAddressesScreen())

        act(() => {
            result.current.toggleSelection('ACC1')
        })
        act(() => {
            result.current.handleContinue()
        })
        act(() => {
            vi.runAllTimers()
        })

        expect(mockSetAccounts).toHaveBeenCalledWith([
            concurrent,
            MOCK_ACCOUNTS[0],
        ])
    })

    it('handleContinue exits flow without importing if no accounts selected', () => {
        const { result } = renderHook(() => useImportRekeyedAddressesScreen())

        expect(result.current.selectedAddresses.size).toBe(0)

        act(() => {
            result.current.handleContinue()
        })

        expect(mockExitAccountFlow).toHaveBeenCalled()
        expect(mockSetAccounts).not.toHaveBeenCalled()
        expect(mockSetSelectedAccountAddress).not.toHaveBeenCalled()
        expect(result.current.isImporting).toBe(false)
    })

    it('handleSkip exits the account flow', () => {
        const { result } = renderHook(() => useImportRekeyedAddressesScreen())
        act(() => {
            result.current.handleSkip()
        })
        expect(mockExitAccountFlow).toHaveBeenCalled()
    })
})
