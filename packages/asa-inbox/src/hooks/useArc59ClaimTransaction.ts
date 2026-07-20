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
import {
    useAlgorandClient,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'
import { config } from '@perawallet/wallet-core-config'
import { ARC59Client } from '../clients'
import { buildPopulatedGroup } from '../utils'
import {
    BASE_CLAIM_TX_COUNT,
    BASE_REJECT_TX_COUNT,
    CLAIM_ALGO_TX_COUNT,
} from '../constants'

type ClaimParams = {
    sender: string
    assetId: bigint
    shouldClaimAlgo: boolean
}

type RejectParams = {
    sender: string
    assetId: bigint
    shouldClaimAlgo: boolean
}

type UseArc59ClaimTransactionResult = {
    buildClaimAssetTxs: (params: ClaimParams) => Promise<PeraTransaction[]>
    buildRejectAssetTxs: (params: RejectParams) => Promise<PeraTransaction[]>
}

export const useArc59ClaimTransaction = (): UseArc59ClaimTransactionResult => {
    const { isMainnet } = useNetwork()
    const algokit = useAlgorandClient()

    const isOptedInToAsset = useCallback(
        async (address: string, assetId: bigint): Promise<boolean> => {
            try {
                const accountInfo = await algokit.client.algod
                    .accountInformation(address)
                    .do()
                return (accountInfo.assets ?? []).some(
                    a => BigInt(a.assetId) === assetId,
                )
            } catch {
                return false
            }
        },
        [algokit],
    )

    const buildClaimAssetTxs = useCallback(
        async (params: ClaimParams): Promise<PeraTransaction[]> => {
            const { sender, assetId, shouldClaimAlgo } = params
            const arc59Config = isMainnet
                ? config.arc59.mainnet
                : config.arc59.testnet

            const suggestedParams = await algokit.getSuggestedParams()

            const appClient = new ARC59Client({
                appId: arc59Config.appId,
                algorand: algokit,
                defaultSender: sender,
            })

            const composer = algokit.newGroup()
            const optedIn = await isOptedInToAsset(sender, assetId)

            // Calculate main call fee dynamically
            // Base: 3 * minFee (claim itself + 2 inner txns)
            const minFee = BigInt(suggestedParams.minFee)
            let claimFee = BigInt(BASE_CLAIM_TX_COUNT) * minFee
            if (shouldClaimAlgo)
                claimFee += BigInt(CLAIM_ALGO_TX_COUNT) * minFee
            if (!optedIn) claimFee += minFee

            if (shouldClaimAlgo) {
                composer.addAppCallMethodCall(
                    await appClient.params.arc59_claimAlgo({
                        args: [],
                        staticFee: 0n.microAlgo(),
                    }),
                )
            }

            if (!optedIn) {
                composer.addAssetOptIn({
                    sender,
                    assetId,
                    staticFee: 0n.microAlgo(),
                })
            }

            composer.addAppCallMethodCall(
                await appClient.params.arc59_claim({
                    args: [assetId],
                    staticFee: claimFee.microAlgo(),
                }),
            )

            return buildPopulatedGroup(composer, algokit)
        },
        [algokit, isMainnet, isOptedInToAsset],
    )

    const buildRejectAssetTxs = useCallback(
        async (params: RejectParams): Promise<PeraTransaction[]> => {
            const { sender, assetId, shouldClaimAlgo } = params
            const arc59Config = isMainnet
                ? config.arc59.mainnet
                : config.arc59.testnet

            const suggestedParams = await algokit.getSuggestedParams()

            const appClient = new ARC59Client({
                appId: arc59Config.appId,
                algorand: algokit,
                defaultSender: sender,
            })

            const composer = algokit.newGroup()

            // Calculate main call fee dynamically
            // Base: 3 * minFee (reject itself + 2 inner txns)
            const minFee = BigInt(suggestedParams.minFee)
            let rejectFee = BigInt(BASE_REJECT_TX_COUNT) * minFee
            if (shouldClaimAlgo)
                rejectFee += BigInt(CLAIM_ALGO_TX_COUNT) * minFee

            if (shouldClaimAlgo) {
                composer.addAppCallMethodCall(
                    await appClient.params.arc59_claimAlgo({
                        args: [],
                        staticFee: 0n.microAlgo(),
                    }),
                )
            }

            composer.addAppCallMethodCall(
                await appClient.params.arc59_reject({
                    args: [assetId],
                    staticFee: rejectFee.microAlgo(),
                }),
            )

            return buildPopulatedGroup(composer, algokit)
        },
        [algokit, isMainnet],
    )

    return { buildClaimAssetTxs, buildRejectAssetTxs }
}
