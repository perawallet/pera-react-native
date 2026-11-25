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
                !READ_AHEAD_OF_BACKEND.has(key) &&
                !rows.some(row =>
                    isPresent(row[key as keyof EvmHistoryItemResponse]),
                ),
        )

        expect(unexercised).toEqual([])
    })
})

// Read before the recorded backend serves them, and each one optional; take a
// field out once the recording is refreshed from a backend that sends it.
const READ_AHEAD_OF_BACKEND: ReadonlySet<string> = new Set([
    'nonce',
    'gas_limit',
    'gas_used',
    'gas_price',
])

describe('the native asset view (asset_id = slip44)', () => {
    const native = readBackendRecording('evm-account-transactions-native')
    const address = native.request.pathParams?.address ?? ''
    const rows = () =>
        evmHistoryPageSchema.parse(native.response)
            .results as EvmHistoryItemResponse[]

    it('is the route the app calls, for the chain native coin', () => {
        expect(native.request.params?.asset_id).toMatch(/\/slip44:\d+$/)
        expectEveryRowParses(rows(), evmHistoryItemSchema)
    })

    // The native History keeps the account's gas-only calls by their sender and fee.
    it('keeps a call the account sent that moved only its gas', () => {
        const gasOnly = rows().filter(
            row =>
                row.from === address &&
                row.fee !== null &&
                row.balance_impacts.length === 1 &&
                row.balance_impacts[0].amount === `-${row.fee}`,
        )

        expect(gasOnly.length).toBeGreaterThan(0)
    })
})

describe('an ERC-20 asset view (asset_id = erc20)', () => {
    const erc20 = readBackendRecording('evm-account-transactions-erc20')
    const rows = () =>
        evmHistoryPageSchema.parse(erc20.response)
            .results as EvmHistoryItemResponse[]

    it('is the route the app calls, for one token', () => {
        expect(erc20.request.params?.asset_id).toMatch(
            /\/erc20:0x[0-9a-f]{40}$/,
        )
        expectEveryRowParses(rows(), evmHistoryItemSchema)
    })

    // Read from the token's transfer log alone, so a record here carries no
    // initiator or fee and a router call reads as a plain transfer.
    it('names no sender on any row', () => {
        expect(rows().filter(row => row.from !== null)).toEqual([])
    })
})
