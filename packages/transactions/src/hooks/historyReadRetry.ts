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

import { onlineManager } from '@tanstack/react-query'
import {
    isPeraNetworkError,
    isPeraServiceUnavailableError,
    isRequestBudgetSpentError,
    type PeraNetworkError,
    type RequestBudgetSpentError,
} from '@perawallet/wallet-core-shared'

/** Quiet re-reads a failed history page gets before the screen shows its error. */
export const HISTORY_READ_RETRY_LIMIT = 1

/** Re-reads a rate-limited page gets; the backend's upstream limit clears within seconds. */
export const HISTORY_RATE_LIMITED_RETRY_LIMIT = 3

const RATE_LIMITED_BASE_DELAY_MS = 2000

const MAX_RETRY_DELAY_MS = 30_000

// The backend also answers an upstream explorer's rate limit as 503
// `upstream_unavailable`, a code no other history service sends.
const isRateLimited = (
    error: Error,
): error is PeraNetworkError | RequestBudgetSpentError =>
    isRequestBudgetSpentError(error) ||
    (isPeraNetworkError(error) &&
        (error.status === 429 ||
            (error.status === 503 &&
                error.backendCode === 'upstream_unavailable')))

// The client's own budget refused the read and renews only after every retry
// would have been spent, so retrying only delays the error.
const outlastsRetries = (error: Error): boolean =>
    isRequestBudgetSpentError(error) &&
    error.retryAfterMs > MAX_RETRY_DELAY_MS * HISTORY_RATE_LIMITED_RETRY_LIMIT

// The app's query default is no retry, so a read that raced something not yet
// ready at launch would show the error state. A service the network doesn't
// have can never answer, and an offline read only fails again, so both fail at once.
export const shouldRetryHistoryRead = (
    failureCount: number,
    error: Error,
): boolean =>
    failureCount <
        (isRateLimited(error)
            ? HISTORY_RATE_LIMITED_RETRY_LIMIT
            : HISTORY_READ_RETRY_LIMIT) &&
    onlineManager.isOnline() &&
    !isPeraServiceUnavailableError(error) &&
    !outlastsRetries(error)

/**
 * TanStack's default delay, except a rate-limited read waits the response's
 * `Retry-After` or the local budget's renewal (capped at 30s), or else 2s,
 * 4s, then 8s, each plus up to half again at random, so reads that failed
 * together don't come back in the same second and hit the limit again.
 */
export const historyReadRetryDelay = (
    failureCount: number,
    error: Error,
): number => {
    if (!isRateLimited(error))
        return Math.min(1000 * 2 ** failureCount, MAX_RETRY_DELAY_MS)
    const base = Math.min(
        error.retryAfterMs ?? RATE_LIMITED_BASE_DELAY_MS * 2 ** failureCount,
        MAX_RETRY_DELAY_MS,
    )
    return base + Math.random() * (base / 2)
}
