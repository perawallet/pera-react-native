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
import * as contexts from '../contexts'

const rawEventValues = Object.entries(contexts)
    // Keep only the event enums (drop the re-exported types, which are erased).
    .filter(([name]) => name.endsWith('Event'))
    .flatMap(([, value]) => Object.values(value as Record<string, string>))

describe('analytics event catalog', () => {
    it('maps every event across all contexts to a unique raw Firebase string', () => {
        const unique = new Set(rawEventValues)

        expect(unique.size).toBe(rawEventValues.length)
    })

    it('covers the full scoped catalog', () => {
        // Guards against accidental deletions during refactors.
        // 101 events today (88 ported from the native apps + 13 RN net-new);
        // the floor trails that slightly to leave room for intentional churn.
        expect(rawEventValues.length).toBeGreaterThanOrEqual(100)
    })
})
