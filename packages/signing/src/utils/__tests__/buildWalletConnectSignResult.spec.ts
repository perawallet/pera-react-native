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
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import { buildWalletConnectSignResult } from '../buildWalletConnectSignResult'

describe('buildWalletConnectSignResult', () => {
    test('places each signed item at its original group slot, null elsewhere', () => {
        const a = new Uint8Array([1, 2])
        const b = new Uint8Array([3, 4])

        // Two signable items at group positions 1 and 3 of a 4-tx group.
        const result = buildWalletConnectSignResult([a, b], [1, 3], 4)

        expect(result).toEqual([
            null,
            encodeToBase64(a),
            null,
            encodeToBase64(b),
        ])
    })

    test('returns an all-null array when there are no signed items', () => {
        expect(buildWalletConnectSignResult([], [], 3)).toEqual([
            null,
            null,
            null,
        ])
    })

    test('skips a null/absent signed entry without shifting the others', () => {
        const a = new Uint8Array([9])
        // Second slot has no bytes — its position stays null.
        const result = buildWalletConnectSignResult(
            [a, undefined as unknown as Uint8Array],
            [0, 2],
            3,
        )

        expect(result).toEqual([encodeToBase64(a), null, null])
    })
})
