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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    isQuantumAccount,
    useFindAccountByAddress,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    encodeAlgorandAddress,
    type PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { useSigningPipeline } from '@perawallet/wallet-core-signing'
import { useIsQuantumAccountsEnabled } from '@hooks/useIsQuantumAccountsEnabled'
import { useQuantumFeeExplainer } from '../useQuantumFeeExplainer'

vi.mock('@perawallet/wallet-core-accounts', () => ({
    isQuantumAccount: vi.fn(),
    useFindAccountByAddress: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    encodeAlgorandAddress: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningPipeline: vi.fn(),
}))

vi.mock('@hooks/useIsQuantumAccountsEnabled', () => ({
    useIsQuantumAccountsEnabled: vi.fn(),
}))

const quantumAccount = { address: 'QUANTUM_ADDR' } as unknown as WalletAccount
const standardAccount = { address: 'STANDARD_ADDR' } as unknown as WalletAccount

const buildTransaction = (
    overrides: Partial<PeraDisplayableTransaction> = {},
): PeraDisplayableTransaction =>
    ({
        sender: 'SENDER_ADDR',
        ...overrides,
    }) as PeraDisplayableTransaction

describe('useQuantumFeeExplainer', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(useIsQuantumAccountsEnabled as Mock).mockReturnValue(true)
        ;(useSigningPipeline as Mock).mockReturnValue({ resolved: null })
        ;(useFindAccountByAddress as Mock).mockReturnValue(null)
        ;(isQuantumAccount as unknown as Mock).mockImplementation(
            (account: WalletAccount) => account === quantumAccount,
        )
        ;(encodeAlgorandAddress as Mock).mockReturnValue('ENCODED_AUTH_ADDR')
    })

    it('returns true for a single-tx quantum signer', () => {
        ;(useFindAccountByAddress as Mock).mockReturnValue(quantumAccount)
        const transaction = buildTransaction()

        const { result } = renderHook(() => useQuantumFeeExplainer(transaction))

        expect(useFindAccountByAddress).toHaveBeenCalledWith('SENDER_ADDR')
        expect(result.current.isQuantumFee).toBe(true)
    })

    it('returns false for a single-tx standard signer', () => {
        ;(useFindAccountByAddress as Mock).mockReturnValue(standardAccount)
        const transaction = buildTransaction()

        const { result } = renderHook(() => useQuantumFeeExplainer(transaction))

        expect(result.current.isQuantumFee).toBe(false)
    })

    it('resolves the auth address for a tx rekeyed to a quantum account', () => {
        ;(useFindAccountByAddress as Mock).mockReturnValue(quantumAccount)
        const publicKey = new Uint8Array([1, 2, 3])
        const transaction = buildTransaction({
            authAddr: { publicKey },
        } as Partial<PeraDisplayableTransaction>)

        const { result } = renderHook(() => useQuantumFeeExplainer(transaction))

        expect(encodeAlgorandAddress).toHaveBeenCalledWith(publicKey)
        expect(useFindAccountByAddress).toHaveBeenCalledWith(
            'ENCODED_AUTH_ADDR',
        )
        expect(result.current.isQuantumFee).toBe(true)
    })

    it('returns true for a group total whose pipeline signer is quantum', () => {
        ;(useSigningPipeline as Mock).mockReturnValue({
            resolved: { signerAccount: quantumAccount },
        })

        const { result } = renderHook(() => useQuantumFeeExplainer())

        expect(result.current.isQuantumFee).toBe(true)
    })

    it('returns false for a group total whose pipeline signer is standard', () => {
        ;(useSigningPipeline as Mock).mockReturnValue({
            resolved: { signerAccount: standardAccount },
        })

        const { result } = renderHook(() => useQuantumFeeExplainer())

        expect(result.current.isQuantumFee).toBe(false)
    })

    it('returns false when the feature flag is disabled', () => {
        ;(useIsQuantumAccountsEnabled as Mock).mockReturnValue(false)
        ;(useFindAccountByAddress as Mock).mockReturnValue(quantumAccount)
        const transaction = buildTransaction()

        const { result } = renderHook(() => useQuantumFeeExplainer(transaction))

        expect(result.current.isQuantumFee).toBe(false)
    })
})
