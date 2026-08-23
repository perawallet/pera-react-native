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
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

const mockUseAllAccounts = vi.fn<() => WalletAccount[]>()
const mockFetchRekeyedAddresses = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAllAccounts: () => mockUseAllAccounts(),
        fetchRekeyedAddresses: (...args: unknown[]) =>
            mockFetchRekeyedAddresses(...args),
    }
})

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        useNetwork: () => ({ network: 'mainnet' }),
    }
})

const mockGetKey = vi.fn()

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: () => ({ getKey: mockGetKey }),
    PQ_DERIVATION_CANONICAL: 'pqk1',
}))

import { useLegacyQuantumPrompt } from '../useLegacyQuantumPrompt'

const legacyAccount = (id: string, address: string): WalletAccount => ({
    id,
    type: AccountTypes.quantum,
    address,
    keyPairId: `${id}-quantum`,
})

const canonicalAccount = (id: string, address: string): WalletAccount => ({
    id,
    type: AccountTypes.quantum,
    address,
    keyPairId: `${id}-quantum-pqk1`,
})

const buildWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

describe('useLegacyQuantumPrompt', () => {
    beforeEach(() => {
        mockUseAllAccounts.mockReset()
        mockFetchRekeyedAddresses.mockReset()
        mockGetKey.mockReset()
    })

    test('is not due when the wallet holds no quantum accounts', () => {
        mockUseAllAccounts.mockReturnValue([])

        const { result } = renderHook(() => useLegacyQuantumPrompt(), {
            wrapper: buildWrapper(),
        })

        expect(result.current.isDue).toBe(false)
    })

    test('is not due when every quantum account is canonical', () => {
        const account = canonicalAccount('a1', 'ADDR1')
        mockUseAllAccounts.mockReturnValue([account])
        mockGetKey.mockReturnValue({ metadata: { pqDerivation: 'pqk1' } })

        const { result } = renderHook(() => useLegacyQuantumPrompt(), {
            wrapper: buildWrapper(),
        })

        expect(result.current.isDue).toBe(false)
    })

    test('is due when the wallet holds at least one legacy quantum account', () => {
        const account = legacyAccount('a1', 'ADDR1')
        mockUseAllAccounts.mockReturnValue([account])
        mockGetKey.mockReturnValue({ metadata: { pqDerivation: 'legacy' } })
        mockFetchRekeyedAddresses.mockResolvedValue([])

        const { result } = renderHook(() => useLegacyQuantumPrompt(), {
            wrapper: buildWrapper(),
        })

        expect(result.current.isDue).toBe(true)
    })

    // Fail closed: a child a migration failed to stamp reads as legacy at the
    // wallet level too, not just per-account.
    test('is due when a legacy account has no derivation marker at all', () => {
        const account = legacyAccount('a1', 'ADDR1')
        mockUseAllAccounts.mockReturnValue([account])
        mockGetKey.mockReturnValue({ metadata: {} })
        mockFetchRekeyedAddresses.mockResolvedValue([])

        const { result } = renderHook(() => useLegacyQuantumPrompt(), {
            wrapper: buildWrapper(),
        })

        expect(result.current.isDue).toBe(true)
    })

    test('uses the plain copy once every legacy account proves no dependents', async () => {
        const accounts = [
            legacyAccount('a1', 'ADDR1'),
            legacyAccount('a2', 'ADDR2'),
        ]
        mockUseAllAccounts.mockReturnValue(accounts)
        mockGetKey.mockReturnValue({ metadata: { pqDerivation: 'legacy' } })
        mockFetchRekeyedAddresses.mockResolvedValue([])

        const { result } = renderHook(() => useLegacyQuantumPrompt(), {
            wrapper: buildWrapper(),
        })

        await waitFor(() =>
            expect(result.current.shouldUseDependentAwareCopy).toBe(false),
        )
    })

    test('aggregates with OR: one dependent among several accounts is enough', async () => {
        const accounts = [
            legacyAccount('a1', 'ADDR1'),
            legacyAccount('a2', 'ADDR2'),
        ]
        mockUseAllAccounts.mockReturnValue(accounts)
        mockGetKey.mockReturnValue({ metadata: { pqDerivation: 'legacy' } })
        mockFetchRekeyedAddresses.mockImplementation(async (address: string) =>
            address === 'ADDR2' ? ['SOME_DEPENDENT'] : [],
        )

        const { result } = renderHook(() => useLegacyQuantumPrompt(), {
            wrapper: buildWrapper(),
        })

        await waitFor(() =>
            expect(result.current.shouldUseDependentAwareCopy).toBe(true),
        )
    })

    test('aggregates with OR: one failed lookup among several accounts is enough', async () => {
        const accounts = [
            legacyAccount('a1', 'ADDR1'),
            legacyAccount('a2', 'ADDR2'),
        ]
        mockUseAllAccounts.mockReturnValue(accounts)
        mockGetKey.mockReturnValue({ metadata: { pqDerivation: 'legacy' } })
        mockFetchRekeyedAddresses.mockImplementation(async (address: string) =>
            address === 'ADDR2'
                ? Promise.reject(new Error('indexer down'))
                : [],
        )

        const { result } = renderHook(() => useLegacyQuantumPrompt(), {
            wrapper: buildWrapper(),
        })

        await waitFor(() =>
            expect(result.current.shouldUseDependentAwareCopy).toBe(true),
        )
    })

    test('uses the dependent-aware copy while a lookup is still in flight', () => {
        const account = legacyAccount('a1', 'ADDR1')
        mockUseAllAccounts.mockReturnValue([account])
        mockGetKey.mockReturnValue({ metadata: { pqDerivation: 'legacy' } })
        mockFetchRekeyedAddresses.mockReturnValue(new Promise(() => {}))

        const { result } = renderHook(() => useLegacyQuantumPrompt(), {
            wrapper: buildWrapper(),
        })

        expect(result.current.shouldUseDependentAwareCopy).toBe(true)
    })
})
