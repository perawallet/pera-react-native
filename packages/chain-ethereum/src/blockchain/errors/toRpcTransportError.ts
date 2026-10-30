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

import {
    BaseError,
    HttpRequestError,
    LimitExceededRpcError,
    TimeoutError,
} from 'viem'
import { PeraNetworkError } from '@perawallet/wallet-core-shared'

/**
 * A node that didn't answer, as the typed network error that
 * `isTransientNetworkError` counts as transient: the app's query cache logs no
 * error-level line for it, and a query that opts in retries it. Undefined for
 * anything else, which the caller rethrows as it is; a 4xx from the node is our
 * request or configuration, not the network.
 */
export const toRpcTransportError = (
    error: unknown,
): PeraNetworkError | undefined => {
    if (!(error instanceof BaseError)) return undefined
    if (error.walk(cause => cause instanceof TimeoutError) !== null) {
        return new PeraNetworkError('timeout', { originalError: error })
    }
    if (error.walk(cause => cause instanceof LimitExceededRpcError) !== null) {
        return new PeraNetworkError('server', {
            status: 429,
            originalError: error,
        })
    }
    const http = error.walk(cause => cause instanceof HttpRequestError)
    if (!(http instanceof HttpRequestError)) return undefined
    if (http.status === undefined) {
        return new PeraNetworkError('offline', { originalError: error })
    }
    return http.status === 429 || http.status >= 500
        ? new PeraNetworkError('server', {
              status: http.status,
              originalError: error,
          })
        : undefined
}
