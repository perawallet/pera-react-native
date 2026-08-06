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

import { describe, test, expect } from 'vitest'
import { AppError, ErrorCategory } from '../base'
import { PeraServiceUnavailableError } from '../pera-service'

describe('PeraServiceUnavailableError', () => {
    test('names the network and is not retryable', () => {
        const error = new PeraServiceUnavailableError('betanet')

        // Not retryable: retrying cannot conjure a deployment that does not
        // exist. This is what separates it from a PeraNetworkError outage,
        // and what stops React Query burning retries on it.
        expect(error.metadata.retryable).toBe(false)
        expect(error.metadata.category).toBe(ErrorCategory.NETWORK)
        expect(error.network).toBe('betanet')
        expect(error.message).toContain('betanet')
        expect(error).toBeInstanceOf(AppError)
    })

    test('declares user-facing copy that does not interpolate the network', () => {
        const error = new PeraServiceUnavailableError('betanet')

        expect(error.metadata.messageKey).toBe(
            'errors.pera_service.unavailable',
        )
        // network rides along as log context; the copy says "this network".
        expect(error.metadata.params).toEqual({ network: 'betanet' })
    })
})
