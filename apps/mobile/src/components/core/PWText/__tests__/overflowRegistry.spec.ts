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
import { recordOverflow, drainOverflow } from '../overflowRegistry'

describe('overflowRegistry', () => {
    it('drains what was recorded', () => {
        recordOverflow({ key: 'a', kind: 'truncated', text: 'Hello' })

        expect(drainOverflow()).toEqual([
            { key: 'a', kind: 'truncated', text: 'Hello' },
        ])
    })

    it('empties on drain so records never leak into the next step', () => {
        recordOverflow({ key: 'a', kind: 'truncated', text: 'Hello' })
        drainOverflow()

        expect(drainOverflow()).toEqual([])
    })

    it('de-duplicates repeated records for the same key and kind', () => {
        recordOverflow({ key: 'a', kind: 'truncated', text: 'Hello' })
        recordOverflow({ key: 'a', kind: 'truncated', text: 'Hello' })

        expect(drainOverflow()).toHaveLength(1)
    })

    it('keeps distinct kinds for the same key separate', () => {
        recordOverflow({ key: 'a', kind: 'truncated', text: 'Hello' })
        recordOverflow({ key: 'a', kind: 'wider-than-parent', text: 'Hello' })

        expect(drainOverflow()).toHaveLength(2)
    })

    it('drops a record with an empty key instead of collapsing every unkeyable child into one shared entry', () => {
        recordOverflow({ key: '', kind: 'truncated', text: 'anything' })
        recordOverflow({ key: '', kind: 'wider-than-parent', text: 'other' })

        expect(drainOverflow()).toEqual([])
    })
})
