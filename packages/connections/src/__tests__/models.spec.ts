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
import { WALLET_OPERATION_TYPES } from '../models'

describe('wallet operation vocabulary', () => {
    it('is closed to the two ARC-defined operations', () => {
        // The union is deliberately closed: handlers reject what they cannot
        // map rather than emitting an `unknown` variant every consumer must
        // then handle forever.
        expect(WALLET_OPERATION_TYPES).toEqual([
            'sign-transactions',
            'sign-data',
        ])
    })
})
