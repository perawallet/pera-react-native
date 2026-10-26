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
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { SeededWallet } from '../data/seedWallet'
import { assetsHeldBy, benchAssets } from '../data/generators'
import type { BenchScale } from '../runner/types'
import {
    evmRpcHandlers,
    mockAlgodAccountInformation,
    mockShouldRefresh,
    peraEvmHandlers,
} from './handlers'

const ALGO_TOTAL_SUPPLY = '10000000000000000'
const FIXTURE_ROUND = 100
const BASE_MIN_BALANCE_MICROALGOS = 100_000
const NATIVE_BALANCE_MICROALGOS = 5_000_000_000
// algod's MaxAPIResourcesPerAccount default: a full account read past it is a 400.
const MAX_INLINE_RESOURCES = 1000

const assetWire = (asset: PeraAsset) => {
    const collectible = asset.peraMetadata?.collectible
    return {
        asset_id: asset.assetId,
        name: asset.name,
        unit_name: asset.unitName,
        fraction_decimals: asset.decimals,
        total: asset.totalSupply.toString(),
        verification_tier: 'unverified',
        is_deleted: false,
        creator: { address: asset.creator.address },
        category: null,
        type: asset.peraMetadata?.type,
        ...(collectible && {
            collectible: {
                title: collectible.title,
                media_type: 'image',
                explorer_url: 'https://explorer.invalid/nft',
                ...(collectible.collection && {
                    collection: { name: collectible.collection.name },
                }),
            },
        }),
    }
}

const idsFromBody = (body: string): string[] => {
    const match = /"asset_ids":(\[[^\]]*\])/.exec(body)
    return match
        ? (JSON.parse(match[1]) as (string | number)[]).map(String)
        : []
}

/**
 * The Pera backend's asset, price and history endpoints, answering from the
 * generated universe: each request gets exactly the ids it asked for, in the
 * wire shape the app parses. History is answered empty; the history read is
 * measured by the `db.history-page` scenario.
 */
const peraBackendHandlers = (
    universe: readonly PeraAsset[],
): RequestHandler[] => {
    const byId = new Map(universe.map(asset => [asset.assetId, asset]))
    const assetsFor = (ids: string[]) => ({
        results: ids.flatMap(id => {
            const asset = byId.get(id)
            return asset ? [assetWire(asset)] : []
        }),
        next: null,
    })

    return [
        http.get('*/v1/assets/', ({ request }) =>
            HttpResponse.json(
                assetsFor(
                    (new URL(request.url).searchParams.get('asset_ids') ?? '')
                        .split(',')
                        .filter(Boolean),
                ),
            ),
        ),
        http.post('*/v2/assets/', async ({ request }) =>
            HttpResponse.json(assetsFor(idsFromBody(await request.text()))),
        ),
        http.get('*/v1/public/assets/:assetId/', ({ params }) =>
            HttpResponse.json({
                asset_id: String(params.assetId),
                name: 'Algo',
                unit_name: 'ALGO',
                fraction_decimals: 6,
                total_supply: ALGO_TOTAL_SUPPLY,
                total_supply_as_str: ALGO_TOTAL_SUPPLY,
                verification_tier: 'verified',
                is_collectible: false,
            }),
        ),
        // Every third asset has no price, as the seeded prices leave it.
        http.get('*/api/v3/asset-prices', ({ request }) =>
            HttpResponse.json(
                (new URL(request.url).searchParams.get('asset_ids') ?? '')
                    .split(',')
                    .filter(Boolean)
                    .map(id => ({
                        asset_id: id,
                        price:
                            (Number(id) - Number(universe[0]?.assetId ?? 0)) %
                                3 ===
                            0
                                ? null
                                : '0.5',
                        currency: 'USD',
                    })),
            ),
        ),
        http.get('*/v1/accounts/:address/transactions/', () =>
            HttpResponse.json({
                current_round: FIXTURE_ROUND,
                next: null,
                previous: null,
                results: [],
            }),
        ),
    ]
}

/**
 * An account read as algod and the indexer answer it: inline up to algod's
 * resource cap and a 400 past it, `exclude=all` always, and the holdings paged
 * from the indexer, which the app reads instead once the account it last
 * stored reaches the cap.
 */
const accountReadHandlers = (
    address: string,
    held: readonly PeraAsset[],
): RequestHandler[] => {
    const holdings = held.map(asset => ({
        'asset-id': Number(asset.assetId),
        amount: asset.decimals === 0 ? 1 : 1000,
        'is-frozen': false,
    }))
    // `exclude=all` drops the resource arrays but keeps every scalar.
    const account = {
        amount: NATIVE_BALANCE_MICROALGOS,
        'amount-without-pending-rewards': NATIVE_BALANCE_MICROALGOS,
        'min-balance': BASE_MIN_BALANCE_MICROALGOS * (held.length + 1),
        'pending-rewards': 0,
        rewards: 0,
        round: FIXTURE_ROUND,
        status: 'Offline' as const,
        'apps-total-schema': { 'num-byte-slice': 0, 'num-uint': 0 },
        'total-apps-opted-in': 0,
        'total-assets-opted-in': held.length,
        'total-created-apps': 0,
        'total-created-assets': 0,
    }
    const isOverCap = held.length > MAX_INLINE_RESOURCES

    return [
        // Answers only what the next handler must not: returning nothing
        // falls through to it.
        http.get(`*/v2/accounts/${address}`, ({ request }) => {
            const isExcludeAll =
                new URL(request.url).searchParams.get('exclude') === 'all'
            if (isExcludeAll) {
                return HttpResponse.json({ ...account, address })
            }
            if (isOverCap) {
                return HttpResponse.json(
                    { message: 'MaxAPIResourcesPerAccount exceeded' },
                    { status: 400 },
                )
            }
            return undefined
        }),
        mockAlgodAccountInformation({
            address,
            response: { ...account, assets: holdings },
        }),
        http.get(`*/v2/accounts/${address}/assets`, ({ request }) => {
            const params = new URL(request.url).searchParams
            const limit = Number(params.get('limit') ?? MAX_INLINE_RESOURCES)
            const start = Number(params.get('next') ?? 0)
            const end = Math.min(start + limit, holdings.length)
            return HttpResponse.json({
                'current-round': FIXTURE_ROUND,
                assets: holdings.slice(start, end),
                ...(end < holdings.length && { 'next-token': String(end) }),
            })
        }),
    ]
}

export type SyncFixtureOptions = {
    /** What the change signal answers: true makes every tick read every account. */
    refresh: boolean
}

/** Everything one sync tick over the seeded wallet asks of the network. */
export const syncFixtureHandlers = (
    wallet: SeededWallet,
    scale: BenchScale,
    { refresh }: SyncFixtureOptions,
): RequestHandler[] => {
    const universe = benchAssets(scale.heavyAccountAssets)

    const accountReads = wallet.accounts.flatMap((account, index) => {
        const address = account.chains.algorand?.address
        if (!address) return []
        return accountReadHandlers(
            address,
            assetsHeldBy(index, scale.assetsPerAccount, universe),
        )
    })

    return [
        mockShouldRefresh({ response: { refresh, round: FIXTURE_ROUND } }),
        ...accountReads,
        ...peraBackendHandlers(universe),
        ...(wallet.chainIds.length > 1
            ? [...peraEvmHandlers(), ...evmRpcHandlers()]
            : []),
    ]
}
