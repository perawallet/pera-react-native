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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { useRekeyFeePreflight } from '../useRekeyFeePreflight'

const mockUseAccountInformationQuery = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountInformationQuery: (address: string) =>
        mockUseAccountInformationQuery(address),
}))

// Faithful reimplementation — the real module pulls in react-native-mmkv,
// which cannot load in the node test environment.
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    algosToMicroAlgosBigInt: (algos: Decimal) =>
        BigInt(algos.mul(1_000_000).toFixed(0)),
}))

const SOURCE_ADDRESS = 'SOURCE'.padEnd(58, 'A')
const FEE_ALGOS = new Decimal('0.001')

const accountInfo = (amount: bigint, minBalance: bigint) => ({
    data: { amount, minBalance },
})

describe('useRekeyFeePreflight', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAccountInformationQuery.mockReturnValue({ data: undefined })
    })

    it('passes when spendable balance exactly equals the fee', () => {
        mockUseAccountInformationQuery.mockReturnValue(
            accountInfo(101_000n, 100_000n),
        )

        const { result } = renderHook(() =>
            useRekeyFeePreflight(SOURCE_ADDRESS, FEE_ALGOS),
        )

        expect(result.current.isUnderfunded).toBe(false)
    })

    it('flags underfunded when spendable is one microalgo short of the fee', () => {
        mockUseAccountInformationQuery.mockReturnValue(
            accountInfo(100_999n, 100_000n),
        )

        const { result } = renderHook(() =>
            useRekeyFeePreflight(SOURCE_ADDRESS, FEE_ALGOS),
        )

        expect(result.current.isUnderfunded).toBe(true)
    })

    it('flags a zero-balance account', () => {
        mockUseAccountInformationQuery.mockReturnValue(accountInfo(0n, 0n))

        const { result } = renderHook(() =>
            useRekeyFeePreflight(SOURCE_ADDRESS, FEE_ALGOS),
        )

        expect(result.current.isUnderfunded).toBe(true)
    })

    it('does not flag while the fee is still unresolved', () => {
        mockUseAccountInformationQuery.mockReturnValue(accountInfo(0n, 0n))

        const { result } = renderHook(() =>
            useRekeyFeePreflight(SOURCE_ADDRESS, undefined),
        )

        expect(result.current.isUnderfunded).toBe(false)
    })

    it('does not flag while the balance row has not loaded', () => {
        const { result } = renderHook(() =>
            useRekeyFeePreflight(SOURCE_ADDRESS, FEE_ALGOS),
        )

        expect(result.current.isUnderfunded).toBe(false)
    })

    it('reads the balance of the source address', () => {
        mockUseAccountInformationQuery.mockReturnValue(
            accountInfo(101_000n, 100_000n),
        )

        renderHook(() => useRekeyFeePreflight(SOURCE_ADDRESS, FEE_ALGOS))

        expect(mockUseAccountInformationQuery).toHaveBeenCalledWith(
            SOURCE_ADDRESS,
        )
    })
})
