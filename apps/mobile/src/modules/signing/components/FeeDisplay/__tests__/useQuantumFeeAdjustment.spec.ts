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
import type {
    PeraDisplayableTransaction,
    PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { useSigningPipeline } from '@perawallet/wallet-core-signing'
import { useQuantumFeeAdjustment } from '../useQuantumFeeAdjustment'

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningPipeline: vi.fn(),
}))

// Raw group members — the pipeline maps each to a displayable transaction whose
// `rawTransaction` field is object-identical to the source entry (verified: the
// only field `mapToDisplayableTransaction` preserves that survives matching).
const rawTx0 = { sender: 'A' } as unknown as PeraTransaction
const rawTx1 = { sender: 'B' } as unknown as PeraTransaction

const buildDisplayable = (
    rawTransaction: PeraTransaction,
): PeraDisplayableTransaction =>
    ({ rawTransaction }) as unknown as PeraDisplayableTransaction

const mockPipeline = (overrides: Record<string, unknown>): void => {
    ;(useSigningPipeline as Mock).mockReturnValue({
        feeAdjustments: [],
        currentRequest: undefined,
        ...overrides,
    })
}

describe('useQuantumFeeAdjustment', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockPipeline({})
    })

    it('is not adjusted when the pipeline has no fee adjustments', () => {
        mockPipeline({ feeAdjustments: [] })

        const { result } = renderHook(() => useQuantumFeeAdjustment())

        expect(result.current.isAdjusted).toBe(false)
        expect(result.current.originalFee.toString()).toBe('0')
        expect(result.current.adjustedFee.toString()).toBe('0')
    })

    it('sums adjustments (µAlgo → ALGO) in group-total mode', () => {
        mockPipeline({
            feeAdjustments: [
                { index: 0, originalFee: 1000n, adjustedFee: 3000n },
                { index: 1, originalFee: 1000n, adjustedFee: 3000n },
            ],
        })

        const { result } = renderHook(() => useQuantumFeeAdjustment())

        expect(result.current.isAdjusted).toBe(true)
        expect(result.current.originalFee.toString()).toBe('0.002')
        expect(result.current.adjustedFee.toString()).toBe('0.006')
    })

    it('matches only the adjusted transaction in per-transaction mode', () => {
        const groupContext = [rawTx0, rawTx1]
        mockPipeline({
            feeAdjustments: [
                { index: 1, originalFee: 1000n, adjustedFee: 3000n },
            ],
            currentRequest: {
                type: 'transactions',
                txs: groupContext,
                groupContext,
            },
        })

        const first = renderHook(() =>
            useQuantumFeeAdjustment(buildDisplayable(rawTx0)),
        )
        const second = renderHook(() =>
            useQuantumFeeAdjustment(buildDisplayable(rawTx1)),
        )

        expect(first.result.current.isAdjusted).toBe(false)
        expect(second.result.current.isAdjusted).toBe(true)
        expect(second.result.current.originalFee.toString()).toBe('0.001')
        expect(second.result.current.adjustedFee.toString()).toBe('0.003')
    })
})
