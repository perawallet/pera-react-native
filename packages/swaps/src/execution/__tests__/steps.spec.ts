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
import type { SwapOrder, SwapOrderStep } from '../../models'
import { signableStepsOn } from '../steps'

const signStep = (chainId: 'algorand' | 'ethereum'): SwapOrderStep => ({
    kind: 'sign-transactions',
    scope: { chainId, networkId: 'mainnet' },
    purpose: 'swap',
    transactions: ['tx'],
    presignedTransactions: null,
})

const order = (steps: SwapOrderStep[]): SwapOrder => ({
    orderId: 'order-1',
    status: 'pending',
    expiresAt: null,
    steps,
})

describe('signableStepsOn', () => {
    it('returns every step when all sign on the chain', () => {
        const steps = [signStep('algorand'), signStep('algorand')]

        expect(signableStepsOn(order(steps), 'algorand')).toEqual(steps)
    })

    it('refuses an order with a step it cannot run', () => {
        expect(
            signableStepsOn(
                order([
                    signStep('algorand'),
                    { kind: 'unsupported', routerKind: 'open_checkout' },
                ]),
                'algorand',
            ),
        ).toBeNull()
    })

    it('refuses an order with a step on another chain', () => {
        expect(
            signableStepsOn(
                order([signStep('algorand'), signStep('ethereum')]),
                'algorand',
            ),
        ).toBeNull()
    })
})
