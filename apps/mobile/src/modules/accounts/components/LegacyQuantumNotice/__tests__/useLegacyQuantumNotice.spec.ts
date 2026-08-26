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
import { renderHook } from '@testing-library/react'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

const mockGetKey = vi.fn()

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: () => ({ getKey: mockGetKey }),
    PQ_DERIVATION_CANONICAL: 'pqk1',
}))

const mockUseRekeyedAddressesQuery = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useRekeyedAddressesQuery: () => mockUseRekeyedAddressesQuery(),
    }
})

import { useLegacyQuantumNotice } from '../useLegacyQuantumNotice'

const LEGACY_ACCOUNT: WalletAccount = {
    id: 'legacy-account-1',
    type: AccountTypes.quantum,
    address: 'LEGACYADDRESS',
    keyPairId: 'seed-1-quantum',
}

const CANONICAL_ACCOUNT: WalletAccount = {
    id: 'canonical-account-1',
    type: AccountTypes.quantum,
    address: 'CANONICALADDRESS',
    keyPairId: 'seed-2-quantum-pqk1',
}

const NO_LOOKUP_RESULT = {
    rekeyedAddresses: [] as string[],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
}

describe('useLegacyQuantumNotice', () => {
    beforeEach(() => {
        mockGetKey.mockReset()
        mockUseRekeyedAddressesQuery.mockReset()
        mockUseRekeyedAddressesQuery.mockReturnValue(NO_LOOKUP_RESULT)
    })

    test('shows the marker for a legacy account', () => {
        mockGetKey.mockReturnValue({ metadata: { pqDerivation: 'legacy' } })

        const { result } = renderHook(() =>
            useLegacyQuantumNotice(LEGACY_ACCOUNT),
        )

        expect(result.current.isLegacyQuantumAccount).toBe(true)
    })

    test('never shows for a canonical account', () => {
        mockGetKey.mockReturnValue({ metadata: { pqDerivation: 'pqk1' } })

        const { result } = renderHook(() =>
            useLegacyQuantumNotice(CANONICAL_ACCOUNT),
        )

        expect(result.current.isLegacyQuantumAccount).toBe(false)
    })

    // Fail closed: a child a migration failed to stamp must still read as
    // legacy, not silently as canonical.
    test('shows the marker when the derivation marker is undefined', () => {
        mockGetKey.mockReturnValue({ metadata: {} })

        const { result } = renderHook(() =>
            useLegacyQuantumNotice(LEGACY_ACCOUNT),
        )

        expect(result.current.isLegacyQuantumAccount).toBe(true)
    })

    test('uses the dependent-aware copy when an account is rekeyed to this address', () => {
        mockGetKey.mockReturnValue({ metadata: { pqDerivation: 'legacy' } })
        mockUseRekeyedAddressesQuery.mockReturnValue({
            rekeyedAddresses: ['SOME_DEPENDENT_ADDRESS'],
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() =>
            useLegacyQuantumNotice(LEGACY_ACCOUNT),
        )

        expect(result.current.shouldUseDependentAwareCopy).toBe(true)
    })

    test('falls back to the dependent-aware copy when the auth-addr lookup fails', () => {
        mockGetKey.mockReturnValue({ metadata: { pqDerivation: 'legacy' } })
        mockUseRekeyedAddressesQuery.mockReturnValue({
            rekeyedAddresses: undefined,
            isLoading: false,
            isError: true,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() =>
            useLegacyQuantumNotice(LEGACY_ACCOUNT),
        )

        expect(result.current.shouldUseDependentAwareCopy).toBe(true)
    })

    test('uses the dependent-aware copy while the lookup is still loading', () => {
        mockGetKey.mockReturnValue({ metadata: { pqDerivation: 'legacy' } })
        mockUseRekeyedAddressesQuery.mockReturnValue({
            rekeyedAddresses: undefined,
            isLoading: true,
            isError: false,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() =>
            useLegacyQuantumNotice(LEGACY_ACCOUNT),
        )

        expect(result.current.shouldUseDependentAwareCopy).toBe(true)
    })

    test('uses the plain copy once the lookup proves no dependents', () => {
        mockGetKey.mockReturnValue({ metadata: { pqDerivation: 'legacy' } })

        const { result } = renderHook(() =>
            useLegacyQuantumNotice(LEGACY_ACCOUNT),
        )

        expect(result.current.shouldUseDependentAwareCopy).toBe(false)
    })
})
