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

    const algodAccounts = wallet.accounts.flatMap((account, index) => {
        const address = account.chains.algorand?.address
        if (!address) return []
        const held = assetsHeldBy(index, scale.assetsPerAccount, universe)
        return [
            mockAlgodAccountInformation({
                address,
                response: {
                    amount: NATIVE_BALANCE_MICROALGOS,
                    'amount-without-pending-rewards': NATIVE_BALANCE_MICROALGOS,
                    'min-balance':
                        BASE_MIN_BALANCE_MICROALGOS * (held.length + 1),
                    round: FIXTURE_ROUND,
                    assets: held.map(asset => ({
                        'asset-id': Number(asset.assetId),
                        amount: asset.decimals === 0 ? 1 : 1000,
                        'is-frozen': false,
                    })),
                    'total-assets-opted-in': held.length,
                },
            }),
        ]
    })

    return [
        mockShouldRefresh({ response: { refresh, round: FIXTURE_ROUND } }),
        ...algodAccounts,
        ...peraBackendHandlers(universe),
        ...(wallet.chainIds.length > 1
            ? [...peraEvmHandlers(), ...evmRpcHandlers()]
            : []),
    ]
}
