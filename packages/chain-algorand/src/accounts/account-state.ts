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

import { Decimal } from 'decimal.js'
import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import type {
    AccountHoldingSnapshot,
    AccountStateReadHint,
    AccountStateSnapshot,
} from '@perawallet/wallet-core-accounts'
import type { AccountChainState } from '@perawallet/wallet-core-chain-contract'
import { getAlgorandClient } from '../blockchain'
import {
    type Network,
    type Nullable,
    type Optional,
    microAlgosToAlgos,
} from '@perawallet/wallet-core-shared'
import { algorandDescriptor } from '../descriptor'
import { HOLDINGS_PAGE_LIMIT } from './constants'

// algod rejects a full account read with HTTP 400 once total resources exceed
// MaxAPIResourcesPerAccount (default 1000). Below that, one call returns balance
// AND holdings from the same round — unlike the indexer, which lags by seconds
// and can hand back pre-transaction holdings right after a confirmation.
const MAX_INLINE_RESOURCES = 1000

const isResourceLimitError = (error: unknown): boolean =>
    error instanceof Error &&
    'status' in error &&
    (error as { status: unknown }).status === 400

const toRound = (round: Optional<bigint>): Nullable<number> =>
    round === undefined ? null : Number(round)

const minRound = (
    a: Nullable<number>,
    b: Nullable<number>,
): Nullable<number> => (a === null ? b : b === null ? a : Math.min(a, b))

/**
 * Prefers a single algod read so balance and holdings come from the same round.
 * Falls back to the split read (algod info plus paginated indexer holdings) when
 * the account exceeds algod's inline-resource cap — pre-emptively from the last
 * persisted counts, or reactively on a 400.
 */
async function fetchAccountSnapshot(
    algokit: AlgorandClient,
    address: string,
    priorResourceCount: number,
) {
    if (priorResourceCount < MAX_INLINE_RESOURCES) {
        try {
            const info = await algokit.client.algod
                .accountInformation(address)
                .do()
            const holdings: AccountHoldingSnapshot[] = (info.assets ?? []).map(
                asset => ({
                    assetId: `${asset.assetId}`,
                    amount: new Decimal((asset.amount ?? 0n).toString()),
                    isFrozen: asset.isFrozen ?? false,
                }),
            )
            return { info, holdings, observedRound: toRound(info.round) }
        } catch (error) {
            if (!isResourceLimitError(error)) throw error
        }
    }

    const info = await algokit.client.algod
        .accountInformation(address)
        .exclude('all')
        .do()
    const { holdings, currentRound } = await fetchAllHoldings(algokit, address)
    return {
        info,
        holdings,
        observedRound: minRound(toRound(info.round), currentRound),
    }
}

async function fetchAllHoldings(
    algokit: AlgorandClient,
    address: string,
): Promise<{
    holdings: AccountHoldingSnapshot[]
    currentRound: Nullable<number>
}> {
    const holdings: AccountHoldingSnapshot[] = []
    let currentRound: Nullable<number> = null
    let next: Optional<string>

    do {
        let request = algokit.client.indexer
            .lookupAccountAssets(address)
            .limit(HOLDINGS_PAGE_LIMIT)
        if (next) request = request.nextToken(next)
        const page = await request.do()
        currentRound = minRound(currentRound, toRound(page.currentRound))
        for (const asset of page.assets ?? []) {
            holdings.push({
                assetId: `${asset.assetId}`,
                amount: new Decimal((asset.amount ?? 0n).toString()),
                isFrozen: asset.isFrozen ?? false,
            })
        }
        next = page.nextToken
    } while (next)

    return { holdings, currentRound }
}

export async function fetchAlgorandAccountState(
    address: string,
    network: Network,
    { priorResourceCount }: AccountStateReadHint,
): Promise<AccountStateSnapshot> {
    const { info, holdings, observedRound } = await fetchAccountSnapshot(
        getAlgorandClient(network),
        address,
        priorResourceCount,
    )

    // ALGO is persisted as a regular holding in base units, so the home-screen
    // reads sort, filter and paginate it uniformly alongside ASAs with no
    // synthetic-row union in the hot path. Its metadata is seeded at startup and
    // its price syncs under id '0', so the join resolves it like any asset.
    holdings.unshift({
        assetId: algorandDescriptor.nativeAsset.ref.assetId,
        amount: new Decimal(info.amount.toString()),
        isFrozen: false,
    })

    const totalAssetsOptedIn = info.totalAssetsOptedIn ?? 0
    const totalCreatedAssets = info.totalCreatedAssets ?? 0
    const totalAppsOptedIn = info.totalAppsOptedIn ?? 0
    const authAddress = info.authAddr?.toString() ?? null

    return {
        nativeBalance: microAlgosToAlgos(info.amount),
        nativeBalanceBaseUnits: new Decimal(info.amount.toString()),
        minBalance: microAlgosToAlgos(info.minBalance),
        totalAssetsOptedIn,
        totalCreatedAssets,
        totalAppsOptedIn,
        status: info.status ?? 'Offline',
        authAddress,
        chainState: {
            family: 'algorand',
            ...(authAddress === null ? {} : { authAddress }),
            minBalance: new Decimal(info.minBalance.toString()),
            status: toParticipationStatus(info.status),
            totalAssetsOptedIn,
            totalCreatedAssets,
            totalAppsOptedIn,
        },
        holdings,
        observedRound,
    }
}

type ParticipationStatus = Extract<
    AccountChainState,
    { family: 'algorand' }
>['status']

// algod types status as a bare string; anything unrecognised reads as Offline,
// the same default the balance row uses.
const toParticipationStatus = (
    status: Optional<string>,
): ParticipationStatus =>
    status === 'Online' || status === 'NotParticipating' ? status : 'Offline'
