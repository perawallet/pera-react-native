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

import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import { apiSlippageToPercent, percentToApiSlippage } from '../slippage'

describe('percentToApiSlippage', () => {
    it('converts "1" to "0.01"', () => {
        expect(percentToApiSlippage('1')).toBe('0.01')
    })

    it('converts "0.5" to "0.005"', () => {
        expect(percentToApiSlippage('0.5')).toBe('0.005')
    })

    it('converts "2" to "0.02"', () => {
        expect(percentToApiSlippage('2')).toBe('0.02')
    })

    it('converts "5" to "0.05"', () => {
        expect(percentToApiSlippage('5')).toBe('0.05')
    })

    it('converts "0" to "0"', () => {
        expect(percentToApiSlippage('0')).toBe('0')
    })

    it('converts "0.1" to "0.001"', () => {
        expect(percentToApiSlippage('0.1')).toBe('0.001')
    })

    it('converts "100" to "1"', () => {
        expect(percentToApiSlippage('100')).toBe('1')
    })

    it('preserves precision for values like "2.5"', () => {
        expect(percentToApiSlippage('2.5')).toBe('0.025')
    })

    it('normalises trailing zeros via Decimal', () => {
        expect(percentToApiSlippage('2.50')).toBe('0.025')
    })
})

describe('apiSlippageToPercent', () => {
    it('converts 0.05 to 5', () => {
        expect(apiSlippageToPercent(new Decimal('0.05'))).toBe('5')
    })

    it('converts 0.01 to 1', () => {
        expect(apiSlippageToPercent(new Decimal('0.01'))).toBe('1')
    })

    it('converts 0.005 to 0.5', () => {
        expect(apiSlippageToPercent(new Decimal('0.005'))).toBe('0.5')
    })

    it('converts 0 to 0', () => {
        expect(apiSlippageToPercent(new Decimal('0'))).toBe('0')
    })

    it('converts 1 to 100', () => {
        expect(apiSlippageToPercent(new Decimal('1'))).toBe('100')
    })

    it('converts the API decimal-fraction response back to a percent', () => {
        expect(apiSlippageToPercent(new Decimal('0.025'))).toBe('2.5')
    })
})
