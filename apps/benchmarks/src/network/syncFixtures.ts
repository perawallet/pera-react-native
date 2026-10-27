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
import { evmRpcHandlers, mockShouldRefresh, peraEvmHandlers } from './handlers'

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
 * Account reads as algod and the indexer answer them: inline up to algod's
 * resource cap and a 400 past it, `exclude=all` always, and the holdings paged
 * from the indexer, which the app reads instead once the account it last
 * stored reaches the cap.
 *
 * One handler per route, never per account: MSW tries every handler in turn
 * for every request, so per-account handlers made the fixture's own matching
 * grow with accounts x requests and dominate the time the sync rows report.
 */
const accountReadHandlers = (
    heldByAddress: ReadonlyMap<string, readonly PeraAsset[]>,
    amounts: FixtureAmounts,
): RequestHandler[] => {
    const holdingsOf = (held: readonly PeraAsset[]) =>
        held.map(asset => ({
            'asset-id': Number(asset.assetId),
            amount: (asset.decimals === 0 ? 1 : 1000) + (amounts.variant % 2),
            'is-frozen': false,
        }))
    // `exclude=all` drops the resource arrays but keeps every scalar.
    const scalarsOf = (address: string, held: readonly PeraAsset[]) => ({
        address,
        amount: NATIVE_BALANCE_MICROALGOS,
        'amount-without-pending-rewards': NATIVE_BALANCE_MICROALGOS,
        'min-balance': BASE_MIN_BALANCE_MICROALGOS * (held.length + 1),
        'pending-rewards': 0,
        rewards: 0,
        round: FIXTURE_ROUND,
        status: 'Offline',
        'apps-total-schema': { 'num-byte-slice': 0, 'num-uint': 0 },
        'total-apps-opted-in': 0,
        'total-assets-opted-in': held.length,
        'total-created-apps': 0,
        'total-created-assets': 0,
    })

    return [
        // An address outside the wallet gets no answer, so it shows up as unhandled.
        http.get('*/v2/accounts/:address', ({ params, request }) => {
            const address = String(params.address)
            const held = heldByAddress.get(address)
            if (!held) return undefined
            if (new URL(request.url).searchParams.get('exclude') === 'all') {
                return HttpResponse.json(scalarsOf(address, held))
            }
            if (held.length > MAX_INLINE_RESOURCES) {
                return HttpResponse.json(
                    { message: 'MaxAPIResourcesPerAccount exceeded' },
                    { status: 400 },
                )
            }
            return HttpResponse.json({
                ...scalarsOf(address, held),
                assets: holdingsOf(held),
                'created-assets': [],
                'apps-local-state': [],
                'created-apps': [],
            })
        }),
        http.get('*/v2/accounts/:address/assets', ({ params, request }) => {
            const held = heldByAddress.get(String(params.address))
            if (!held) return undefined
            const query = new URL(request.url).searchParams
            const limit = Number(query.get('limit') ?? MAX_INLINE_RESOURCES)
            const start = Number(query.get('next') ?? 0)
            const end = Math.min(start + limit, held.length)
            return HttpResponse.json({
                'current-round': FIXTURE_ROUND,
                assets: holdingsOf(held.slice(start, end)),
                ...(end < held.length && { 'next-token': String(end) }),
            })
        }),
    ]
}

/**
 * Which of two amount sets the account reads answer. Every holding differs by
 * one between them, so bumping `variant` makes the next account read a change
 * the sync has to write; leaving it alone makes the read a no-op diff.
 */
export type FixtureAmounts = { variant: number }

export type SyncFixtureOptions = {
    /** What the change signal answers: true makes every tick read every account. */
    refresh: boolean
    amounts?: FixtureAmounts
}

/** Everything one sync tick over the seeded wallet asks of the network. */
export const syncFixtureHandlers = (
    wallet: SeededWallet,
    scale: BenchScale,
    { refresh, amounts = { variant: 0 } }: SyncFixtureOptions,
): RequestHandler[] => {
    const universe = benchAssets(scale.heavyAccountAssets)

    const heldByAddress = new Map(
        wallet.accounts.flatMap((account, index) => {
            const address = account.chains.algorand?.address
            return address
                ? [
                      [
                          address,
                          assetsHeldBy(index, scale.assetsPerAccount, universe),
                      ] as const,
                  ]
                : []
        }),
    )

    return [
        mockShouldRefresh({ response: { refresh, round: FIXTURE_ROUND } }),
        ...accountReadHandlers(heldByAddress, amounts),
        ...peraBackendHandlers(universe),
        ...(wallet.chainIds.length > 1
            ? [...peraEvmHandlers(), ...evmRpcHandlers()]
            : []),
    ]
}
