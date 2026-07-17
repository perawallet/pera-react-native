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
import { isoToFlagEmoji } from '../isoToFlagEmoji'

describe('isoToFlagEmoji', () => {
    it('converts an uppercase ISO code to its flag emoji', () => {
        expect(isoToFlagEmoji('GB')).toBe('🇬🇧')
    })

    it('is case-insensitive', () => {
        expect(isoToFlagEmoji('us')).toBe('🇺🇸')
    })

    it('returns an empty string for non 2-letter input', () => {
        expect(isoToFlagEmoji('USA')).toBe('')
        expect(isoToFlagEmoji('U')).toBe('')
        expect(isoToFlagEmoji('')).toBe('')
        expect(isoToFlagEmoji('1A')).toBe('')
    })
})
