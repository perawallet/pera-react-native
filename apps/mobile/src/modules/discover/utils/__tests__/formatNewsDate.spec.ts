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

import { describe, expect, it, vi } from 'vitest'
import { getActiveLocale } from '@perawallet/wallet-core-shared'
import { formatNewsDate } from '../formatNewsDate'

describe('formatNewsDate', () => {
    it('formats day, short month and year in the active locale order', () => {
        vi.mocked(getActiveLocale).mockReturnValue('en-GB')
        expect(formatNewsDate(new Date('2026-11-09T10:00:00Z'))).toBe(
            '09 Nov 2026',
        )
    })

    it('orders the parts per locale', () => {
        vi.mocked(getActiveLocale).mockReturnValue('en-US')
        expect(formatNewsDate(new Date('2026-11-09T10:00:00Z'))).toBe(
            'Nov 09, 2026',
        )
    })
})
