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

import { describe, expect, it } from 'vitest'
import { PeraNetworkError } from '@perawallet/wallet-core-shared'
import { isSwapQuoteGoneError } from '../routerErrors'

const refusal = (backendCode?: string) =>
    new PeraNetworkError('client', { status: 409, backendCode })

describe('isSwapQuoteGoneError', () => {
    it('matches a spent or unknown quote', () => {
        expect(isSwapQuoteGoneError(refusal('quote_already_used'))).toBe(true)
        expect(isSwapQuoteGoneError(refusal('quote_not_found'))).toBe(true)
    })

    it('ignores other refusals and plain errors', () => {
        expect(isSwapQuoteGoneError(refusal('invalid_request'))).toBe(false)
        expect(isSwapQuoteGoneError(refusal())).toBe(false)
        expect(isSwapQuoteGoneError(new Error('quote_not_found'))).toBe(false)
    })
})
