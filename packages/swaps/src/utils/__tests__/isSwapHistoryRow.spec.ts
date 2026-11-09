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

import { describe, expect, test } from 'vitest'
import { makeSwapHistoryItem } from '../../__tests__/swapHistoryFixture'
import { isSwapHistoryRow } from '../isSwapHistoryRow'

describe('isSwapHistoryRow', () => {
    test.each([null, 'wallet_transaction'])(
        'keeps a row funded by %s',
        fundingMethod => {
            expect(
                isSwapHistoryRow(makeSwapHistoryItem({ fundingMethod })),
            ).toBe(true)
        },
    )

    test.each(['deposit', 'fiat'])(
        'drops a row funded by %s',
        fundingMethod => {
            expect(
                isSwapHistoryRow(makeSwapHistoryItem({ fundingMethod })),
            ).toBe(false)
        },
    )
})
