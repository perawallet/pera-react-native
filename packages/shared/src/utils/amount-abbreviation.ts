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

import type { Decimal } from 'decimal.js'

export type AbbreviationUnit = '' | 'M' | 'B' | 'T'

const UNITS: readonly Exclude<AbbreviationUnit, ''>[] = ['M', 'B', 'T']

/**
 * Scales an amount of a million or more down to millions (M), billions (B) or
 * trillions (T), so a figure in a row of limited width stays short. The unit is
 * a code, not display text: callers name it in the user's language. A unit is
 * left once its figure rounds, at `precision`, to 1,000, so 999,999,999.999
 * becomes 1.00 billion rather than 1,000.00 million. Smaller amounts come back
 * as they are.
 */
export const abbreviateLargeAmount = (
    amount: Decimal,
    precision: number,
): { amount: Decimal; unit: AbbreviationUnit } => {
    let result: { amount: Decimal; unit: AbbreviationUnit } = {
        amount,
        unit: '',
    }
    for (const unit of UNITS) {
        const step = result.unit === '' ? 1_000_000 : 1000
        if (result.amount.abs().toDecimalPlaces(precision).lt(step)) break
        result = { amount: result.amount.div(step), unit }
    }
    return result
}
