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

import { Decimal } from 'decimal.js'

/**
 * Initializes the global Decimal.js configuration for the app.
 *
 * Must be called once at app startup, before any Decimal operations.
 *
 * - precision: 18 — covers Algorand's max 19 decimal places for ASAs
 *   and provides sufficient precision for all financial calculations.
 * - rounding: ROUND_HALF_UP — standard financial rounding.
 * - crypto: true — uses crypto.getRandomValues() for randomness.
 */
export const initDecimalConfig = () => {
    Decimal.set({
        precision: 18,
        crypto: true,
        rounding: Decimal.ROUND_HALF_UP,
    })
}

// Apply config immediately on import as a safety net
initDecimalConfig()

export { Decimal }
