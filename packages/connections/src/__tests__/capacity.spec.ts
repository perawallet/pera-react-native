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
import {
    MAX_PENDING_REQUESTS,
    MAX_PENDING_REQUESTS_PER_PEER,
    pendingCapacityBreach,
} from '../capacity'

describe('pendingCapacityBreach', () => {
    it('admits a peer below both caps', () => {
        const open = Array(MAX_PENDING_REQUESTS_PER_PEER - 1).fill('a')

        expect(pendingCapacityBreach(open, 'a')).toBeNull()
    })

    it('refuses a peer at its own cap while admitting another', () => {
        const open = Array(MAX_PENDING_REQUESTS_PER_PEER).fill('a')

        expect(pendingCapacityBreach(open, 'a')).toBe('peer')
        expect(pendingCapacityBreach(open, 'b')).toBeNull()
    })

    it('refuses every peer at the total cap', () => {
        const open = Array.from(
            { length: MAX_PENDING_REQUESTS },
            (_, index) => `peer-${index}`,
        )

        expect(pendingCapacityBreach(open, 'new')).toBe('total')
    })
})
