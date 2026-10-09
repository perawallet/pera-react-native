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
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { useRekeyFeePreflight } from '../useRekeyFeePreflight'

const mockUseOnChainAccountStateQuery = vi.fn()

// The real accounts module pulls in react-native-mmkv, which cannot load here.
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useOnChainAccountStateQuery: (address: string, scope: ChainScope) =>
        mockUseOnChainAccountStateQuery(address, scope),
}))

const SCOPE: ChainScope = {
    chainId: 'fixturehex' as ChainId,
    networkId: 'devnet',
}
const SOURCE_ADDRESS = 'SOURCE'.padEnd(58, 'A')
const FEE_ALGOS = new Decimal('0.001')

/** Base-unit inputs; the snapshot's balance and reserve are display units. */
const liveState = (balance: bigint, minBalance: bigint) => ({
    data: {
        nativeBalance: new Decimal(balance.toString()).div(1_000_000),
        minBalance: new Decimal(minBalance.toString()).div(1_000_000),
    },
})

const renderPreflight = (feeAlgos: Decimal | undefined) =>
    renderHook(() => useRekeyFeePreflight(SOURCE_ADDRESS, feeAlgos, SCOPE))

describe('useRekeyFeePreflight', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseOnChainAccountStateQuery.mockReturnValue({ data: undefined })
    })

    it('passes when spendable balance exactly equals the fee', () => {
        mockUseOnChainAccountStateQuery.mockReturnValue(
            liveState(101_000n, 100_000n),
        )

        const { result } = renderPreflight(FEE_ALGOS)

        expect(result.current.isUnderfunded).toBe(false)
    })

    it('flags underfunded when spendable is one base unit short of the fee', () => {
        mockUseOnChainAccountStateQuery.mockReturnValue(
            liveState(100_999n, 100_000n),
        )

        const { result } = renderPreflight(FEE_ALGOS)

        expect(result.current.isUnderfunded).toBe(true)
    })

    it('flags a zero-balance account', () => {
        mockUseOnChainAccountStateQuery.mockReturnValue(liveState(0n, 0n))

        const { result } = renderPreflight(FEE_ALGOS)

        expect(result.current.isUnderfunded).toBe(true)
    })

    it('does not flag while the fee is still unresolved', () => {
        mockUseOnChainAccountStateQuery.mockReturnValue(liveState(0n, 0n))

        const { result } = renderPreflight(undefined)

        expect(result.current.isUnderfunded).toBe(false)
    })

    it('does not flag while the account state is still loading', () => {
        const { result } = renderPreflight(FEE_ALGOS)

        expect(result.current.isUnderfunded).toBe(false)
    })

    it("reads the source's live chain state on the caller's scope", () => {
        mockUseOnChainAccountStateQuery.mockReturnValue(
            liveState(101_000n, 100_000n),
        )

        renderPreflight(FEE_ALGOS)

        expect(mockUseOnChainAccountStateQuery).toHaveBeenCalledWith(
            SOURCE_ADDRESS,
            SCOPE,
        )
    })

    it('unblocks once the live state shows the account was funded', () => {
        mockUseOnChainAccountStateQuery.mockReturnValue(liveState(0n, 0n))
        const { result, rerender } = renderPreflight(FEE_ALGOS)
        expect(result.current.isUnderfunded).toBe(true)

        mockUseOnChainAccountStateQuery.mockReturnValue(
            liveState(1_000_000n, 100_000n),
        )
        rerender()

        expect(result.current.isUnderfunded).toBe(false)
    })
})
