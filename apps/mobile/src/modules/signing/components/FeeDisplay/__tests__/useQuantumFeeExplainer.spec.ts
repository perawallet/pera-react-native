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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    useAccountChainStateStore,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { encodeAlgorandAddress } from '@perawallet/wallet-core-chain-algorand/blockchain'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-chain-contract'
import { useSigningPipeline } from '@perawallet/wallet-core-signing'
import {
    registerAlgorandAccountsAdapter,
    seedAuthority,
} from '@test-utils/algorandAccountsAdapter'
import { useQuantumFeeExplainer } from '../useQuantumFeeExplainer'
import { capabilityState } from '@test-utils/capability-mock'

// Rekey resolution is what these cases exercise, so opt out of the unit
// setup's blanket accounts mock and run against the real store and the real
// signer lookup. `encodeAlgorandAddress` stays mocked (setup-wide) and is
// pointed at the address each authAddr case needs.
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningPipeline: vi.fn(),
}))

vi.mock('@hooks/useCapability', async () =>
    (await import('@test-utils/capability-mock')).capabilityHookMock(),
)

const QUANTUM_ADDRESS = 'QUANTUM_ADDR'
const STANDARD_ADDRESS = 'STANDARD_ADDR'
const FOREIGN_ADDRESS = 'FOREIGN_ADDR'

const quantumAccount = (authority?: string): WalletAccount => {
    if (authority) seedAuthority(QUANTUM_ADDRESS, authority)
    return {
        id: 'quantum-id',
        custody: { kind: 'local', seed: 'quantum' },
        address: QUANTUM_ADDRESS,
        keyPairId: 'quantum-key',
        name: 'Quantum',
    } as WalletAccount
}

const standardAccount = (authority?: string): WalletAccount => {
    if (authority) seedAuthority(STANDARD_ADDRESS, authority)
    return {
        id: 'standard-id',
        custody: { kind: 'local', seed: 'algo25' },
        address: STANDARD_ADDRESS,
        keyPairId: 'standard-key',
        name: 'Standard',
    } as WalletAccount
}

const buildTransaction = (
    overrides: Partial<PeraDisplayableTransaction> = {},
): PeraDisplayableTransaction =>
    ({
        sender: QUANTUM_ADDRESS,
        ...overrides,
    }) as PeraDisplayableTransaction

describe('useQuantumFeeExplainer', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        registerAlgorandAccountsAdapter()
        useAccountChainStateStore.getState().resetState()
        capabilityState.reset()
        ;(useSigningPipeline as Mock).mockReturnValue({ resolved: null })
        useAccountsStore.getState().setAccounts([])
    })

    it('returns true for a single-tx quantum signer', () => {
        useAccountsStore.getState().setAccounts([quantumAccount()])

        const { result } = renderHook(() =>
            useQuantumFeeExplainer(buildTransaction()),
        )

        expect(result.current.isQuantumFee).toBe(true)
    })

    it('returns false for a single-tx standard signer', () => {
        useAccountsStore.getState().setAccounts([standardAccount()])

        const { result } = renderHook(() =>
            useQuantumFeeExplainer(
                buildTransaction({ sender: STANDARD_ADDRESS }),
            ),
        )

        expect(result.current.isQuantumFee).toBe(false)
    })

    it('resolves the ARC-0001 authAddr override to a quantum account', () => {
        useAccountsStore
            .getState()
            .setAccounts([quantumAccount(), standardAccount()])
        const publicKey = new Uint8Array([1, 2, 3])
        ;(encodeAlgorandAddress as Mock).mockReturnValue(QUANTUM_ADDRESS)

        const { result } = renderHook(() =>
            useQuantumFeeExplainer(
                buildTransaction({
                    sender: STANDARD_ADDRESS,
                    authAddr: { publicKey },
                } as Partial<PeraDisplayableTransaction>),
            ),
        )

        expect(encodeAlgorandAddress).toHaveBeenCalledWith(publicKey)
        expect(result.current.isQuantumFee).toBe(true)
    })

    it('returns false when a quantum sender is rekeyed to a standard account', () => {
        useAccountsStore
            .getState()
            .setAccounts([quantumAccount(STANDARD_ADDRESS), standardAccount()])

        const { result } = renderHook(() =>
            useQuantumFeeExplainer(buildTransaction()),
        )

        expect(result.current.isQuantumFee).toBe(false)
    })

    it('returns true when a standard sender is rekeyed to a quantum account', () => {
        useAccountsStore
            .getState()
            .setAccounts([standardAccount(QUANTUM_ADDRESS), quantumAccount()])

        const { result } = renderHook(() =>
            useQuantumFeeExplainer(
                buildTransaction({ sender: STANDARD_ADDRESS }),
            ),
        )

        expect(result.current.isQuantumFee).toBe(true)
    })

    it('returns false when the rekey target is not a local account', () => {
        useAccountsStore
            .getState()
            .setAccounts([quantumAccount(FOREIGN_ADDRESS)])

        const { result } = renderHook(() =>
            useQuantumFeeExplainer(buildTransaction()),
        )

        expect(result.current.isQuantumFee).toBe(false)
    })

    it('returns true for a group total whose pipeline signer is quantum', () => {
        useAccountsStore.getState().setAccounts([quantumAccount()])
        ;(useSigningPipeline as Mock).mockReturnValue({
            resolved: { signerAccount: quantumAccount() },
        })

        const { result } = renderHook(() => useQuantumFeeExplainer())

        expect(result.current.isQuantumFee).toBe(true)
    })

    it('returns false for a group total whose pipeline signer is standard', () => {
        useAccountsStore.getState().setAccounts([standardAccount()])
        ;(useSigningPipeline as Mock).mockReturnValue({
            resolved: { signerAccount: standardAccount() },
        })

        const { result } = renderHook(() => useQuantumFeeExplainer())

        expect(result.current.isQuantumFee).toBe(false)
    })

    it('returns false for a group total whose quantum signer is rekeyed to a standard account', () => {
        useAccountsStore
            .getState()
            .setAccounts([quantumAccount(STANDARD_ADDRESS), standardAccount()])
        ;(useSigningPipeline as Mock).mockReturnValue({
            resolved: { signerAccount: quantumAccount(STANDARD_ADDRESS) },
        })

        const { result } = renderHook(() => useQuantumFeeExplainer())

        expect(result.current.isQuantumFee).toBe(false)
    })

    it('still explains the premium an existing quantum account pays after quantumAccounts is switched off', () => {
        capabilityState.turnOff('quantumAccounts')
        useAccountsStore.getState().setAccounts([quantumAccount()])

        const { result } = renderHook(() =>
            useQuantumFeeExplainer(buildTransaction()),
        )

        expect(result.current.isQuantumFee).toBe(true)
    })
})
