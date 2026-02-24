/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import { config } from '@perawallet/wallet-core-config'
import { useAlgorandClient } from './useAlgorandClient'
import type { PeraTransactionSigner } from '../models'
import arc59AppSpec from './arc59-app-spec.json'
import { AppClient } from '@algorandfoundation/algokit-utils/types/app-client'

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
    claimAsset: (params: ClaimParams) => Promise<{ txIds: string[] }>
    rejectAsset: (params: RejectParams) => Promise<{ txIds: string[] }>
}

export const useArc59ClaimTransaction = (
    signer: PeraTransactionSigner,
): UseArc59ClaimTransactionResult => {
    const { isMainnet } = useNetwork()
    const algokit = useAlgorandClient(signer)

    const isOptedInToAsset = useCallback(
        async (address: string, assetId: bigint): Promise<boolean> => {
            try {
                const accountInfo =
                    await algokit.client.algod.accountInformation(address)
                return (accountInfo.assets ?? []).some(
                    a => BigInt(a.assetId) === assetId,
                )
            } catch {
                return false
            }
        },
        [algokit],
    )

    const claimAsset = useCallback(
        async (params: ClaimParams): Promise<{ txIds: string[] }> => {
            const { sender, assetId, shouldClaimAlgo } = params
            const arc59Config = isMainnet
                ? config.arc59.mainnet
                : config.arc59.testnet

            const suggestedParams = await algokit.getSuggestedParams()

            const appClient = new AppClient({
                appSpec: JSON.stringify(arc59AppSpec),
                appId: arc59Config.appId,
                algorand: algokit,
                defaultSender: sender,
            })

            const composer = algokit.newGroup()

            if (shouldClaimAlgo) {
                composer.addAppCallMethodCall(
                    await appClient.params.call({
                        method: 'arc59_claimAlgo',
                        args: [],
                        extraFee: suggestedParams.minFee.microAlgo(),
                    }),
                )
            }

            const optedIn = await isOptedInToAsset(sender, assetId)

            if (!optedIn) {
                composer.addAssetOptIn({
                    sender,
                    assetId,
                })
            }

            composer.addAppCallMethodCall(
                await appClient.params.call({
                    method: 'arc59_claim',
                    args: [assetId],
                    extraFee: (suggestedParams.minFee * BigInt(2)).microAlgo(),
                }),
            )

            const result = await composer.send()
            return { txIds: result.txIds }
        },
        [algokit, isMainnet, isOptedInToAsset],
    )

    const rejectAsset = useCallback(
        async (params: RejectParams): Promise<{ txIds: string[] }> => {
            const { sender, assetId, shouldClaimAlgo } = params
            const arc59Config = isMainnet
                ? config.arc59.mainnet
                : config.arc59.testnet

            const suggestedParams = await algokit.getSuggestedParams()

            const appClient = new AppClient({
                appSpec: JSON.stringify(arc59AppSpec),
                appId: arc59Config.appId,
                algorand: algokit,
                defaultSender: sender,
            })

            const composer = algokit.newGroup()

            if (shouldClaimAlgo) {
                composer.addAppCallMethodCall(
                    await appClient.params.call({
                        method: 'arc59_claimAlgo',
                        args: [],
                        extraFee: suggestedParams.minFee.microAlgo(),
                    }),
                )
            }

            composer.addAppCallMethodCall(
                await appClient.params.call({
                    method: 'arc59_reject',
                    args: [assetId],
                    extraFee: (suggestedParams.minFee * BigInt(2)).microAlgo(),
                }),
            )

            const result = await composer.send()
            return { txIds: result.txIds }
        },
        [algokit, isMainnet],
    )

    return { claimAsset, rejectAsset }
}
