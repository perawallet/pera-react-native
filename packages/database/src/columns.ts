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

import { customType } from 'drizzle-orm/sqlite-core'

/**
 * A high-precision numeric column stored as TEXT in SQLite.
 *
 * Supports up to 20 integer digits and 20 decimal digits (40 significant digits).
 * Use for asset IDs, balances, amounts, prices, fees, and any numeric value
 * that exceeds the precision of SQLite's REAL (~15 digits) or INTEGER (no decimals).
 *
 * Stored as a string representation to preserve full precision.
 */
export const bigNumeric = customType<{ data: string }>({
    dataType() {
        return 'text'
    },
})
