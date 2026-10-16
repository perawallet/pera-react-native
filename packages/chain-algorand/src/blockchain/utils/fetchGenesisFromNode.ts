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

import { createNodeHttpClient } from './nodeHttp'

/**
 * One-shot read of a node's own chain identity, for the custom-network config
 * form. Deliberately NOT used on the signing path — see getExpectedGenesisHash.
 *
 * Bounded by the same read ceiling as every other chain read; an unbounded
 * request would hang the config form on an unreachable host.
 */
export const fetchGenesisFromNode = async (
    algodUrl: string,
    token?: string,
): Promise<{ genesisHash: string; genesisId: string }> => {
    const base = algodUrl.endsWith('/') ? algodUrl.slice(0, -1) : algodUrl

    const { body: raw } = await createNodeHttpClient({
        url: base,
        tokenHeader: 'X-Algo-API-Token',
        token: token ?? '',
    }).get('/v2/transactions/params')

    const body = JSON.parse(new TextDecoder().decode(raw)) as {
        'genesis-hash'?: unknown
        'genesis-id'?: unknown
    }
    const genesisHash = body['genesis-hash']
    const genesisId = body['genesis-id']

    if (typeof genesisHash !== 'string' || genesisHash.length === 0) {
        throw new Error(`Node at ${base} returned no genesis hash`)
    }

    return {
        genesisHash,
        genesisId: typeof genesisId === 'string' ? genesisId : '',
    }
}
