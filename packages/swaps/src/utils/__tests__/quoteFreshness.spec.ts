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
import { isQuoteFresh, SWAP_QUOTE_TTL_MS } from '../quoteFreshness'

import type { SwapQuote } from '../../models'

const quote = (fetchedAt?: number): SwapQuote => ({ fetchedAt }) as SwapQuote

describe('isQuoteFresh', () => {
    it('accepts a quote younger than the TTL', () => {
        expect(isQuoteFresh(quote(10_000), 10_000 + SWAP_QUOTE_TTL_MS)).toBe(
            true,
        )
    })

    it('rejects a quote older than the TTL', () => {
        expect(
            isQuoteFresh(quote(10_000), 10_000 + SWAP_QUOTE_TTL_MS + 1),
        ).toBe(false)
    })

    it('rejects a quote that was never stamped', () => {
        // A quote without fetchedAt predates the freshness contract — treat
        // it as stale so it can never slip past the confirm-time guard.
        expect(isQuoteFresh(quote(undefined), 10_000)).toBe(false)
    })
})
