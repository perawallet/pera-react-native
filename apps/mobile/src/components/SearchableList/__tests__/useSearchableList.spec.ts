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
import { isSeparatorSuppressed } from '../useSearchableList'

const HEADER_SENTINEL = { __searchableListHeader: true, key: 'h' }
const SEARCH_SENTINEL = { __searchableListSearch: true, key: 's' }
const ROW = { id: '1' }

describe('isSeparatorSuppressed', () => {
    it('suppresses the divider between the header and search sentinels', () => {
        expect(isSeparatorSuppressed(HEADER_SENTINEL, SEARCH_SENTINEL)).toBe(
            true,
        )
    })

    it('suppresses the divider between the search sentinel and the first row', () => {
        expect(isSeparatorSuppressed(SEARCH_SENTINEL, ROW)).toBe(true)
    })

    it('suppresses the divider when only the leading side is a sentinel', () => {
        expect(isSeparatorSuppressed(HEADER_SENTINEL, ROW)).toBe(true)
    })

    it('keeps the divider between two real rows', () => {
        expect(isSeparatorSuppressed(ROW, { id: '2' })).toBe(false)
    })
})
