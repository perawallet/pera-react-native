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
import {
    cursorOf,
    routerAccountId,
    routerRequest,
} from '@perawallet/wallet-core-swaps'

import type { RampHistoryItem } from '../../models'
import { rampHistoryPageSchema } from './schema'
import { isFundHistoryItem, transformRampHistoryItem } from './transformers'

const PAGE_LIMIT = 50
// The router mixes Swap orders in, so a page can be emptied by the filter
// while older Fund orders wait behind `next`.
const MAX_REQUESTS_PER_PAGE = 5

export type GetRampHistoryParams = {
    deviceId: string
    accountAddress: string
    cursor?: string
}

export type RampHistoryPage = {
    results: RampHistoryItem[]
    cursor: Nullable<string>
}

export const getRampHistory = async (
    params: GetRampHistoryParams,
    scope: ChainScope,
): Promise<RampHistoryPage> => {
    let cursor: Nullable<string> = params.cursor ?? null
    let results: RampHistoryItem[] = []
    for (let request = 0; request < MAX_REQUESTS_PER_PAGE; request++) {
        const data = await routerRequest({
            scope,
            method: 'GET',
            path: 'history/',
            params: {
                device_id: params.deviceId,
                accounts: routerAccountId(scope, params.accountAddress),
                limit: PAGE_LIMIT,
                ...(cursor === null ? {} : { cursor }),
            },
        })
        const parsed = rampHistoryPageSchema.parse(data)
        results = parsed.results
            .filter(isFundHistoryItem)
            .map(transformRampHistoryItem)
        cursor = cursorOf(parsed.next)
        if (results.length > 0 || cursor === null) break
    }
    return { results, cursor }
}
