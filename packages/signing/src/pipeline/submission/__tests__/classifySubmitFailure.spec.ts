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
import { AlgodError } from '@perawallet/wallet-core-blockchain'
import { SubmissionError } from '../../errors'
import { classifySubmitFailure } from '../classifySubmitFailure'

const TX_IDS = ['TXID_A', 'TXID_B']

describe('classifySubmitFailure', () => {
    it('reports an already-in-ledger duplicate as success rather than a failure', () => {
        const outcome = classifySubmitFailure(
            new AlgodError('duplicate_txn', {}),
            TX_IDS,
            'test',
        )

        expect(outcome.kind).toBe('already-in-ledger')
    })

    it.each(['network_unavailable', 'unknown_node_error'] as const)(
        'classifies %s as unknown-outcome and keeps it retryable',
        code => {
            const outcome = classifySubmitFailure(
                new AlgodError(code, {}),
                TX_IDS,
                'test',
            )

            expect(outcome.kind).toBe('classified')
            if (outcome.kind !== 'classified') return
            expect(outcome.error.classification).toBe('unknown-outcome')
            expect(outcome.error.metadata.retryable).toBe(true)
            expect(outcome.error.txIds).toEqual(TX_IDS)
        },
    )

    it('classifies a node verdict as rejected-by-node and non-retryable', () => {
        const outcome = classifySubmitFailure(
            new AlgodError('overspend', {}),
            TX_IDS,
            'test',
        )

        expect(outcome.kind).toBe('classified')
        if (outcome.kind !== 'classified') return
        expect(outcome.error.classification).toBe('rejected-by-node')
        expect(outcome.error.metadata.retryable).toBe(false)
    })

    it('treats an aborted request as unknown-outcome, since the bytes may have reached the pool', () => {
        const timeout = new Error('aborted')
        timeout.name = 'TimeoutError'

        const outcome = classifySubmitFailure(timeout, TX_IDS, 'test')

        expect(outcome.kind).toBe('classified')
        if (outcome.kind !== 'classified') return
        expect(outcome.error.classification).toBe('unknown-outcome')
    })

    it('returns an empty-txId error rather than throwing when ids could not be derived', () => {
        const outcome = classifySubmitFailure(
            new AlgodError('overspend', {}),
            [],
            'test',
        )

        expect(outcome.kind).toBe('classified')
        if (outcome.kind !== 'classified') return
        expect(outcome.error.txIds).toEqual([])
    })
})
