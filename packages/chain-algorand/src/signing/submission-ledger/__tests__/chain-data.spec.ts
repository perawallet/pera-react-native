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
import { algorandSubmissionChainData, lastValidOf } from '../chain-data'

describe('submission chain data', () => {
    it('records no chain data when the round could not be decoded', () => {
        expect(algorandSubmissionChainData(undefined)).toBeUndefined()
    })

    it('reads back the round it records', () => {
        const chainData = algorandSubmissionChainData(7)

        expect(chainData).toEqual({ family: 'algorand', lastValid: 7 })
        expect(lastValidOf({ chainData: chainData! })).toBe(7)
    })

    it('reads no round from an attempt carrying EVM chain data', () => {
        expect(lastValidOf({ chainData: { family: 'evm' } })).toBeNull()
    })

    it('reads no round from an attempt without chain data', () => {
        expect(lastValidOf({ chainData: null })).toBeNull()
    })
})
