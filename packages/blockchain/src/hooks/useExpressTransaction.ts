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
import { OPT_IN_MBR_COST } from '../constants'

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

            // Atomic group: pay MBR + opt-in receiver + transfer asset
            const result = await algokit
                .newGroup()
                .addPayment({
                    sender,
                    receiver,
                    amount: (OPT_IN_MBR_COST).microAlgo(), // 0.1 ALGO for asset opt-in MBR
                })
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
                .send()

            return { txIds: result.txIds }
        },
        [algokit],
    )

    return { sendExpress }
}
