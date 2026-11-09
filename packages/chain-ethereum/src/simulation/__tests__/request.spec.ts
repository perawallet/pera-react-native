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
import { Decimal } from 'decimal.js'
import type { EthereumTransactionView } from '../../signing/transaction-view'
import { simulationRequestOf } from '../request'

const FROM = '0x5A1E000000000000000000000000000000000001'
const TO = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'

const BASE = {
    kind: 'contract-call',
    from: FROM,
    to: TO,
    value: new Decimal(5),
    data: '0x7ff36ab5',
} as const

const PRICED: EthereumTransactionView = {
    ...BASE,
    nonce: 3,
    gas: 90_000n,
    fee: {
        maxFeePerGas: new Decimal(30),
        maxPriorityFeePerGas: new Decimal(2),
        maxFee: new Decimal(2_700_000),
    },
}

describe('simulationRequestOf', () => {
    it('reads what the signature commits to from a priced view', () => {
        expect(simulationRequestOf(PRICED)).toEqual({
            from: FROM,
            to: TO,
            value: new Decimal(5),
            data: '0x7ff36ab5',
            gas: 90_000n,
            maxFeePerGas: new Decimal(30),
            maxPriorityFeePerGas: new Decimal(2),
        })
    })

    it('has nothing to simulate for a preview, a mined view or a view with no target', () => {
        expect(simulationRequestOf({ ...BASE, isPreview: true })).toBeNull()
        expect(simulationRequestOf({ ...BASE, isMined: true })).toBeNull()
        expect(
            simulationRequestOf({ ...PRICED, to: undefined } as never),
        ).toBeNull()
    })
})
