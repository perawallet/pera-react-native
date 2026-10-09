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
 * balances, amounts, fees, prices, total supply, etc. Never for an identifier:
 * decimal.js reads `0x…` as hex, so asset ids use a plain `text` column.
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

const DECIMAL_TAG = '$decimal'

const isTaggedDecimal = (value: unknown): value is { [DECIMAL_TAG]: string } =>
    typeof value === 'object' &&
    value !== null &&
    Object.keys(value).length === 1 &&
    typeof (value as Record<string, unknown>)[DECIMAL_TAG] === 'string'

/**
 * A JSON TEXT column whose `Decimal` values, at any depth, come back as
 * `Decimal`. Each one is stored tagged as `{"$decimal": "<string>"}`, so the
 * column needs no knowledge of the shape it holds.
 */
export const decimalJsonColumn = <T>(name: string) =>
    customType<{ data: T }>({
        dataType() {
            return 'text'
        },
        fromDriver(value: unknown): T {
            return JSON.parse(String(value), (_key, parsed: unknown) =>
                isTaggedDecimal(parsed)
                    ? new Decimal(parsed[DECIMAL_TAG])
                    : parsed,
            ) as T
        },
        toDriver(value: T): string {
            // The replacer sees Decimal.toJSON's string; the holder still has
            // the Decimal itself, which is what tells the two apart.
            return JSON.stringify(
                value,
                function (this: Record<string, unknown>, key, encoded) {
                    const raw = this[key]
                    return Decimal.isDecimal(raw)
                        ? { [DECIMAL_TAG]: raw.toString() }
                        : encoded
                },
            )
        },
    })(name)

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
