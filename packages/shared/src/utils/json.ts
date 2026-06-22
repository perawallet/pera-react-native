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

/**
 * Cheap pre-check: only payloads containing a run of 16+ digits can hold an
 * integer literal outside the IEEE-754 safe range (2^53 - 1 has 16 digits).
 * Digit runs inside strings can false-positive — that just takes the (still
 * fast) scanning path; false negatives are impossible for integer literals.
 */
const RISKY_DIGIT_RUN = /\d{16,}/

const isDigit = (c: string): boolean => c >= '0' && c <= '9'

/**
 * Rewrites integer literals that cannot be represented exactly as an
 * IEEE-754 double into quoted strings, so `JSON.parse` surfaces them intact
 * instead of silently rounding. String literals are copied verbatim
 * (escape-aware), so digits inside strings are never touched. Fraction /
 * exponent forms are left alone — they parse to doubles today and rounding
 * them is inherent to the format.
 */
const quoteUnsafeIntegerLiterals = (text: string): string => {
    let out = ''
    let i = 0
    const n = text.length
    while (i < n) {
        const c = text[i]
        if (c === '"') {
            // Copy the whole string literal, honouring escapes.
            out += c
            i++
            while (i < n) {
                const s = text[i]
                out += s
                i++
                if (s === '\\') {
                    if (i < n) {
                        out += text[i]
                        i++
                    }
                    continue
                }
                if (s === '"') break
            }
            continue
        }
        if (c === '-' || isDigit(c)) {
            // Consume the whole number token (sign, integer, fraction,
            // exponent) as one unit. Scanning the parts separately would let
            // a long fractional run (e.g. 0.12345678901234567) be re-read as a
            // standalone integer and quoted, yielding invalid JSON.
            let j = i
            if (text[j] === '-') j++
            let intDigits = 0
            while (j < n && isDigit(text[j])) {
                j++
                intDigits++
            }
            let isIntegerLiteral = true
            if (text[j] === '.') {
                isIntegerLiteral = false
                j++
                while (j < n && isDigit(text[j])) j++
            }
            if (text[j] === 'e' || text[j] === 'E') {
                isIntegerLiteral = false
                j++
                if (text[j] === '+' || text[j] === '-') j++
                while (j < n && isDigit(text[j])) j++
            }
            const literal = text.slice(i, j)
            if (
                isIntegerLiteral &&
                intDigits >= 16 &&
                !Number.isSafeInteger(Number(literal))
            ) {
                out += `"${literal}"`
            } else {
                out += literal
            }
            i = j
            continue
        }
        out += c
        i++
    }
    return out
}

/**
 * `JSON.parse` that never silently rounds large integers. Integer literals
 * outside the safe-integer range (|n| > 2^53 - 1) are surfaced as decimal
 * *strings* instead — consumers that expect uint64 ids (asset ids, app ids)
 * must accept the string form (see `uint64IdSchema`); consumers that
 * declared such a field as a plain number fail validation loudly instead of
 * proceeding with a corrupted value.
 *
 * Payloads without any 16+ digit run (the overwhelmingly common case) go
 * straight through native `JSON.parse`.
 */
export const parsePrecisionSafeJson = (text: string): unknown => {
    if (!RISKY_DIGIT_RUN.test(text)) return JSON.parse(text)
    return JSON.parse(quoteUnsafeIntegerLiterals(text))
}

/**
 * Converts a uint64 id (e.g. an Algorand asset id) into a JS number for
 * request payloads whose wire format requires a JSON number. Throws instead
 * of silently rounding when the id cannot be represented exactly
 * (> 2^53 - 1) — sending a rounded id would target a *different* asset.
 */
export const uint64IdToNumber = (id: string | number): number => {
    // Number('') and Number('  ') are 0 — reject blank input explicitly.
    if (typeof id === 'string' && id.trim() === '') {
        throw new RangeError('Cannot convert empty string to a uint64 id')
    }
    const value = typeof id === 'number' ? id : Number(id)
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new RangeError(
            `Cannot represent uint64 id "${id}" exactly as a JS number`,
        )
    }
    return value
}
