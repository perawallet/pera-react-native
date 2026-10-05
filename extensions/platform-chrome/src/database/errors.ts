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

// The worker keeps running the statement after this is thrown: a timeout only
// means the caller stopped waiting.
export class SqlStatementTimeoutError extends Error {
    constructor(timeoutMs: number) {
        super(`db worker request timed out after ${timeoutMs}ms`)
        this.name = 'SqlStatementTimeoutError'
    }
}

// Drizzle wraps a failed query in its own error and keeps the driver's as the
// cause, so the timeout can sit anywhere along the chain.
export const isSqlStatementTimeout = (error: unknown): boolean => {
    let current: unknown = error
    while (current instanceof Error) {
        if (current instanceof SqlStatementTimeoutError) return true
        current = current.cause
    }
    return false
}
