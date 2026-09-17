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
import {
    hasPendingRampOrder,
    isAlgoRampToken,
    rampTokenAssetId,
} from '../utils'

import type { OnrampStatus, RampHistoryItem, RampToken } from '../models'

const item = (status: OnrampStatus): RampHistoryItem =>
    ({ id: `order-${status}`, status }) as RampHistoryItem

describe('hasPendingRampOrder', () => {
    it('is true when any order is pending', () => {
        expect(hasPendingRampOrder([item('completed'), item('pending')])).toBe(
            true,
        )
    })

    it('is false when no order is pending', () => {
        expect(
            hasPendingRampOrder([
                item('in_progress'),
                item('completed'),
                item('failed'),
                item('cancelled'),
            ]),
        ).toBe(false)
    })

    it('is false for an empty history', () => {
        expect(hasPendingRampOrder([])).toBe(false)
    })
})

const token = (overrides: Partial<RampToken>): RampToken =>
    ({
        id: '31566704',
        symbol: 'USDC',
        name: 'USDC',
        ...overrides,
    }) as RampToken

describe('isAlgoRampToken', () => {
    it('recognises ALGO by its asset id', () => {
        expect(isAlgoRampToken(token({ id: '0', symbol: 'XALGO' }))).toBe(true)
    })

    it('falls back to the ticker when the provider gives no asset id', () => {
        expect(isAlgoRampToken(token({ id: 'ALGO', symbol: 'ALGO' }))).toBe(
            true,
        )
    })

    it('does not treat another asset as ALGO', () => {
        expect(isAlgoRampToken(token({}))).toBe(false)
    })

    it('ignores an ALGO ticker on a token that has another asset id', () => {
        expect(isAlgoRampToken(token({ symbol: 'ALGO' }))).toBe(false)
    })
})

describe('rampTokenAssetId', () => {
    it("pins ALGO to the native asset id whatever the provider's id is", () => {
        expect(rampTokenAssetId(token({ id: 'ALGO', symbol: 'ALGO' }))).toBe(
            '0',
        )
    })

    it('keeps the provider id for any other token', () => {
        expect(rampTokenAssetId(token({}))).toBe('31566704')
    })
})
