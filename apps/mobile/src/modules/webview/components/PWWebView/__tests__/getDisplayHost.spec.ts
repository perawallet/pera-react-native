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

import { describe, it, expect } from 'vitest'
import { getDisplayHost } from '../getDisplayHost'

describe('getDisplayHost', () => {
    it('returns the hostname of a well-formed https url', () => {
        expect(
            getDisplayHost('https://perawallet.github.io/pera-demo-dapp/'),
        ).toBe('perawallet.github.io')
    })

    it('resolves a scheme-less host by retrying with https', () => {
        expect(getDisplayHost('perawallet.github.io/pera-demo-dapp/')).toBe(
            'perawallet.github.io',
        )
    })

    it('parses a scheme regardless of case (auto-capitalized input)', () => {
        expect(getDisplayHost('Https://perawallet.github.io')).toBe(
            'perawallet.github.io',
        )
    })

    it('does not throw on an unparseable url and falls back to the raw value', () => {
        expect(getDisplayHost('not a url')).toBe('not a url')
    })

    it('does not throw on an empty string', () => {
        expect(getDisplayHost('')).toBe('')
    })
})
