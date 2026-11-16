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

import { Decimal } from 'decimal.js'

// An estimate past 6 dp is noise, and the long figure runs into the fiat beside it.
const MAX_DECIMALS = 6
const DUST_DIGITS = 2

export const estimateOf = (amount: Decimal): Decimal => {
    if (amount.decimalPlaces() <= MAX_DECIMALS) return amount
    const rounded = amount.toDecimalPlaces(MAX_DECIMALS, Decimal.ROUND_DOWN)
    return rounded.isZero() ? amount.toSignificantDigits(DUST_DIGITS) : rounded
}
