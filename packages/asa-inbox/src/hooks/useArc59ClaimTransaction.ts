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
import { decodeAddress } from 'algosdk'
import {
    useAlgorandClient,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'
import { getArc59Config } from '@perawallet/wallet-core-config'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { ARC59Client } from '../clients'
import { buildGroup, buildPopulatedGroup } from '../utils'
import {
    BASE_CLAIM_TX_COUNT,
    BASE_REJECT_TX_COUNT,
    CLAIM_ALGO_TX_COUNT,
} from '../constants'

type ClaimParams = {
    sender: string
    assetId: bigint
    shouldClaimAlgo: boolean
    /**
     * The receiver's ARC-59 inbox account address. When a non-empty string,
     * the group is built with explicit resource references (no simulate). When
     * null/undefined, the flow falls back to simulate-based resource
     * population.
     */
    inboxAddress: Nullable<string>
}

type RejectParams = {
    sender: string
    assetId: bigint
    shouldClaimAlgo: boolean
    /** See {@link ClaimParams.inboxAddress}. */
    inboxAddress: Nullable<string>
    /**
     * The ASA creator address. ARC-59 reject closes the asset out to its
     * creator, so the creator MUST be referenced on the reject call.
     */
    assetCreator: string
}

type UseArc59ClaimTransactionResult = {
    buildClaimAssetTxs: (params: ClaimParams) => Promise<PeraTransaction[]>
    buildRejectAssetTxs: (params: RejectParams) => Promise<PeraTransaction[]>
}

export const useArc59ClaimTransaction = (): UseArc59ClaimTransactionResult => {
    const { network } = useNetwork()
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
            const { sender, assetId, shouldClaimAlgo, inboxAddress } = params
            const arc59Config = getArc59Config(network)

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

            // When the inbox address is known, attach the ARC-59 resource
            // references explicitly so the group builds without a live
            // simulate. The router box is keyed by the receiver's public key.
            const receiverBox = {
                appId: arc59Config.appId,
                name: decodeAddress(sender).publicKey,
            }
            const claimAlgoRefs = inboxAddress
                ? {
                      accountReferences: [inboxAddress],
                      boxReferences: [receiverBox],
                  }
                : {}
            const claimRefs = inboxAddress
                ? {
                      accountReferences: [inboxAddress],
                      assetReferences: [assetId],
                      boxReferences: [receiverBox],
                  }
                : {}

            if (shouldClaimAlgo) {
                composer.addAppCallMethodCall(
                    await appClient.params.arc59_claimAlgo({
                        args: [],
                        staticFee: 0n.microAlgo(),
                        ...claimAlgoRefs,
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
                    ...claimRefs,
                }),
            )

            return inboxAddress
                ? buildGroup(composer)
                : buildPopulatedGroup(composer, algokit)
        },
        [algokit, network, isOptedInToAsset],
    )

    const buildRejectAssetTxs = useCallback(
        async (params: RejectParams): Promise<PeraTransaction[]> => {
            const {
                sender,
                assetId,
                shouldClaimAlgo,
                inboxAddress,
                assetCreator,
            } = params
            const arc59Config = getArc59Config(network)

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

            // See buildClaimAssetTxs. Reject additionally references the ASA
            // creator, since the router closes the asset out to it.
            const receiverBox = {
                appId: arc59Config.appId,
                name: decodeAddress(sender).publicKey,
            }
            const claimAlgoRefs = inboxAddress
                ? {
                      accountReferences: [inboxAddress],
                      boxReferences: [receiverBox],
                  }
                : {}
            // Only take the explicit-ref (no-simulate) path when both the
            // inbox and the creator are known non-empty addresses. The ARC-59
            // asset schema types `creator.address` as `z.string()`, so a
            // degenerate backend value (empty string) is possible; attaching
            // it as an account reference would make algokit reject the group
            // at build time. Fall back to the simulate path instead.
            const rejectRefs =
                inboxAddress && assetCreator
                    ? {
                          accountReferences: [inboxAddress, assetCreator],
                          assetReferences: [assetId],
                          boxReferences: [receiverBox],
                      }
                    : {}

            if (shouldClaimAlgo) {
                composer.addAppCallMethodCall(
                    await appClient.params.arc59_claimAlgo({
                        args: [],
                        staticFee: 0n.microAlgo(),
                        ...claimAlgoRefs,
                    }),
                )
            }

            composer.addAppCallMethodCall(
                await appClient.params.arc59_reject({
                    args: [assetId],
                    staticFee: rejectFee.microAlgo(),
                    ...rejectRefs,
                }),
            )

            return inboxAddress && assetCreator
                ? buildGroup(composer)
                : buildPopulatedGroup(composer, algokit)
        },
        [algokit, network],
    )

    return { buildClaimAssetTxs, buildRejectAssetTxs }
}
