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

import { isSensitiveKey, redactMaybeString } from './redaction'

// Structurally mirrored by `LogSeverity` in
// `extensions/platform/src/reporting/utils.ts`, which routes 'expected' to a
// breadcrumb. The two unions are unrelated at compile time because the platform
// extension deliberately does not depend on this package, so the literals have
// to be kept in step by hand.
export type LogErrorSeverity = 'error' | 'critical' | 'expected'

export type ErrorReportPayload = {
    severity: LogErrorSeverity
    error: unknown
    /**
     * Stable name for the logical error site, set only when `error`'s stack was
     * captured inside the logger and so cannot identify the caller. Reporters
     * that fingerprint on the stack need it to tell two sites apart; see
     * `reportError`.
     */
    groupingKey?: string
}

export type ErrorReporter = (payload: ErrorReportPayload) => void

// A native module can make `message`/`stack` a throwing accessor. A field the
// logger cannot read is one the reporter cannot read either, so drop the field
// rather than the report. `ok` keeps a failed read distinguishable from a
// genuine `undefined` — conflating them would let a hostile accessor reach the
// reporter untouched.
type SafeRead = { ok: boolean; value: unknown }

export const readSafely = (read: () => unknown): SafeRead => {
    try {
        return { ok: true, value: read() }
    } catch {
        return { ok: false, value: undefined }
    }
}

// Crashlytics sends `message` and `stack` to native verbatim, so an Error
// reported as-is is a second, unredacted copy of anything the serialized
// context already scrubbed. Returning the original when nothing matched is only
// an optimisation: the clone keeps the prototype and non-sensitive own
// properties, so a reporter that branches on `instanceof` or reads `.code`
// cannot tell a redacted error from an untouched one.
export const redactErrorForReport = (error: Error): Error => {
    const rawMessage = readSafely(() => error.message)
    const rawStack = readSafely(() => error.stack)
    const message = redactMaybeString(rawMessage.value)
    const stack = redactMaybeString(rawStack.value)
    // A read that threw must not take the fast path: returning the original
    // would hand the reporter a live hostile accessor, and a reporter that
    // reads `.stack` then throws and loses the report. The clone below
    // materialises plain values, so it neutralises the accessor.
    if (
        rawMessage.ok &&
        rawStack.ok &&
        message === rawMessage.value &&
        stack === rawStack.value
    )
        return error

    const name = readSafely(() => error.name).value

    try {
        const redacted = Object.create(Object.getPrototypeOf(error)) as Error
        const target = redacted as unknown as Record<string, unknown>
        const source = error as unknown as Record<string, unknown>
        // One key at a time, not Object.assign: a single throwing native
        // accessor would abort the whole copy and cost the entire report.
        // Sensitive keys are skipped outright — a redactor must never hand a
        // raw mnemonic to the reporting boundary.
        for (const key of Object.keys(error)) {
            if (isSensitiveKey(key)) continue
            try {
                target[key] = source[key]
            } catch {
                // drop the unreadable property, not the report
            }
        }
        // Non-enumerable, like a real Error's own fields: an enumerable copy
        // would put message/stack into JSON.stringify of the reported error.
        for (const [key, value] of [
            ['name', name],
            ['message', message],
            ['stack', stack],
        ] as const) {
            Object.defineProperty(redacted, key, {
                value,
                enumerable: false,
                writable: true,
                configurable: true,
            })
        }
        return redacted
    } catch {
        const fallback = new Error(String(message))
        fallback.name = String(name)
        fallback.stack = stack as typeof fallback.stack
        return fallback
    }
}
