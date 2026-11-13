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

import { dappHostOf, normalizeDappUrl } from '../normalizeDappUrl'

describe('normalizeDappUrl', () => {
    test.each([
        ['HTTPS://App.Uniswap.org/', 'https://app.uniswap.org'],
        ['uniswap.org/swap/#x', 'https://uniswap.org/swap'],
        ['https://a.io/p/?q=1', 'https://a.io/p?q=1'],
    ])('normalises %s', (input, expected) => {
        expect(normalizeDappUrl(input)).toBe(expected)
    })

    test.each(['http://evil.com', 'javascript:alert(1)', ''])(
        'rejects %j',
        input => {
            expect(normalizeDappUrl(input)).toBeNull()
        },
    )
})

describe('dappHostOf', () => {
    test.each([
        ['https://App.io/x', 'app.io'],
        ['HTTPS://App.io/x', 'app.io'],
        ['app.io', 'app.io'],
    ])('host of %s', (input, expected) => {
        expect(dappHostOf(input)).toBe(expected)
    })
})
