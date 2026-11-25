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
import { relativeDayKeyOf } from '../relativeDay'

// The real date formatting, which the shared test mock leaves out.
vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
}))

describe('relativeDayKeyOf', () => {
    const now = new Date(2026, 10, 25, 9, 30)

    it('names today and yesterday by their local dates', () => {
        expect(relativeDayKeyOf('2026-11-25', now)).toBe(
            'transactions.filter.today',
        )
        expect(relativeDayKeyOf('2026-11-24', now)).toBe(
            'transactions.filter.yesterday',
        )
    })

    it('leaves any other day to its own date', () => {
        expect(relativeDayKeyOf('2026-11-23', now)).toBeUndefined()
        expect(relativeDayKeyOf('2026-11-26', now)).toBeUndefined()
    })

    it('steps back a calendar day across a month boundary', () => {
        expect(
            relativeDayKeyOf('2026-10-31', new Date(2026, 10, 1, 0, 30)),
        ).toBe('transactions.filter.yesterday')
    })
})
