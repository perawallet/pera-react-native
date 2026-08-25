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

const hex = (value: Uint8Array): string =>
    [...value].map(byte => byte.toString(16).padStart(2, '0')).join('')

/**
 * Every rendering is distinguishable from every other: an absent field, a
 * present-but-empty byte string, `1000n` and `1000` must not print the same, or
 * a real mismatch surfaces as two identical-looking columns.
 */
const render = (value: unknown): string => {
    if (value === undefined || value === null) return '(unset)'
    if (value instanceof Uint8Array) {
        return value.length === 0 ? '(empty)' : hex(value)
    }
    if (typeof value === 'bigint') return `${value}n`
    return String(value)
}

const isEqual = (expected: unknown, actual: unknown): boolean => {
    if (expected instanceof Uint8Array || actual instanceof Uint8Array) {
        return (
            expected instanceof Uint8Array &&
            actual instanceof Uint8Array &&
            expected.length === actual.length &&
            expected.every((byte, index) => byte === actual[index])
        )
    }
    // Strict: 1000n and 1000 are different chain values, and a diff that hides
    // that would let a `number` amount pass for a `bigint` one.
    return Object.is(expected, actual)
}

/**
 * A two-column table of the fields that differ, and only those. `bigint` prints
 * as decimal, `Uint8Array` as lowercase hex, absent as `(unset)`. Empty string
 * when everything compared matches.
 */
export const formatFieldDiff = (
    expected: Record<string, unknown>,
    actual: Record<string, unknown>,
): string => {
    const fields = [
        ...new Set([...Object.keys(expected), ...Object.keys(actual)]),
    ].filter(field => !isEqual(expected[field], actual[field]))

    if (fields.length === 0) return ''

    const rows = fields.map(field => ({
        field,
        expected: render(expected[field]),
        actual: render(actual[field]),
    }))
    const width = (pick: (row: (typeof rows)[number]) => string): number =>
        Math.max(...rows.map(row => pick(row).length))
    const fieldWidth = Math.max(
        width(row => row.field),
        'field'.length,
    )
    const expectedWidth = Math.max(
        width(row => row.expected),
        'expected'.length,
    )

    const line = (a: string, b: string, c: string): string =>
        `${a.padEnd(fieldWidth)}  ${b.padEnd(expectedWidth)}  ${c}`

    return [
        line('field', 'expected', 'actual'),
        ...rows.map(row => line(row.field, row.expected, row.actual)),
    ].join('\n')
}
