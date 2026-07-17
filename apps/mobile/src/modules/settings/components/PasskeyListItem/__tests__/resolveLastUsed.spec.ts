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
import { resolveLastUsed } from '../resolveLastUsed'

describe('resolveLastUsed', () => {
    it('reports "never" when the passkey has no lastUsedAt', () => {
        expect(resolveLastUsed(undefined).kind).toBe('never')
    })

    it('reports "today" when lastUsedAt falls on the current calendar day', () => {
        const now = new Date(2026, 4, 28, 9, 30).getTime()
        const earlierSameDay = new Date(2026, 4, 28, 1, 0).getTime()

        expect(resolveLastUsed(earlierSameDay, now).kind).toBe('today')
    })

    it('reports a formatted date for a previous day', () => {
        const now = new Date(2026, 4, 28, 9, 30).getTime()
        const lastWeek = new Date(2026, 4, 21, 9, 30).getTime()

        const result = resolveLastUsed(lastWeek, now)

        expect(result.kind).toBe('date')
        expect(result.kind === 'date' && result.value.length > 0).toBe(true)
    })
})
