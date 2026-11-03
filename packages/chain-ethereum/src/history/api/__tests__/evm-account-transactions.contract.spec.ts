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
    expectEveryRowParses,
    readBackendRecording,
} from '../../../__tests__/backend-recordings'
import { historyPath } from '../endpoints'
import {
    evmHistoryItemSchema,
    evmHistoryPageSchema,
    type EvmHistoryItemResponse,
} from '../schema'

const recording = readBackendRecording('evm-account-transactions')

const wireRows = (): EvmHistoryItemResponse[] =>
    evmHistoryPageSchema.parse(recording.response)
        .results as EvmHistoryItemResponse[]

const isPresent = (value: unknown): boolean =>
    Array.isArray(value)
        ? value.length > 0
        : value !== null && value !== undefined

describe('GET /api/v3/evm/{id}/accounts/{addr}/transactions/ contract', () => {
    it('is the route the app calls', () => {
        expect(recording.request).toMatchObject({
            method: 'GET',
            path: historyPath(
                recording.request.pathParams?.chainId ?? -1,
                recording.request.pathParams?.address ?? '',
            ),
        })
    })

    it('the recorded response parses', () => {
        const { results } = evmHistoryPageSchema.parse(recording.response)

        expectEveryRowParses(results, evmHistoryItemSchema)
    })

    // A row parses even when one of its legs, or a display field, fails: the
    // schema drops the leg or falls back. Here either fails the contract.
    it('keeps every leg and field the app reads', () => {
        const kept = wireRows().map(row => {
            const parsed = evmHistoryItemSchema.parse(row)
            return {
                blockNumber: parsed.block_number,
                internal: parsed.internal_transfers.length,
                nfts: parsed.nft_transfers.length,
                tokens: parsed.token_transfers.map(leg => [
                    leg.token_symbol,
                    leg.token_decimals,
                ]),
            }
        })

        expect(kept).toEqual(
            wireRows().map(row => ({
                blockNumber: row.block_number,
                internal: row.internal_transfers.length,
                nfts: row.nft_transfers.length,
                tokens: row.token_transfers.map(leg => [
                    leg.token_symbol,
                    leg.token_decimals,
                ]),
            })),
        )
    })

    // A field null or empty on every row passes the parse unchecked.
    it('fills every field the app reads on at least one row', () => {
        const rows = wireRows()

        const unexercised = Object.keys(evmHistoryItemSchema.shape).filter(
            key =>
                !rows.some(row =>
                    isPresent(row[key as keyof EvmHistoryItemResponse]),
                ),
        )

        expect(unexercised).toEqual([])
    })
})
