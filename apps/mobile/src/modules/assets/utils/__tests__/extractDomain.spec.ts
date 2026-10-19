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

// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { extractDomain } from '../extractDomain'

describe('extractDomain', () => {
    it('returns the hostname without www.', () => {
        expect(extractDomain('https://www.example.com/path?q=1')).toBe(
            'example.com',
        )
    })

    it('keeps a subdomain other than www', () => {
        expect(extractDomain('https://etherscan.io/token/0xabc')).toBe(
            'etherscan.io',
        )
    })

    it('returns the input when it is not a URL', () => {
        expect(extractDomain('not a url')).toBe('not a url')
    })
})
