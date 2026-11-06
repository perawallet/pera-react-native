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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { cursorOf, routerRequest } from '@perawallet/wallet-core-swaps'

import type { RampToken } from '../../models'
import {
    rampPairRowSchema,
    rampPairsPageSchema,
    type RampPairRowApiResponse,
} from './schema'
import { dedupeRampTokens, transformRampPairRow } from './transformers'

const PAGE_LIMIT = 50
const MAX_PAGES = 20

// `signable=false` keeps out every pair Swap signs for: Fund lists only
// provider checkout and external deposit routes.
const fetchRows = async (
    scope: ChainScope,
    destinationId: Nullable<string>,
): Promise<RampPairRowApiResponse[]> => {
    const rows: RampPairRowApiResponse[] = []
    let cursor: Nullable<string> = null
    for (let page = 0; page < MAX_PAGES; page++) {
        const data = await routerRequest({
            scope,
            method: 'GET',
            path: 'pairs/',
            params: {
                signable: 'false',
                limit: PAGE_LIMIT,
                ...(destinationId === null
                    ? {}
                    : { destination: destinationId }),
                ...(cursor === null ? {} : { cursor }),
            },
        })
        const parsed = rampPairsPageSchema.parse(data)
        for (const raw of parsed.results) {
            const row = rampPairRowSchema.safeParse(raw)
            if (row.success) rows.push(row.data)
        }
        cursor = cursorOf(parsed.next)
        if (cursor === null) break
    }
    return rows
}

const toTokens = (token: Nullable<RampToken>): RampToken[] =>
    token === null ? [] : [token]

/** Everything Fund can deliver, with no anchor. */
export const getRampDestinations = async (
    scope: ChainScope,
): Promise<RampToken[]> =>
    dedupeRampTokens(
        (await fetchRows(scope, null)).flatMap(row =>
            toTokens(transformRampPairRow(row)),
        ),
    )

/** What can fund `destinationId`: its fiat currencies and deposit coins. */
export const getRampSources = async (
    destinationId: string,
    scope: ChainScope,
): Promise<RampToken[]> =>
    dedupeRampTokens(
        (await fetchRows(scope, destinationId))
            .flatMap(row => toTokens(transformRampPairRow(row)))
            .filter(token => token.kind !== 'token'),
    )
