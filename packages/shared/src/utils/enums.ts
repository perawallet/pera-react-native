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

import type { Nullable } from './types'

/**
 * Coerces an API string to a known enum member, falling back when the value
 * isn't one we model yet — so a new/unknown value never throws at the boundary.
 * Useful for external APIs whose enums may evolve. Pair with a `z.string()`
 * schema (rather than `z.enum(...)`) when you want tolerance over strictness.
 */
export const toEnumValue = <T extends Record<string, string>>(
    enumObject: T,
    value: unknown,
    fallback: T[keyof T],
): T[keyof T] => {
    const values = Object.values(enumObject) as string[]
    return typeof value === 'string' && values.includes(value)
        ? (value as T[keyof T])
        : fallback
}

/** Like {@link toEnumValue} but yields `null` for unknown/missing values. */
export const toEnumValueOrNull = <T extends Record<string, string>>(
    enumObject: T,
    value: unknown,
): Nullable<T[keyof T]> => {
    const values = Object.values(enumObject) as string[]
    return typeof value === 'string' && values.includes(value)
        ? (value as T[keyof T])
        : null
}
