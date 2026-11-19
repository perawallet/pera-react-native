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

import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { swapFailureStepOf } from '../failureStep'

const chainId = 'eip155:1' as ChainId

describe('swapFailureStepOf', () => {
    it('returns the stamped step over the phase', () => {
        expect(
            swapFailureStepOf({
                phase: 'prepare',
                reason: 'prepare-failed',
                error: new Error('x'),
                step: 'swap',
            }),
        ).toBe('swap')
        expect(
            swapFailureStepOf({
                phase: 'submission',
                reason: 'reverted',
                error: new Error('x'),
                step: 'approval',
            }),
        ).toBe('approval')
    })

    it('reports a step-less prepare failure as prepare', () => {
        expect(
            swapFailureStepOf({
                phase: 'prepare',
                reason: 'insufficient-native-balance',
                chainId,
                shortfall: new Decimal(1),
            }),
        ).toBe('prepare')
    })

    it('reports step-less signing and submission failures as swap', () => {
        expect(
            swapFailureStepOf({ phase: 'signing', reason: 'signing-failed' }),
        ).toBe('swap')
        expect(
            swapFailureStepOf({
                phase: 'submission',
                reason: 'submission-failed',
                error: new Error('x'),
            }),
        ).toBe('swap')
    })
})
