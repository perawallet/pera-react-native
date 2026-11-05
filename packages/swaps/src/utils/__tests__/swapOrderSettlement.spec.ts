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

import { describe, expect, test } from 'vitest'
import {
    isSwapOrderSettled,
    SWAP_ORDER_TRACKING_LIMIT_MS,
    SWAP_STATUS_REVERSIBLE_MS,
} from '../swapOrderSettlement'

const CREATED_AT = 1_700_000_000_000

describe('isSwapOrderSettled', () => {
    test.each(['completed', 'failed', 'refunded'] as const)(
        'treats %s as final at once',
        status => {
            expect(
                isSwapOrderSettled(
                    { status, createdAt: CREATED_AT },
                    CREATED_AT,
                ),
            ).toBe(true)
        },
    )

    test.each(['pending', 'in_progress'] as const)(
        'keeps %s open until the tracking limit',
        status => {
            const order = { status, createdAt: CREATED_AT }

            expect(
                isSwapOrderSettled(
                    order,
                    CREATED_AT + SWAP_ORDER_TRACKING_LIMIT_MS - 1,
                ),
            ).toBe(false)
            expect(
                isSwapOrderSettled(
                    order,
                    CREATED_AT + SWAP_ORDER_TRACKING_LIMIT_MS,
                ),
            ).toBe(true)
        },
    )

    test.each(['expired', 'cancelled'] as const)(
        'keeps %s open until the reversible window ends',
        status => {
            const order = { status, createdAt: CREATED_AT }

            expect(
                isSwapOrderSettled(
                    order,
                    CREATED_AT + SWAP_STATUS_REVERSIBLE_MS - 1,
                ),
            ).toBe(false)
            expect(
                isSwapOrderSettled(
                    order,
                    CREATED_AT + SWAP_STATUS_REVERSIBLE_MS,
                ),
            ).toBe(true)
        },
    )

    test('spans seven days', () => {
        expect(SWAP_STATUS_REVERSIBLE_MS).toBe(7 * 24 * 60 * 60 * 1000)
    })
})
