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
import { humaniseFunctionName } from '../humaniseFunctionName'

describe('humaniseFunctionName', () => {
    it('splits camel case into a sentence-case title', () => {
        expect(humaniseFunctionName('supply')).toBe('Supply')
        expect(humaniseFunctionName('claimAllRewardsToSelf')).toBe(
            'Claim all rewards to self',
        )
    })

    it('keeps acronyms and reads snake case', () => {
        expect(humaniseFunctionName('depositETH')).toBe('Deposit ETH')
        expect(humaniseFunctionName('swap_exact_tokens')).toBe(
            'Swap exact tokens',
        )
    })
})
