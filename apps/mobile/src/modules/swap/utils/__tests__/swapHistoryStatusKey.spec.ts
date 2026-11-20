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
import { swapHistoryStatusKey } from '../swapHistoryStatusKey'

describe('swapHistoryStatusKey', () => {
    it('labels a pending order as in progress', () => {
        expect(swapHistoryStatusKey('pending')).toBe(
            'swap.history.list.item.status.in_progress',
        )
        expect(swapHistoryStatusKey('in_progress')).toBe(
            'swap.history.list.item.status.in_progress',
        )
    })

    it('gives a completed swap no label', () => {
        expect(swapHistoryStatusKey('completed')).toBeNull()
    })

    it('tells a refund apart from a failure', () => {
        expect(swapHistoryStatusKey('failed')).toBe(
            'swap.history.list.item.status.failed',
        )
        expect(swapHistoryStatusKey('refunded')).toBe(
            'swap.history.list.item.status.refunded',
        )
    })
})
