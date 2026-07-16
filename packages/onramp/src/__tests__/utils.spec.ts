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
import { hasPendingRampOrder } from '../utils'

import type { OnrampStatus, RampHistoryItem } from '../models'

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
