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
import { useOptInConfirmationContent } from '../useOptInConfirmationContent'

const mockUseMinimumFeeConfig = vi.fn()
const mockUseMinFeeForSender = vi.fn()

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useMinimumFeeConfig: () => mockUseMinimumFeeConfig(),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useMinFeeForSender: (address: string) => mockUseMinFeeForSender(address),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    ALGO_ASSET: { assetId: '0', name: 'Algo', unitName: 'ALGO', decimals: 6 },
    toWholeUnits: (value: number | bigint, asset: { decimals: number }) =>
        new Decimal(value.toString()).div(new Decimal(10).pow(asset.decimals)),
}))

describe('useOptInConfirmationContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseMinimumFeeConfig.mockReturnValue({ minTxnFee: 1000n })
        mockUseMinFeeForSender.mockReturnValue({
            minFee: undefined,
            isPending: true,
        })
    })

    it('falls back to the remote-config minimum while params load', () => {
        mockUseMinimumFeeConfig.mockReturnValue({ minTxnFee: 2000n })
        const { result } = renderHook(() =>
            useOptInConfirmationContent('SENDER'),
        )
        expect(result.current.resolvedFee.toString()).toBe('0.002')
    })

    // PERA-4922: a quantum sender pays the PQ multiple, and the quote has to
    // match the fee useAssetOptInMutation actually builds.
    it('quotes the sender-resolved fee once it is available', () => {
        mockUseMinimumFeeConfig.mockReturnValue({ minTxnFee: 1000n })
        mockUseMinFeeForSender.mockReturnValue({
            minFee: 3000n,
            isPending: false,
        })
        const { result } = renderHook(() =>
            useOptInConfirmationContent('QUANTUM_SENDER'),
        )
        expect(mockUseMinFeeForSender).toHaveBeenCalledWith('QUANTUM_SENDER')
        expect(result.current.resolvedFee.toString()).toBe('0.003')
    })

    it('prefers an explicit fee override over the resolved value', () => {
        mockUseMinFeeForSender.mockReturnValue({
            minFee: 3000n,
            isPending: false,
        })
        const { result } = renderHook(() =>
            useOptInConfirmationContent('SENDER', new Decimal(0)),
        )
        expect(result.current.resolvedFee.toString()).toBe('0')
    })
})
