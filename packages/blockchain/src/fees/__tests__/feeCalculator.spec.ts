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

import { describe, it, expect } from 'vitest'
import { calculateMinTxnFee, calculatePQFeeSurcharge } from '../feeCalculator'

describe('calculateMinTxnFee', () => {
    it('multiplies the base fee by the PQ multiplier for PQ signers', () => {
        const result = calculateMinTxnFee({
            baseMinFee: 1000n,
            isPQSigner: true,
            pqMultiplier: 3n,
        })

        expect(result).toBe(3000n)
    })

    it('returns the base fee unchanged for non-PQ signers', () => {
        const result = calculateMinTxnFee({
            baseMinFee: 1000n,
            isPQSigner: false,
            pqMultiplier: 3n,
        })

        expect(result).toBe(1000n)
    })

    it('returns the base fee for PQ signers when the multiplier is 1', () => {
        const result = calculateMinTxnFee({
            baseMinFee: 1000n,
            isPQSigner: true,
            pqMultiplier: 1n,
        })

        expect(result).toBe(1000n)
    })

    it('falls back to the base fee when the multiplier is zero', () => {
        const result = calculateMinTxnFee({
            baseMinFee: 1000n,
            isPQSigner: true,
            pqMultiplier: 0n,
        })

        expect(result).toBe(1000n)
    })

    it('falls back to the base fee when the multiplier is negative', () => {
        const result = calculateMinTxnFee({
            baseMinFee: 1000n,
            isPQSigner: true,
            pqMultiplier: -2n,
        })

        expect(result).toBe(1000n)
    })
})

describe('calculatePQFeeSurcharge', () => {
    it('is the premium a PQ signature adds on top of the base fee', () => {
        // Mirrors go-algorand's PQSchemeFeeContribution(Falcon1024) = 2e6,
        // i.e. two extra basic fees, at the default multiplier of 3.
        const result = calculatePQFeeSurcharge({
            baseMinFee: 1000n,
            pqMultiplier: 3n,
        })

        expect(result).toBe(2000n)
    })

    it('scales with the configured multiplier', () => {
        const result = calculatePQFeeSurcharge({
            baseMinFee: 1000n,
            pqMultiplier: 4n,
        })

        expect(result).toBe(3000n)
    })

    it('follows the base fee under congestion pricing', () => {
        const result = calculatePQFeeSurcharge({
            baseMinFee: 2000n,
            pqMultiplier: 3n,
        })

        expect(result).toBe(4000n)
    })

    it('is zero when the multiplier leaves no premium', () => {
        const result = calculatePQFeeSurcharge({
            baseMinFee: 1000n,
            pqMultiplier: 1n,
        })

        expect(result).toBe(0n)
    })

    it('is zero for an invalid multiplier', () => {
        const result = calculatePQFeeSurcharge({
            baseMinFee: 1000n,
            pqMultiplier: 0n,
        })

        expect(result).toBe(0n)
    })
})
