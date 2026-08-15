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

/**
 * Every revision in this directory resolves `up` no matter what a per-record
 * failure does — rejecting would reject `keystore.ready` and stop the app
 * booting, and since the ledger only writes after `up` resolves, the same
 * failure would re-run and re-fail on every subsequent launch. A diagnostic
 * `console.warn` on the way to that resolution must uphold the same
 * constraint: it cannot itself throw. `console.warn` does, under React
 * Native's LogBox patch in some states, and a thrown non-`Error` value with a
 * throwing `toString`/`Symbol.toPrimitive` makes `String(error)` throw too.
 */
export const safeErrorMessage = (error: unknown): string => {
    try {
        return error instanceof Error ? error.message : String(error)
    } catch {
        return '<unstringifiable error>'
    }
}

/** Never throws: a broken logger must not escape the `up` it's logging inside of. */
export const safeWarn = (message: string): void => {
    try {
        console.warn(message)
    } catch {
        // no-op
    }
}
