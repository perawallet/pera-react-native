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

import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { SwapQuoteFailure } from '@perawallet/wallet-core-swaps'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useSwapMinimum } from '../useSwapMinimum'

const TOO_LOW: SwapQuoteFailure = {
    kind: 'amount-too-low',
    minimum: new Decimal(9_000_000),
}

const render = ({
    pairMinimum = new Decimal(9_000_000),
    quoteFailure = TOO_LOW,
    spendableMax = new Decimal(20_000_000),
    onFillMinimum = vi.fn(),
}: {
    pairMinimum?: Nullable<Decimal>
    quoteFailure?: Nullable<SwapQuoteFailure>
    spendableMax?: Nullable<Decimal>
    onFillMinimum?: (amount: Decimal) => void
} = {}) =>
    renderHook(() =>
        useSwapMinimum({
            pairMinimum,
            quoteFailure,
            spendableMax,
            payDecimals: 6,
            onFillMinimum,
        }),
    ).result.current

describe('useSwapMinimum', () => {
    describe('liftToMinimum', () => {
        it('leaves a fill with no known minimum alone', () => {
            const { liftToMinimum } = render({ pairMinimum: null })

            expect(liftToMinimum(new Decimal(1))).toEqual(new Decimal(1))
        })

        it('leaves a fill at or over the minimum alone', () => {
            const { liftToMinimum } = render()

            expect(liftToMinimum(new Decimal(12_000_000))).toEqual(
                new Decimal(12_000_000),
            )
        })

        it('lifts a fill under the minimum the account can afford', () => {
            const { liftToMinimum } = render()

            expect(liftToMinimum(new Decimal(5_000_000))).toEqual(
                new Decimal(9_000_000),
            )
        })

        it('leaves the fill for the router when the balance cannot reach the minimum', () => {
            const { liftToMinimum } = render({
                spendableMax: new Decimal(5_000_000),
            })

            expect(liftToMinimum(new Decimal(5_000_000))).toEqual(
                new Decimal(5_000_000),
            )
        })
    })

    describe('canUseMinimum', () => {
        it('is offered for a too-low refusal the account can afford', () => {
            expect(render().canUseMinimum).toBe(true)
        })

        it('is offered while the spendable amount is still unknown', () => {
            expect(render({ spendableMax: null }).canUseMinimum).toBe(true)
        })

        it('is not offered above what the account can spend', () => {
            expect(render({ spendableMax: new Decimal(1) }).canUseMinimum).toBe(
                false,
            )
        })

        it('is not offered when the refusal names no minimum, even with one stored', () => {
            expect(
                render({
                    quoteFailure: { kind: 'amount-too-low', minimum: null },
                }).canUseMinimum,
            ).toBe(false)
        })

        it('is not offered for any other failure', () => {
            expect(
                render({ quoteFailure: { kind: 'no-route' } }).canUseMinimum,
            ).toBe(false)
        })
    })

    describe('isMinimumAboveSpendable', () => {
        it('flags a refused minimum above what the account can spend after fees', () => {
            expect(
                render({ spendableMax: new Decimal(8_999_999) })
                    .isMinimumAboveSpendable,
            ).toBe(true)
        })

        it('is clear when the account can spend the minimum', () => {
            expect(render().isMinimumAboveSpendable).toBe(false)
        })

        it('is clear while the spendable amount is still unknown', () => {
            expect(render({ spendableMax: null }).isMinimumAboveSpendable).toBe(
                false,
            )
        })
    })

    it('fills the minimum in display units', () => {
        const onFillMinimum = vi.fn()

        render({ onFillMinimum }).handleUseMinimum()

        expect(onFillMinimum).toHaveBeenCalledWith(new Decimal(9))
    })
})
