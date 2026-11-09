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

import { describe, it, expect } from 'vitest'
import { PeraNetworkError } from '@perawallet/wallet-core-shared'

import { resolveRouterErrorBody } from '../router-error'

describe('resolveRouterErrorBody', () => {
    it('reads the body from a PeraNetworkError wrapper', () => {
        const wrapped = new PeraNetworkError('client', {
            status: 409,
            originalError: Object.assign(new Error('http'), {
                data: { error: 'Nope', code: 'invalid_status_transition' },
            }),
        })

        expect(resolveRouterErrorBody(wrapped)?.code).toBe(
            'invalid_status_transition',
        )
    })

    it('is null for an error with no router body', () => {
        expect(resolveRouterErrorBody(new Error('boom'))).toBeNull()
    })

    it('keeps the error when the other limit is null', () => {
        const body = resolveRouterErrorBody({
            error: 'Too low',
            code: 'amount_too_low',
            source_amount_minimum: '600',
            source_amount_maximum: null,
        })

        expect(body?.source_amount_minimum).toBe('600')
        expect(body?.source_amount_maximum).toBeNull()
    })

    it('reads a malformed limit as absent rather than dropping the error', () => {
        const body = resolveRouterErrorBody({
            error: 'Too low',
            code: 'amount_too_low',
            source_amount_minimum: 'six hundred',
        })

        expect(body?.error).toBe('Too low')
        expect(body?.source_amount_minimum).toBeUndefined()
    })
})
