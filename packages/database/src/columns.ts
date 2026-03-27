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
import { customType } from 'drizzle-orm/sqlite-core'

/**
 * A high-precision numeric column stored as TEXT in SQLite that maps to `Decimal` in TypeScript.
 *
 * Use for all numeric values that require precision beyond JS `number`:
 * balances, amounts, fees, prices, asset IDs, total supply, etc.
 *
 * TEXT storage avoids precision loss from SQLite drivers returning JS `number`.
 */
export const decimalColumn = customType<{ data: Decimal }>({
    dataType() {
        return 'text'
    },
    fromDriver(value: unknown): Decimal {
        return new Decimal(value as string)
    },
    toDriver(value: Decimal): string {
        return value.toString()
    },
})
