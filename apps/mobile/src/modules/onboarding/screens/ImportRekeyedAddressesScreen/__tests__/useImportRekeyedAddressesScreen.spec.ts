/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    useAccountsStore,
    AccountTypes,
} from '@perawallet/wallet-core-accounts'
import { useIsOnboarding } from '@modules/onboarding/hooks'

const MOCK_ACCOUNTS = [
    {
        id: '1',
        address: 'ACC1',
        type: AccountTypes.algo25,
        rekeyAddress: 'REKEY',
        keyPairId: 'pk',
    },
    {
        id: '2',
        address: 'ACC2',
        type: AccountTypes.algo25,
        rekeyAddress: 'REKEY',
        keyPairId: 'pk2',
    },
]

vi.mock('@react-navigation/native', () => ({
    useRoute: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn(),
    useAccountsStore: {
        getState: vi.fn(),
    },
    AccountTypes: {
        algo25: 'algo25',
    },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (k: string) => k }),
}))

vi.mock('@modules/onboarding/hooks', () => ({
    useIsOnboarding: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    deferToNextCycle: (cb: () => void) => setTimeout(cb, 0),
}))

describe('useImportRekeyedAddressesScreen', () => {
    const mockSetIsOnboarding = vi.fn()
    const mockSetAccounts = vi.fn()
    const mockSetSelectedAccountAddress = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()

        vi.mocked(useRoute).mockReturnValue({
            params: { accounts: MOCK_ACCOUNTS },
        } as unknown as ReturnType<typeof useRoute>)

        vi.mocked(useAllAccounts).mockReturnValue([])

        vi.mocked(useAccountsStore.getState).mockReturnValue({
            setAccounts: mockSetAccounts,
            setSelectedAccountAddress: mockSetSelectedAccountAddress,
        } as unknown as ReturnType<typeof useAccountsStore.getState>)

        vi.mocked(useIsOnboarding).mockReturnValue({
            setIsOnboarding: mockSetIsOnboarding,
        } as unknown as ReturnType<typeof useIsOnboarding>)
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
        expect(mockSetSelectedAccountAddress).toHaveBeenCalledWith('ACC1')
        expect(mockSetIsOnboarding).toHaveBeenCalledWith(false)
    })

    it('handleContinue exits onboarding without importing if no accounts selected', () => {
        const { result } = renderHook(() => useImportRekeyedAddressesScreen())

        expect(result.current.selectedAddresses.size).toBe(0)

        act(() => {
            result.current.handleContinue()
        })

        expect(mockSetIsOnboarding).toHaveBeenCalledWith(false)
        expect(mockSetAccounts).not.toHaveBeenCalled()
        expect(mockSetSelectedAccountAddress).not.toHaveBeenCalled()
        expect(result.current.isImporting).toBe(false)
    })

    it('handleSkip finishes onboarding', () => {
        const { result } = renderHook(() => useImportRekeyedAddressesScreen())
        act(() => {
            result.current.handleSkip()
        })
        expect(mockSetIsOnboarding).toHaveBeenCalledWith(false)
    })
})
