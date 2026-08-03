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

import { describe, test, expect } from 'vitest'
import {
    BlockchainError,
    TransactionError,
    SigningError,
    InvalidTransactionError,
} from '../BlockchainError'

describe('blockchain error copy', () => {
    test('BlockchainError defaults to the generic blockchain key', () => {
        const error = new BlockchainError('internal detail')

        expect(error.metadata.messageKey).toBe('errors.blockchain.generic')
    })

    test('TransactionError declares its key', () => {
        const error = new TransactionError('TX1', new Error('node rejected'))

        expect(error.metadata.messageKey).toBe('errors.blockchain.transaction')
    })

    test('TransactionError declares its key even without a txId', () => {
        const error = new TransactionError(undefined, new Error('boom'))

        expect(error.metadata.messageKey).toBe('errors.blockchain.transaction')
    })

    test('TransactionError still sets params when txId is undefined', () => {
        // Regression guard: the old code only assigned params inside `if (txId)`,
        // so params stayed undefined whenever txId was falsy — exactly the case
        // where {{cause}} would have rendered literally in the old copy.
        const error = new TransactionError(undefined, new Error('boom'))

        expect(error.metadata.params).toEqual({
            txId: undefined,
            cause: 'boom',
        })
    })

    test('SigningError declares its key', () => {
        const error = new SigningError(new Error('user cancelled'))

        expect(error.metadata.messageKey).toBe('errors.blockchain.signing')
    })

    test('InvalidTransactionError declares its key', () => {
        const error = new InvalidTransactionError(new Error('bad fee'))

        expect(error.metadata.messageKey).toBe(
            'errors.blockchain.invalid_transaction',
        )
    })

    test('keeps cause in params for logging without showing it to users', () => {
        // Guards against a future cleanup stripping `cause` as "unused" now that
        // the copy no longer interpolates it — not a check of this task's
        // messageKey wiring, since SigningError already set params this way.
        const error = new SigningError(new Error('raw algod dump'))

        expect(error.metadata.params).toEqual({ cause: 'raw algod dump' })
    })
})
