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

import { describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { formatSwapLimit } from '../formatSwapLimit'

vi.mock('@perawallet/wallet-core-shared', async importOriginal =>
    importOriginal<typeof import('@perawallet/wallet-core-shared')>(),
)

describe('formatSwapLimit', () => {
    it('rounds a minimum up to the display precision', () => {
        expect(
            formatSwapLimit(
                new Decimal('123456789012345'),
                18,
                Decimal.ROUND_UP,
                'en',
            ),
        ).toBe('0.000124')
    })

    it('rounds a maximum down to the display precision', () => {
        expect(
            formatSwapLimit(
                new Decimal('123456789012345'),
                18,
                Decimal.ROUND_DOWN,
                'en',
            ),
        ).toBe('0.000123')
    })
})
