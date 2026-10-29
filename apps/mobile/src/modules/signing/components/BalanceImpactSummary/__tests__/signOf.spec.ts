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
import { signOf } from '../signOf'
import type { BalanceImpactItem } from '../useBalanceImpactSummary'

const itemWith = (direction: BalanceImpactItem['direction']) =>
    ({ direction }) as BalanceImpactItem

describe('signOf', () => {
    it('is a plus for a receive', () => {
        expect(signOf(itemWith('receive'))).toBe('+')
    })

    it('is a minus for a spend', () => {
        expect(signOf(itemWith('spend'))).toBe('-')
    })
})
