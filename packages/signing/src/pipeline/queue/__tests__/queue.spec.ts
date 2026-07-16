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
import { getNextQueuedRequest } from '../index'
import type { TransactionSignRequest } from '../../../models'

const makeRequest = (id: string): TransactionSignRequest => ({
    id,
    type: 'transactions',
    transport: 'algod',
    txs: [{ sender: { toString: () => 'ADDR1' } } as any],
})

describe('getNextQueuedRequest', () => {
    test('returns the first request when no actors are running', () => {
        const requests = [makeRequest('tx-1'), makeRequest('tx-2')]
        expect(getNextQueuedRequest(requests, 0)?.id).toBe('tx-1')
    })

    test('returns undefined when an actor is already running', () => {
        const requests = [makeRequest('tx-1')]
        expect(getNextQueuedRequest(requests, 1)).toBeUndefined()
    })

    test('returns undefined when there are no pending requests', () => {
        expect(getNextQueuedRequest([], 0)).toBeUndefined()
    })

    test('returns undefined when queue is empty and actors are running', () => {
        expect(getNextQueuedRequest([], 1)).toBeUndefined()
    })
})
