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

import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import type { modelsv2 } from 'algosdk'
import {
    CHART_QUERY_TIMEOUT_MS,
    queryClient,
    type HistoryPeriod,
    type Network,
} from '@perawallet/wallet-core-shared'

import type {
    AccountAssetBalanceHistoryResponse,
    AccountBalanceHistoryResponse,
} from '../models'
import { HOLDINGS_PAGE_LIMIT } from '../constants'

export type OnChainAccountInformationResponse = Awaited<
    ReturnType<typeof fetchOnChainAccountInformation>
>

export const fetchOnChainAccountInformation = (
    algokit: AlgorandClient,
    address: string,
): Promise<modelsv2.Account> =>
    algokit.client.algod.accountInformation(address).do()

/**
 * Opt-in round per held asset, keyed by decimal asset-id string. Read from the
 * indexer, the only source that exposes it (algod and the Pera API don't).
 * Rounds fit safely in a JS number.
 */
export const fetchAccountAssetOptInRounds = async (
    algokit: AlgorandClient,
    address: string,
): Promise<Map<string, number>> => {
    const rounds = new Map<string, number>()
    let next: string | undefined

    do {
        let request = algokit.client.indexer
            .lookupAccountAssets(address)
            .limit(HOLDINGS_PAGE_LIMIT)
        if (next) request = request.nextToken(next)
        const page = await request.do()
        for (const holding of page.assets ?? []) {
            if (holding.optedInAtRound === undefined) continue
            rounds.set(`${holding.assetId}`, Number(holding.optedInAtRound))
        }
        next = page.nextToken
    } while (next)

    return rounds
}

export const getAccountsBalanceHistoryEndpointPath = () => `/v1/wallet/wealth/`

export const fetchAccountsBalanceHistory = async (
    addresses: string[],
    period: HistoryPeriod,
    network: Network,
): Promise<AccountBalanceHistoryResponse> => {
    const endpointPath = getAccountsBalanceHistoryEndpointPath()
    const response = await queryClient<AccountBalanceHistoryResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: endpointPath,
        params: {
            account_addresses: addresses,
            period,
        },
        timeout: CHART_QUERY_TIMEOUT_MS,
    })
    return response.data
}

export const getAccountAssetBalanceHistoryEndpointPath = (
    address: string,
    assetId: string,
) => `/v1/accounts/${address}/assets/${assetId}/balance-history/`

export const fetchAccountAssetBalanceHistory = async (
    address: string,
    assetId: string,
    period: HistoryPeriod,
    currency: string,
    network: Network,
): Promise<AccountAssetBalanceHistoryResponse> => {
    const endpointPath = getAccountAssetBalanceHistoryEndpointPath(
        address,
        assetId,
    )
    const response = await queryClient<AccountAssetBalanceHistoryResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: endpointPath,
        params: {
            period,
            currency,
        },
        timeout: CHART_QUERY_TIMEOUT_MS,
    })
    return response.data
}
