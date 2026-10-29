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
    AppError,
    ErrorCategory,
    isExpectedError,
} from '@perawallet/wallet-core-shared'
import { Arc0001Error } from '../blockchain/arc0001/errors'
import { Arc0001ErrorCode } from '../blockchain/arc0001/types'
import {
    QUANTUM_SWAP_PROPOSE_BLOCKED_KEY,
    QuantumSwapBlockedError,
    isUserRejectionError,
} from '../swaps/swapExecutionHelpers'
import { SwapQuoteMismatchError } from '../swaps/validateSwapGroupAgainstQuote'
import { SwapUserRejectedError } from '../swaps/swapGroupPlan'

const rows: [string, () => AppError, ErrorCategory][] = [
    [
        'QuantumSwapBlockedError',
        () => new QuantumSwapBlockedError(QUANTUM_SWAP_PROPOSE_BLOCKED_KEY),
        ErrorCategory.TRANSACTIONS,
    ],
    [
        'SwapQuoteMismatchError',
        () => new SwapQuoteMismatchError('spends too much'),
        ErrorCategory.TRANSACTIONS,
    ],
    [
        'SwapUserRejectedError',
        () => new SwapUserRejectedError(),
        ErrorCategory.TRANSACTIONS,
    ],
    [
        'Arc0001Error',
        () => new Arc0001Error(Arc0001ErrorCode.InvalidInput, 'm'),
        ErrorCategory.CONNECTIONS,
    ],
]

describe('chain-algorand domain errors', () => {
    it.each(rows)('%s is a classified AppError', (name, make, category) => {
        const error = make()

        expect(error).toBeInstanceOf(AppError)
        expect(error.name).toBe(name)
        expect(error.metadata.category).toBe(category)
        expect(isExpectedError(error)).toBe(false)
    })

    it('keeps the code and data of an ARC-1 error', () => {
        const error = new Arc0001Error(Arc0001ErrorCode.InvalidInput, 'm', {
            index: 1,
        })

        expect(error.code).toBe(Arc0001ErrorCode.InvalidInput)
        expect(error.data).toEqual({ index: 1 })
    })

    it('keeps the key the swap screen renders itself', () => {
        const error = new QuantumSwapBlockedError(
            QUANTUM_SWAP_PROPOSE_BLOCKED_KEY,
        )

        expect(error.translationKey).toBe(QUANTUM_SWAP_PROPOSE_BLOCKED_KEY)
    })

    it('still reads a swap rejection as a user cancel', () => {
        expect(isUserRejectionError(new SwapUserRejectedError())).toBe(true)
    })
})
