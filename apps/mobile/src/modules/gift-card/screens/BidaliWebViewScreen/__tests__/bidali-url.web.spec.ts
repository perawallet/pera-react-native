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
import { buildBidaliUrl } from '../bidali-url.web'

describe('buildBidaliUrl (web)', () => {
    it('appends the API key and URL-encoded balances', () => {
        const balances = { algorand: '12.5', usdcalgorand: '3' }

        const url = buildBidaliUrl({
            baseUrl: 'https://commerce.bidali.com/dapp',
            apiKey: 'test-key',
            balances,
        })

        expect(url).toBe(
            `https://commerce.bidali.com/dapp?key=test-key&peraBidaliBalances=${encodeURIComponent(
                JSON.stringify(balances),
            )}`,
        )
    })

    it('stamps an empty object when balances is omitted', () => {
        const url = buildBidaliUrl({
            baseUrl: 'https://commerce.bidali.com/dapp',
            apiKey: 'test-key',
        })

        expect(url).toBe(
            'https://commerce.bidali.com/dapp?key=test-key&peraBidaliBalances=%7B%7D',
        )
    })

    // The content script (bidali-main.ts) parses this param back out with
    // `new URLSearchParams(window.location.search)`, which decodes `+` as a
    // space. encodeURIComponent never emits a bare `+` (it escapes it to
    // %2B), so the two are always compatible — prove it end to end instead
    // of asserting that fact in prose.
    it('round-trips through URLSearchParams the way the content script parses it', () => {
        const balances = {
            algorand: '12.5',
            usdcalgorand: '3',
            note: 'a+b c&d=e',
        }

        const url = buildBidaliUrl({
            baseUrl: 'https://commerce.bidali.com/dapp',
            apiKey: 'test-key',
            balances,
        })

        const [, query] = url.split('?')
        const parsed = new URLSearchParams(query)
        const raw = parsed.get('peraBidaliBalances')

        expect(raw).not.toBeNull()
        expect(JSON.parse(raw as string)).toEqual(balances)
    })
})
