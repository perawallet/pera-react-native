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
import type { Banner } from '@perawallet/wallet-core-banners'
import { getCompactText } from '../utils'

const banner: Banner = {
    id: '1',
    type: 'governance',
    title: null,
    subtitle: null,
    buttonLabel: null,
    buttonUrl: null,
    isButtonUrlExternal: false,
    autoOpenMode: null,
    backgroundImageUrl: null,
}

describe('getCompactText', () => {
    it.each([
        ['title wins', { title: 'T', subtitle: 'S', buttonLabel: 'B' }, 'T'],
        ['subtitle when no title', { subtitle: 'S', buttonLabel: 'B' }, 'S'],
        ['buttonLabel when no title or subtitle', { buttonLabel: 'B' }, 'B'],
        ['empty string when none', {}, ''],
    ])('%s', (_, overrides: Partial<Banner>, expected) => {
        expect(getCompactText({ ...banner, ...overrides })).toBe(expected)
    })
})
