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
 * Raised in `createPeraClient`'s `beforeRequest` hook, which is the single
 * place Pera requests are constructed — so no socket is opened and no
 * consumer needs its own guard.
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
