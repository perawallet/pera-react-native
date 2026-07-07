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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { useOptOutConfirmationContent } from '../useOptOutConfirmationContent'

const mockUseMinimumFeeConfig = vi.fn()

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useMinimumFeeConfig: () => mockUseMinimumFeeConfig(),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    ALGO_ASSET: { assetId: '0', name: 'Algo', unitName: 'ALGO', decimals: 6 },
    toWholeUnits: (value: number | bigint, asset: { decimals: number }) =>
        new Decimal(value.toString()).div(new Decimal(10).pow(asset.decimals)),
}))

describe('useOptOutConfirmationContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('derives the fee from the remote-config minimum fee', () => {
        mockUseMinimumFeeConfig.mockReturnValue({ minTxnFee: 2000n })
        const { result } = renderHook(() => useOptOutConfirmationContent())
        expect(result.current.fee.toString()).toBe('0.002')
    })

    it('uses the default minimum fee when config is unchanged', () => {
        mockUseMinimumFeeConfig.mockReturnValue({ minTxnFee: 1000n })
        const { result } = renderHook(() => useOptOutConfirmationContent())
        expect(result.current.fee.toString()).toBe('0.001')
    })
})
