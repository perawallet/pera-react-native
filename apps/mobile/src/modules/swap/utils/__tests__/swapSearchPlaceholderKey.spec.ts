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

import { describe, expect, it } from 'vitest'
import { swapSearchPlaceholderKey } from '../swapSearchPlaceholderKey'

describe('swapSearchPlaceholderKey', () => {
    it('keeps the asset ID wording when only Algorand is searched', () => {
        expect(swapSearchPlaceholderKey(['algorand'])).toBe(
            'swap.asset_selection.search_placeholder',
        )
    })

    it('names the contract address when only EVM networks are searched', () => {
        expect(swapSearchPlaceholderKey(['ethereum', 'base'])).toBe(
            'swap.asset_selection.search_placeholder_evm',
        )
    })

    it('names both when Algorand and an EVM network are searched together', () => {
        expect(swapSearchPlaceholderKey(['algorand', 'ethereum'])).toBe(
            'swap.asset_selection.search_placeholder_all',
        )
    })
})
