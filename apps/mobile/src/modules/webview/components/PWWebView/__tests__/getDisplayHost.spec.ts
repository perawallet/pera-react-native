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

    it('reports an empty string as having no host', () => {
        expect(getDisplayHost('')).toBeUndefined()
    })

    // Opaque origins parse without throwing but carry no host. Returning ''
    // rendered a blank origin line under a page-chosen title; echoing the raw
    // value would print an entire data: payload. Both are worse than "no host".
    it.each([
        'about:blank',
        'data:text/html,<h1>hi</h1>',
        'blob:https://evil.xyz/2f9a-uuid',
        'javascript:void(0)',
        'file:///etc/passwd',
    ])('reports %s as having no host', url => {
        expect(getDisplayHost(url)).toBeUndefined()
    })
})
