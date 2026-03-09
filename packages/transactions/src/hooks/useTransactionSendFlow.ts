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

import Decimal from 'decimal.js'
import { ALGO_ASSET_ID, PeraAsset } from '@perawallet/wallet-core-assets'
import type { Arc59SendSummaryResponse } from '@perawallet/wallet-core-asa-inbox'
import {
    useArc59SendTransaction,
    useArc59ClaimTransaction,
} from '@perawallet/wallet-core-asa-inbox'
import {
    ASSET_MBR,
    displayUnitsToBaseUnits,
    useAlgorandClient,
} from '@perawallet/wallet-core-blockchain'
import { useTransactionSigner } from '@perawallet/wallet-core-signing'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import { InvalidSendParamsError } from '../errors'

type BaseSendParams = {
    sendMode: 'normal' | 'express' | 'sendArc59' | 'claimArc59' | 'rejectArc59'
    sender?: WalletAccount
    receiver?: string
    asset?: PeraAsset
    amount?: Decimal
    note?: string
}

type SendTransactionParams = BaseSendParams & {
    sendMode: 'normal' | 'express' | 'sendArc59'
    note?: string
    isCloseAccount?: boolean
    arc59Summary?: Arc59SendSummaryResponse
}

type SendClaimParams = BaseSendParams & {
    sendMode: 'claimArc59' | 'rejectArc59'
    shouldClaimAlgo: boolean
}

type SendParams = SendTransactionParams | SendClaimParams

type SendExpressParams = {
    sender: string
    receiver: string
    assetId: bigint
    amount: bigint
}

type UseTransactionSendFlowParams = {
    params: SendParams | null
}

export const useTransactionSendFlow = () => {
    const { signTransactions } = useTransactionSigner()
    const algokit = useAlgorandClient(signTransactions)
    const { sendViaInbox } = useArc59SendTransaction(signTransactions)
    const { claimAsset, rejectAsset } =
        useArc59ClaimTransaction(signTransactions)

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

    const executeSend = useCallback(
        async (params: SendTransactionParams): Promise<string> => {
            if (
                !params.asset ||
                !params.asset.assetId ||
                !params.sender ||
                !params.receiver ||
                params.amount == null
            ) {
                throw new InvalidSendParamsError()
            }

            const assetDecimals = params.asset?.decimals ?? 0

            const amountInBaseUnits = BigInt(
                displayUnitsToBaseUnits(
                    params.amount,
                    assetDecimals ?? 0,
                ).toString(),
            )
            const assetId = BigInt(params.asset.assetId)

            switch (params.sendMode) {
                case 'express': {
                    const result = await sendExpress({
                        sender: params.sender.address,
                        receiver: params.receiver,
                        assetId,
                        amount: amountInBaseUnits,
                    })
                    return result.txIds[result.txIds.length - 1]
                }
                case 'sendArc59': {
                    if (!params.arc59Summary) {
                        throw new InvalidSendParamsError()
                    }

                    const result = await sendViaInbox({
                        sender: params.sender.address,
                        receiver: params.receiver,
                        assetId,
                        amount: amountInBaseUnits,
                        summary: params.arc59Summary,
                    })
                    return result.txIds[result.txIds.length - 1]
                }
                case 'normal': {
                    if (params.asset.assetId === ALGO_ASSET_ID) {
                        const result = await algokit.send.payment({
                            sender: params.sender.address,
                            receiver: params.receiver,
                            amount: params.isCloseAccount
                                ? BigInt(0).microAlgo()
                                : amountInBaseUnits.microAlgo(),
                            ...(params.isCloseAccount && {
                                closeRemainderTo: params.receiver,
                            }),
                            note: params.note,
                        })
                        return result.txIds[0]
                    } else {
                        const result = await algokit.send.assetTransfer({
                            sender: params.sender.address,
                            receiver: params.receiver,
                            amount: amountInBaseUnits,
                            assetId,
                            note: params.note,
                        })
                        return result.txIds[0]
                    }
                }
            }
        },
        [sendExpress, algokit, sendViaInbox],
    )

    const executeArc59 = useCallback(
        async (params: SendClaimParams): Promise<string> => {
            if (!params.asset || !params.sender) {
                throw new InvalidSendParamsError()
            }

            if (params.sendMode === 'claimArc59') {
                const result = await claimAsset({
                    sender: params.sender.address,
                    assetId: BigInt(params.asset.assetId),
                    shouldClaimAlgo: params.shouldClaimAlgo,
                })
                return result.txIds[result.txIds.length - 1]
            } else {
                const result = await rejectAsset({
                    sender: params.sender.address,
                    assetId: BigInt(params.asset.assetId),
                    shouldClaimAlgo: params.shouldClaimAlgo,
                })
                return result.txIds[result.txIds.length - 1]
            }
        },
        [claimAsset, rejectAsset],
    )

    const execute = useCallback(
        async ({ params }: UseTransactionSendFlowParams): Promise<string> => {
            if (!params) {
                throw new InvalidSendParamsError()
            }

            if (
                params.sendMode === 'claimArc59' ||
                params.sendMode === 'rejectArc59'
            ) {
                return await executeArc59(params)
            } else {
                return await executeSend(params as SendTransactionParams)
            }
        },
        [executeArc59, executeSend],
    )

    return { execute }
}

export type {
    SendTransactionParams,
    SendClaimParams,
    UseTransactionSendFlowParams,
}
