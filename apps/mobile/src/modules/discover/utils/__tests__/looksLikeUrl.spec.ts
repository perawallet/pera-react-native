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
import { looksLikeUrl } from '../looksLikeUrl'

describe('looksLikeUrl', () => {
    it.each(['uni', 'uniswap', 'hello world', 'javascript:alert(1)', ''])(
        'is false for %j',
        query => {
            expect(looksLikeUrl(query)).toBe(false)
        },
    )

    it.each([
        'uniswap.org',
        'app.uniswap.org/x',
        'https://app.uniswap.org/x',
        'http://evil.com',
        'HTTPS://Uniswap.org',
        '  uniswap.org  ',
        'uniswap.org:8080/x',
        'uniswap.org?q=1',
    ])('is true for %j', query => {
        expect(looksLikeUrl(query)).toBe(true)
    })

    it('is false for a query with whitespace inside', () => {
        expect(looksLikeUrl('uniswap.org swap')).toBe(false)
        expect(looksLikeUrl('https://a.io/ x')).toBe(false)
    })
})
