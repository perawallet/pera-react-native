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
import { getPreferredDappIcon } from '../dapp-icon'

describe('getPreferredDappIcon', () => {
    it('prefers a raster icon over an svg-first list', () => {
        expect(
            getPreferredDappIcon([
                'https://dapp.example/icon.svg',
                'https://dapp.example/icon.png',
            ]),
        ).toBe('https://dapp.example/icon.png')
    })

    it('falls back to the first icon when no raster format is present', () => {
        expect(getPreferredDappIcon(['https://dapp.example/icon.svg'])).toBe(
            'https://dapp.example/icon.svg',
        )
    })

    it('returns undefined for empty or missing lists', () => {
        expect(getPreferredDappIcon([])).toBeUndefined()
        expect(getPreferredDappIcon(undefined)).toBeUndefined()
    })
})
