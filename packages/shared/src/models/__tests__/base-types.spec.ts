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

import { describe, test, expect } from 'vitest'
import { type HistoryPeriod } from '../base-types'

describe('HistoryPeriod type', () => {
    test('accepts one-year value', () => {
        const period: HistoryPeriod = 'one-year'
        expect(period).toBe('one-year')
    })

    test('accepts one-month value', () => {
        const period: HistoryPeriod = 'one-month'
        expect(period).toBe('one-month')
    })

    test('accepts one-week value', () => {
        const period: HistoryPeriod = 'one-week'
        expect(period).toBe('one-week')
    })

    test('accepts one-day value', () => {
        const period: HistoryPeriod = 'one-day'
        expect(period).toBe('one-day')
    })

    test('all history periods are valid', () => {
        const periods: HistoryPeriod[] = [
            'one-year',
            'one-month',
            'one-week',
            'one-day',
        ]

        periods.forEach(period => {
            expect(typeof period).toBe('string')
            expect(period).toMatch(/^one-(year|month|week|day)$/)
        })
    })
})
