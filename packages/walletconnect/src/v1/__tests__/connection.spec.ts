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
import { bridgeUrlFromV1Uri } from '../connection'

describe('bridgeUrlFromV1Uri', () => {
    it('reads the bridge the SDK dials', () => {
        expect(
            bridgeUrlFromV1Uri('wc:t@1?bridge=https%3A%2F%2Fb.example&key=k'),
        ).toBe('https://b.example')
    })

    it('decodes a double-encoded value twice, as the SDK does', () => {
        expect(
            bridgeUrlFromV1Uri(
                'wc:t@1?bridge=https%253A%252F%252Fb.example&key=k',
            ),
        ).toBe('https://b.example')
    })

    it.each([
        [
            'a percent-encoded duplicate key',
            'wc:t@1?bridge=https%3A%2F%2Fb.example&br%69dge=http%3A%2F%2Fevil.example&key=k',
        ],
        ['an empty value', 'wc:t@1?bridge=&key=k'],
        ['no query', 'wc:t@1'],
        ['a malformed escape', 'wc:t@1?bridge=https%3A%2F%2Fb.example%&key=k'],
    ])('returns null for %s', (_label, uri) => {
        expect(bridgeUrlFromV1Uri(uri)).toBeNull()
    })
})
