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

import { AppError, ErrorCategory, ErrorSeverity } from './base'

/**
 * A request refused before it was sent because the client's own budget for a
 * backend rate limit is spent. Nothing reached the backend, so it is not a
 * `PeraNetworkError`; retry callers treat it as rate limited.
 */
export class RequestBudgetSpentError extends AppError {
    public readonly budget: string
    /** Milliseconds until the budget renews. */
    public readonly retryAfterMs: number

    constructor(budget: string, retryAfterMs: number) {
        super(
            `Request budget "${budget}" spent; renews in ${retryAfterMs} ms`,
            {
                severity: ErrorSeverity.LOW,
                category: ErrorCategory.NETWORK,
                retryable: true,
                recoverable: true,
                expected: true,
                params: { budget, retryAfterMs },
            },
        )
        this.budget = budget
        this.retryAfterMs = retryAfterMs
    }
}

export const isRequestBudgetSpentError = (
    error: unknown,
): error is RequestBudgetSpentError => error instanceof RequestBudgetSpentError
