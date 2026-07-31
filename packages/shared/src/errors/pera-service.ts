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

import { type Network } from '../models/base-types'
import { AppError, ErrorCategory, ErrorSeverity } from './base'

/**
 * Thrown when a request targets a Pera backend service on a network that has
 * no Pera deployment (betanet, custom).
 *
 * Deliberately NOT retryable: unlike a `PeraNetworkError` outage, retrying can
 * never succeed, so React Query must fail fast rather than burn its budget.
 *
 * Raised by `createFetchClient` before ky is invoked at all, which is the
 * single place Pera requests are dispatched — so no socket is opened and no
 * consumer needs its own guard. Deliberately NOT raised from a ky
 * `beforeRequest` hook: ky builds the `Request` in its constructor, before
 * hooks run, so a spec-compliant `Request` would reject the prefix-less
 * relative URL with a bare `TypeError` first.
 */
export class PeraServiceUnavailableError extends AppError {
    public readonly network: Network

    constructor(network: Network) {
        super(`Pera services are not deployed for ${network}`, {
            severity: ErrorSeverity.LOW,
            category: ErrorCategory.NETWORK,
            retryable: false,
            recoverable: false,
        })
        this.network = network
    }
}

/**
 * Type guard for {@link PeraServiceUnavailableError}.
 *
 * Deliberately NOT folded into `isTransientNetworkError`: a missing
 * deployment is permanent, not transient, and widening that predicate would
 * also tell React Query's retry logic the wrong thing. This is a separate,
 * sibling test — used at the crash-reporting sites (see the query/mutation
 * caches in `QueryProvider`) to skip reporting an expected condition as a
 * non-fatal.
 */
export const isPeraServiceUnavailableError = (
    error: unknown,
): error is PeraServiceUnavailableError =>
    error instanceof PeraServiceUnavailableError
