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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { AppError, ErrorCategory } from '../base'
import { PeraServiceUnavailableError } from '../pera-service'

describe('PeraServiceUnavailableError', () => {
    test('turns a legacy network into its scope and is not retryable', () => {
        const error = new PeraServiceUnavailableError('betanet')

        // Not retryable: retrying cannot conjure a deployment that does not
        // exist. This is what separates it from a PeraNetworkError outage,
        // and what stops React Query burning retries on it.
        expect(error.metadata.retryable).toBe(false)
        expect(error.metadata.category).toBe(ErrorCategory.NETWORK)
        expect(error.scope).toStrictEqual({
            chainId: 'algorand',
            networkId: 'betanet',
        })
        expect(error.service).toBeUndefined()
        expect(error.message).toBe(
            'Pera services are not deployed for algorand/betanet',
        )
        expect(error.metadata.params).toStrictEqual({
            scope: 'algorand/betanet',
            service: undefined,
        })
        expect(error).toBeInstanceOf(AppError)
    })

    test('carries the scope and the service it lacks', () => {
        const scope = {
            chainId: 'fixture' as unknown as ChainId,
            networkId: 'mainnet',
        }

        const error = new PeraServiceUnavailableError(scope, 'prices')

        expect(error.scope).toBe(scope)
        expect(error.service).toBe('prices')
        expect(error.message).toBe(
            'Pera services are not deployed for fixture/mainnet (service: prices)',
        )
        expect(error.metadata.params).toStrictEqual({
            scope: 'fixture/mainnet',
            service: 'prices',
        })
    })

    test('declares user-facing copy that does not interpolate the scope', () => {
        const error = new PeraServiceUnavailableError('betanet', 'assets')

        expect(error.metadata.messageKey).toBe(
            'errors.pera_service.unavailable',
        )
        // The scope and service ride along as log context; the copy says
        // "this network".
        expect(error.metadata.params).toStrictEqual({
            scope: 'algorand/betanet',
            service: 'assets',
        })
    })
})
