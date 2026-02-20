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
import { useAlgorandClient } from './useAlgorandClient'
import type { PeraTransactionSigner } from '../models'
import { ASSET_MBR } from '../constants'

type SendExpressParams = {
    sender: string
    receiver: string
    assetId: bigint
    amount: bigint
}

type UseExpressTransactionResult = {
    sendExpress: (params: SendExpressParams) => Promise<{ txIds: string[] }>
}

export const useExpressTransaction = (
    signer: PeraTransactionSigner,
): UseExpressTransactionResult => {
    const algokit = useAlgorandClient(signer)

    const sendExpress = useCallback(
        async (params: SendExpressParams): Promise<{ txIds: string[] }> => {
            const { sender, receiver, assetId, amount } = params

            // Look up receiver's current balance to determine funding needed
            const { amount: currentBalance, minBalance: currentMbr } =
                await algokit.client.algod.accountInformation(receiver)

            // After opt-in the receiver's MBR increases by ASSET_MBR.
            // The opt-in tx fee is also paid from the receiver's balance.
            const suggestedParams = await algokit.getSuggestedParams()
            const mbrAfterOptIn = currentMbr + ASSET_MBR
            const balanceNeeded = mbrAfterOptIn + suggestedParams.minFee
            const fundingNeeded =
                balanceNeeded > currentBalance
                    ? balanceNeeded - currentBalance
                    : 0n

            const composer = algokit.newGroup()

            // Only add payment if the receiver needs funding
            if (fundingNeeded > 0n) {
                composer.addPayment({
                    sender,
                    receiver,
                    amount: fundingNeeded.microAlgo(),
                })
            }

            composer
                .addAssetOptIn({
                    sender: receiver,
                    assetId,
                })
                .addAssetTransfer({
                    sender,
                    receiver,
                    amount,
                    assetId,
                })

            const result = await composer.send()
            return { txIds: result.txIds }
        },
        [algokit],
    )

    return { sendExpress }
}
