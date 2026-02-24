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
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useImportSelectAddressesScreen } from '../useImportSelectAddressesScreen'
import { useRoute } from '@react-navigation/native'
import {
    useAllAccounts,
    useAccountsStore,
    AccountTypes,
} from '@perawallet/wallet-core-accounts'

const mockExitAccountFlow = vi.fn()
const mockDiscoverRekeyedAccounts = vi.fn()
const mockReplace = vi.fn()

vi.mock('@react-navigation/native', () => ({
    useRoute: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn(),
    useAccountsStore: {
        getState: vi.fn(),
    },
    useAccountDiscovery: () => ({
        discoverRekeyedAccounts: mockDiscoverRekeyedAccounts,
    }),
    AccountTypes: {
        hdWallet: 'hdWallet',
    },
    DerivationTypes: {
        Peikert: 9,
    },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (k: string) => k }),
}))

vi.mock('@modules/onboarding/hooks', () => ({
    useExitAccountFlow: () => ({
        exitAccountFlow: mockExitAccountFlow,
    }),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        replace: mockReplace,
    }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    deferToNextCycle: (cb: () => void) => setTimeout(cb, 0),
}))

const MOCK_ACCOUNTS = [
    {
        id: '1',
        address: 'ADDR1',
        type: AccountTypes.hdWallet,
        hdWalletDetails: {
            account: 0,
            change: 0,
            keyIndex: 0,
            derivationType: 9,
        },
        keyPairId: 'pk',
    },
    {
        id: '2',
        address: 'ADDR2',
        type: AccountTypes.hdWallet,
        hdWalletDetails: {
            account: 0,
            change: 0,
            keyIndex: 1,
            derivationType: 9,
        },
        keyPairId: 'pk',
    },
]

describe('useImportSelectAddressesScreen', () => {
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

        mockDiscoverRekeyedAccounts.mockResolvedValue([])
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('initializes with all new accounts selected', () => {
        const { result } = renderHook(() => useImportSelectAddressesScreen())

        expect(result.current.selectedAddresses.size).toBe(2)
        expect(result.current.selectedAddresses.has('ADDR1')).toBe(true)
        expect(result.current.selectedAddresses.has('ADDR2')).toBe(true)
        expect(result.current.canContinue).toBe(true)
    })

    it('handleContinue selects the first new account after adding', async () => {
        const { result } = renderHook(() => useImportSelectAddressesScreen())

        act(() => {
            result.current.handleContinue()
        })

        act(() => {
            vi.runAllTimers()
        })

        // Wait for the async rekeyed discovery to resolve
        await vi.waitFor(() => {
            expect(mockSetAccounts).toHaveBeenCalledWith(MOCK_ACCOUNTS)
            expect(mockSetSelectedAccountAddress).toHaveBeenCalledWith('ADDR1')
            expect(mockExitAccountFlow).toHaveBeenCalled()
        })
    })

    it('toggleSelection updates state', () => {
        const { result } = renderHook(() => useImportSelectAddressesScreen())

        act(() => {
            result.current.toggleSelection('ADDR1')
        })

        expect(result.current.selectedAddresses.has('ADDR1')).toBe(false)
        expect(result.current.selectedAddresses.has('ADDR2')).toBe(true)
    })
})
