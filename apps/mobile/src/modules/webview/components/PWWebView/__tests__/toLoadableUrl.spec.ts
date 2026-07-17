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
import { toLoadableUrl } from '../toLoadableUrl'

describe('toLoadableUrl', () => {
    it('prepends https:// to a scheme-less host', () => {
        expect(toLoadableUrl('perawallet.github.io/pera-demo-dapp/')).toBe(
            'https://perawallet.github.io/pera-demo-dapp/',
        )
    })

    it('leaves an https url untouched', () => {
        expect(toLoadableUrl('https://perawallet.github.io')).toBe(
            'https://perawallet.github.io',
        )
    })

    it('leaves an http url untouched', () => {
        expect(toLoadableUrl('http://example.com')).toBe('http://example.com')
    })

    it('leaves a custom scheme untouched', () => {
        expect(toLoadableUrl('algorand-wc://connect')).toBe(
            'algorand-wc://connect',
        )
    })

    it('is case-insensitive about an existing scheme', () => {
        expect(toLoadableUrl('HTTPS://perawallet.github.io')).toBe(
            'HTTPS://perawallet.github.io',
        )
    })
})
