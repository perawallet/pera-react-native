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
import { useAlgorandClient } from '../hooks/useAlgorandClient'
import { ARC59_CONFIG } from './constants'
import type { Arc59SendSummaryResponse } from './schema'
import type { PeraTransactionSigner } from '../models'
import arc59AppSpec from './arc59-app-spec.json'
import { AppClient } from '@algorandfoundation/algokit-utils/types/app-client'

type SendViaInboxParams = {
    sender: string
    receiver: string
    assetId: bigint
    amount: bigint
    summary: Arc59SendSummaryResponse
}

type UseArc59TransactionResult = {
    sendViaInbox: (params: SendViaInboxParams) => Promise<{ txIds: string[] }>
}

export const useArc59Transaction = (
    signer: PeraTransactionSigner,
): UseArc59TransactionResult => {
    const { isMainnet } = useNetwork()
    const algokit = useAlgorandClient(signer)

    const sendViaInbox = useCallback(
        async (params: SendViaInboxParams): Promise<{ txIds: string[] }> => {
            const { sender, receiver, assetId, amount, summary } = params
            const config = isMainnet
                ? ARC59_CONFIG.mainnet
                : ARC59_CONFIG.testnet

            const appClient = new AppClient({
                appSpec: JSON.stringify(arc59AppSpec),
                appId: config.appId,
                algorand: algokit,
                defaultSender: sender,
            })

            // If router is not opted into the asset, opt it in first
            if (!summary.is_arc59_opted_in) {
                await appClient.send.call({
                    method: 'arc59_optRouterIn',
                    args: [assetId],
                    extraFee: (1000).microAlgo(),
                })
            }

            const composer = algokit.newGroup()

            // If algoFundAmount > 0: add MBR payment to cover inbox costs
            if (summary.algo_fund_amount > 0) {
                composer.addPayment({
                    sender,
                    receiver: config.appAddress,
                    amount: BigInt(summary.algo_fund_amount).microAlgo(),
                })
            }

            // Add asset transfer to ARC59 app
            composer.addAssetTransfer({
                sender,
                receiver: config.appAddress,
                amount,
                assetId,
            })

            // Call arc59_sendAsset with fee pooling for inner transactions
            composer.addAppCallMethodCall(
                await appClient.params.call({
                    method: 'arc59_sendAsset',
                    args: [
                        algokit.createTransaction.assetTransfer({
                            sender,
                            receiver: config.appAddress,
                            amount,
                            assetId,
                        }),
                        receiver,
                        0,
                    ],
                    extraFee: (1000 * summary.inner_tx_count).microAlgo(),
                }),
            )

            const result = await composer.send()
            return { txIds: result.txIds }
        },
        [algokit, isMainnet],
    )

    return { sendViaInbox }
}
