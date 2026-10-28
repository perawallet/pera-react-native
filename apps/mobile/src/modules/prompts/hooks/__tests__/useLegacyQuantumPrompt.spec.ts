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
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'

const mockUseAllAccounts = vi.fn<() => WalletAccount[]>()
const mockUseAnyDelegatedAddressesQuery = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAllAccounts: () => mockUseAllAccounts(),
        useAnyDelegatedAddressesQuery: (...args: unknown[]) =>
            mockUseAnyDelegatedAddressesQuery(...args),
    }
})

vi.mock(
    '@perawallet/wallet-core-chain-algorand/blockchain',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@perawallet/wallet-core-chain-algorand/blockchain')
        >()),
    }),
)

const mockGetKey = vi.fn()

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: () => ({ getKey: mockGetKey }),
    FALCON_CHILD_KEY_TYPE: 'falcon-1024',
    PQ_DERIVATION_CANONICAL: 'pqk1',
    SeedScheme: { Bip39: 'bip39', Algo25: 'algo25', Quantum: 'quantum' },
}))

import { useLegacyQuantumPrompt } from '../useLegacyQuantumPrompt'

const legacyAccount = (id: string, address: string): WalletAccount => ({
    id,
    custody: { kind: 'local', seed: 'quantum' },
    chains: { algorand: { address, keyPairId: `${id}-quantum` } },
})

const canonicalAccount = (id: string, address: string): WalletAccount => ({
    id,
    custody: { kind: 'local', seed: 'quantum' },
    chains: { algorand: { address, keyPairId: `${id}-quantum-pqk1` } },
})

const lookups = (result: {
    hasDelegatedAddresses: boolean
    isEveryLookupSuccessful: boolean
}) => mockUseAnyDelegatedAddressesQuery.mockReturnValue(result)

describe('useLegacyQuantumPrompt', () => {
    beforeEach(() => {
        mockUseAllAccounts.mockReset()
        mockUseAnyDelegatedAddressesQuery.mockReset()
        mockGetKey.mockReset()
        lookups({ hasDelegatedAddresses: false, isEveryLookupSuccessful: true })
    })

    test('is not due when the wallet holds no quantum accounts', () => {
        mockUseAllAccounts.mockReturnValue([])

        const { result } = renderHook(() => useLegacyQuantumPrompt())

        expect(result.current.isDue).toBe(false)
        expect(mockUseAnyDelegatedAddressesQuery).toHaveBeenCalledWith(
            [],
            expect.anything(),
        )
    })

    test('is not due when every quantum account is canonical', () => {
        const account = canonicalAccount('a1', 'ADDR1')
        mockUseAllAccounts.mockReturnValue([account])
        mockGetKey.mockReturnValue({
            type: 'falcon-1024',
            metadata: { pqDerivation: 'pqk1' },
        })

        const { result } = renderHook(() => useLegacyQuantumPrompt())

        expect(result.current.isDue).toBe(false)
    })

    test('is due when the wallet holds at least one legacy quantum account', () => {
        const account = legacyAccount('a1', 'ADDR1')
        mockUseAllAccounts.mockReturnValue([account])
        mockGetKey.mockReturnValue({
            type: 'falcon-1024',
            metadata: { pqDerivation: 'legacy' },
        })

        const { result } = renderHook(() => useLegacyQuantumPrompt())

        expect(result.current.isDue).toBe(true)
        expect(mockUseAnyDelegatedAddressesQuery).toHaveBeenCalledWith(
            ['ADDR1'],
            expect.objectContaining({ chainId: LEGACY_CHAIN_ID }),
        )
    })

    // Fail closed: a child a migration failed to stamp reads as legacy at the
    // wallet level too, not just per-account.
    test('is due when a legacy account has no derivation marker at all', () => {
        const account = legacyAccount('a1', 'ADDR1')
        mockUseAllAccounts.mockReturnValue([account])
        mockGetKey.mockReturnValue({
            type: 'falcon-1024',
            metadata: {},
        })

        const { result } = renderHook(() => useLegacyQuantumPrompt())

        expect(result.current.isDue).toBe(true)
    })

    describe.each([
        ['every legacy account proves no dependents', false, true, false],
        ['a legacy account has a dependent', true, true, true],
        ['a lookup is unproven', false, false, true],
    ])(
        'when %s',
        (_name, hasDelegatedAddresses, isEveryLookupSuccessful, expected) => {
            test(`uses the ${expected ? 'dependent-aware' : 'plain'} copy`, () => {
                mockUseAllAccounts.mockReturnValue([
                    legacyAccount('a1', 'ADDR1'),
                ])
                mockGetKey.mockReturnValue({
                    type: 'falcon-1024',
                    metadata: { pqDerivation: 'legacy' },
                })
                lookups({ hasDelegatedAddresses, isEveryLookupSuccessful })

                const { result } = renderHook(() => useLegacyQuantumPrompt())

                expect(result.current.shouldUseDependentAwareCopy).toBe(
                    expected,
                )
            })
        },
    )
})
