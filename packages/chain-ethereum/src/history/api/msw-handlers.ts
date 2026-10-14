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

import { http, HttpResponse, type RequestHandler } from 'msw'
import { rejectUnauthenticated } from '../../assets/api/msw-handlers'
import { historyPath } from './endpoints'
import type { EvmHistoryItemResponse } from './schema'

export type PeraEvmHistoryFixtures = {
    /** Defaults to every host. */
    baseUrl?: string
    /**
     * Pages keyed by lowercase address, newest first; an address left out has
     * an empty history. A number fails every history read with that status.
     */
    history?: Record<string, EvmHistoryItemResponse[][]> | number
}

const CURSOR = /^page:(\d+)$/

/** A successful transaction row with no legs and unknown parties. */
export const evmHistoryItem = (
    overrides: Partial<EvmHistoryItemResponse> = {},
): EvmHistoryItemResponse => ({
    kind: 'transaction',
    hash: `0x${'1'.padStart(64, '0')}`,
    block_number: 1,
    block_time: '2026-01-01T00:00:00Z',
    from: null,
    to: null,
    value: null,
    fee: null,
    status: 'success',
    method: null,
    token_transfers: [],
    internal_transfers: [],
    nft_transfers: [],
    withdrawals: [],
    balance_impacts: [],
    ...overrides,
})

/** The Pera backend's EVM transaction history endpoint. */
export const peraEvmHistoryHandlers = ({
    baseUrl = '*',
    history = {},
}: PeraEvmHistoryFixtures = {}): RequestHandler[] => [
    http.get(
        `${baseUrl.replace(/\/+$/, '')}${historyPath(':chainId', ':address')}`,
        ({ request, params }) => {
            const refused = rejectUnauthenticated(request)
            if (refused) return refused
            if (typeof history === 'number') {
                return HttpResponse.json({}, { status: history })
            }
            const listed = history[String(params.address).toLowerCase()]
            const pages = listed?.length ? listed : [[]]
            const cursor = new URL(request.url).searchParams.get('cursor')
            const index =
                cursor === null ? 0 : Number(CURSOR.exec(cursor)?.[1] ?? NaN)
            const results = pages[index]
            if (!results) {
                return HttpResponse.json(
                    { error: 'Invalid cursor', code: 'invalid_cursor' },
                    { status: 404 },
                )
            }
            return HttpResponse.json({
                next: index + 1 < pages.length ? `page:${index + 1}` : null,
                previous: null,
                results,
            })
        },
    ),
]
