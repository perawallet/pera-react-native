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
import { describeAlgorandHolding } from '../holdings'

describe('describeAlgorandHolding', () => {
    it('blocks transfers of a frozen holding', () => {
        expect(
            describeAlgorandHolding({ family: 'algorand', isFrozen: true }),
        ).toEqual({ restriction: 'transferBlocked' })
    })

    it('places no restriction on an EVM holding', () => {
        expect(describeAlgorandHolding({ family: 'evm' })).toEqual({
            restriction: null,
        })
    })

    it('places no restriction on a holding that is not frozen', () => {
        expect(
            describeAlgorandHolding({ family: 'algorand', isFrozen: false }),
        ).toEqual({ restriction: null })
    })
})
