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
import {
    DappRequestFailedError,
    DappRequestRejectedError,
    PendingRequestCapacityError,
    dappRequestFailureOf,
    isDappUserRejection,
} from '../dappRequest'

const rows: [string, () => AppError, ErrorCategory][] = [
    [
        'DappRequestRejectedError',
        () => new DappRequestRejectedError(),
        ErrorCategory.CONNECTIONS,
    ],
    [
        'DappRequestFailedError',
        () => new DappRequestFailedError('nope'),
        ErrorCategory.CONNECTIONS,
    ],
    [
        'PendingRequestCapacityError',
        () => new PendingRequestCapacityError(),
        ErrorCategory.CONNECTIONS,
    ],
]

describe('connections domain errors', () => {
    it.each(rows)('%s is a classified AppError', (name, make, category) => {
        const error = make()

        expect(error).toBeInstanceOf(AppError)
        expect(error.name).toBe(name)
        expect(error.metadata.category).toBe(category)
        expect(isExpectedError(error)).toBe(false)
    })

    it('still reads as a user rejection', () => {
        expect(isDappUserRejection(new DappRequestRejectedError())).toBe(true)
    })

    it('still carries the failure the dApp is answered with', () => {
        expect(
            dappRequestFailureOf(
                new DappRequestFailedError('m', 'invalid-params'),
            ),
        ).toBe('invalid-params')
        expect(dappRequestFailureOf(new PendingRequestCapacityError())).toBe(
            'limit-exceeded',
        )
    })
})
