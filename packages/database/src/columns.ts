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
import { sql, type SQL } from 'drizzle-orm'
import { type SQLiteColumn, customType } from 'drizzle-orm/sqlite-core'

/**
 * A high-precision numeric column stored as TEXT in SQLite that maps to `Decimal` in TypeScript.
 *
 * Use for all numeric values that require precision beyond JS `number`:
 * balances, amounts, fees, prices, asset IDs, total supply, etc.
 *
 * TEXT storage preserves full precision — SQLite's NUMERIC/REAL types and JS
 * drivers lose precision for values exceeding Number.MAX_SAFE_INTEGER (~9e15).
 *
 * For SQL-level aggregation, use the `decimalSum` / `decimalMax` / `decimalMin`
 * helpers which handle the CAST and type mapping automatically.
 */
export const decimalColumn = customType<{ data: Decimal }>({
    dataType() {
        return 'text'
    },
    fromDriver(value: unknown): Decimal {
        return new Decimal(String(value))
    },
    toDriver(value: Decimal): string {
        return value.toString()
    },
})

/**
 * Precision-safe SUM aggregate for `decimalColumn` fields.
 *
 * Casts the result to TEXT before it reaches the JS driver, then routes
 * through the column's Decimal decoder.
 *
 * ```ts
 * db.select({ total: decimalSum(schema.amount) }).from(schema)
 * ```
 */
export const decimalSum = (column: SQLiteColumn) =>
    sql<string>`CAST(SUM(${column}) AS TEXT)`.mapWith(column) as SQL<Decimal>

/**
 * Precision-safe MAX aggregate for `decimalColumn` fields.
 */
export const decimalMax = (column: SQLiteColumn) =>
    sql<string>`CAST(MAX(${column}) AS TEXT)`.mapWith(column) as SQL<Decimal>

/**
 * Precision-safe MIN aggregate for `decimalColumn` fields.
 */
export const decimalMin = (column: SQLiteColumn) =>
    sql<string>`CAST(MIN(${column}) AS TEXT)`.mapWith(column) as SQL<Decimal>
