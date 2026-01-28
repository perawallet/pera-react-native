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
    canSign: true,
    rekeyAddress: 'REKEY',
  },
  {
    id: '2',
    address: 'ACC2',
    type: AccountTypes.algo25,
    canSign: true,
    rekeyAddress: 'REKEY',
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

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    vi.mocked(useRoute).mockReturnValue({
      params: { accounts: MOCK_ACCOUNTS },
    } as unknown as ReturnType<typeof useRoute>)

    vi.mocked(useAllAccounts).mockReturnValue([])

    vi.mocked(useAccountsStore.getState).mockReturnValue({
      setAccounts: mockSetAccounts,
    } as unknown as ReturnType<typeof useAccountsStore.getState>)

    vi.mocked(useIsOnboarding).mockReturnValue({
      setIsOnboarding: mockSetIsOnboarding,
    } as unknown as ReturnType<typeof useIsOnboarding>)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes with all non-imported accounts selected', () => {
    const { result } = renderHook(() => useImportRekeyedAddressesScreen())

    expect(result.current.selectedAddresses.size).toBe(2)
    expect(result.current.selectedAddresses.has('ACC1')).toBe(true)
    expect(result.current.selectedAddresses.has('ACC2')).toBe(true)
    expect(result.current.canContinue).toBe(true)
  })

  it('toggling selection updates state', () => {
    const { result } = renderHook(() => useImportRekeyedAddressesScreen())

    act(() => {
      result.current.toggleSelection('ACC1')
    })

    expect(result.current.selectedAddresses.has('ACC1')).toBe(false)
    expect(result.current.selectedAddresses.has('ACC2')).toBe(true)
    expect(result.current.canContinue).toBe(true) // ACC2 still selected

    act(() => {
      result.current.toggleSelection('ACC2')
    })

    expect(result.current.selectedAddresses.size).toBe(0)
    expect(result.current.canContinue).toBe(false)
  })

  it('excludes already imported addresses from initial selection', () => {
    vi.mocked(useAllAccounts).mockReturnValue([
      { ...MOCK_ACCOUNTS[0] }, // ACC1 is already imported
    ])

    const { result } = renderHook(() => useImportRekeyedAddressesScreen())

    expect(result.current.alreadyImportedAddresses.has('ACC1')).toBe(true)
    expect(result.current.selectedAddresses.has('ACC1')).toBe(false)
    expect(result.current.selectedAddresses.has('ACC2')).toBe(true)
  })

  it('handleContinue imports accounts and finishes onboarding', () => {
    const { result } = renderHook(() => useImportRekeyedAddressesScreen())

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
    expect(mockSetIsOnboarding).toHaveBeenCalledWith(false)
    // Since component unmounts or state updates might happen async, check hook result if possible,
    // but typically in test environment hook might not update if unmounted/navigated.
    // However, we can check side effects.
  })

  it('handleContinue is skipped if no accounts selected', () => {
    const { result } = renderHook(() => useImportRekeyedAddressesScreen())

    // Deselect all
    act(() => {
      result.current.toggleSelectAll()
    })

    expect(result.current.selectedAddresses.size).toBe(0)

    act(() => {
      result.current.handleContinue()
    })

    // Should exit immediately, just setIsOnboarding(false) theoretically, 
    // but current logic: if accountsToAdd.length === 0 -> setIsOnboarding(false).
    expect(mockSetIsOnboarding).toHaveBeenCalledWith(false)
    expect(mockSetAccounts).not.toHaveBeenCalled()
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
