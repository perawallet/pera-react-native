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

import { useCallback } from 'react'
import { QueryObserver, useQueryClient } from '@tanstack/react-query'
import { getKnownAssetId } from '@perawallet/wallet-core-assets'
import {
    useAlgorandClient,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import type { Network, Nullable } from '@perawallet/wallet-core-shared'
import { cardQueryKeys } from './querykeys'

export const USDC_CREDIT_POLL_INTERVAL_MS = 1500
/** Generous: a swap lands within a round or two, but algod can lag behind the submit. */
export const USDC_CREDIT_TIMEOUT_MS = 45_000

export class UsdcCreditTimeoutError extends Error {
    constructor() {
        super('USDC credit not observed in time')
        this.name = 'UsdcCreditTimeoutError'
    }
}

type AlgorandClient = ReturnType<typeof useAlgorandClient>

const fetchUsdcBalance = async (
    algokit: AlgorandClient,
    network: Network,
    address: string,
): Promise<bigint> => {
    const usdcAssetId = getKnownAssetId('USDC', network)
    if (usdcAssetId === null) return 0n
    const info = await algokit.client.algod.accountInformation(address).do()
    const holding = info.assets?.find(
        asset => String(asset.assetId) === usdcAssetId,
    )
    return holding?.amount ?? 0n
}

type WaitForUsdcCreditParams = {
    address: string
    /** Base units held before the swap. */
    before: bigint
    /** Base units that must have arrived; the quote's minimum output. */
    minimum: bigint
}

export type UseCardUsdcCreditQueryResult = {
    /** The account's USDC holding in base units; 0 when not opted in. */
    readUsdcBalance: (address: string) => Promise<bigint>
    /** Resolves with the base units credited since `before` once `minimum` has landed. */
    waitForUsdcCredit: (params: WaitForUsdcCreditParams) => Promise<bigint>
}

/**
 * The swap groups pay their output to the swapper, and their submit resolves
 * at pool acceptance, so a deposit that follows a swap has to watch the
 * account until the USDC is actually there. The delta, not the quote, is what
 * gets deposited: the DEX may fill above the guaranteed minimum.
 *
 * The watch is a query observer rather than `useQuery` so it outlives the
 * screen that started it, like the deposit awaiting it.
 */
export const useCardUsdcCreditQuery = (): UseCardUsdcCreditQueryResult => {
    const queryClient = useQueryClient()
    const algokit = useAlgorandClient()
    const { network } = useNetwork()

    const readUsdcBalance = useCallback(
        (address: string): Promise<bigint> =>
            queryClient.fetchQuery({
                queryKey: cardQueryKeys.usdcBalance(network, address),
                queryFn: () => fetchUsdcBalance(algokit, network, address),
                // A baseline for the next credit: never a cached figure.
                staleTime: 0,
                gcTime: 0,
                retry: false,
            }),
        [queryClient, algokit, network],
    )

    const waitForUsdcCredit = useCallback(
        ({
            address,
            before,
            minimum,
        }: WaitForUsdcCreditParams): Promise<bigint> => {
            const deadline = Date.now() + USDC_CREDIT_TIMEOUT_MS
            const observer = new QueryObserver<Nullable<bigint>>(queryClient, {
                queryKey: cardQueryKeys.usdcCredit(network, {
                    address,
                    before,
                    minimum,
                    deadline,
                }),
                queryFn: async () => {
                    const delta =
                        (await fetchUsdcBalance(algokit, network, address)) -
                        before
                    if (delta > 0n && delta >= minimum) return delta
                    if (Date.now() >= deadline) {
                        throw new UsdcCreditTimeoutError()
                    }
                    return null
                },
                refetchInterval: query =>
                    query.state.status === 'success' &&
                    query.state.data === null
                        ? USDC_CREDIT_POLL_INTERVAL_MS
                        : false,
                // The deadline keeps running in the background, so the poll
                // must too.
                refetchIntervalInBackground: true,
                staleTime: Infinity,
                gcTime: 0,
                retry: false,
            })
            return new Promise<bigint>((resolve, reject) => {
                const unsubscribe = observer.subscribe(result => {
                    if (result.status === 'error') {
                        unsubscribe()
                        reject(result.error)
                    } else if (
                        result.data !== undefined &&
                        result.data !== null
                    ) {
                        unsubscribe()
                        resolve(result.data)
                    }
                })
            })
        },
        [queryClient, algokit, network],
    )

    return { readUsdcBalance, waitForUsdcCredit }
}
