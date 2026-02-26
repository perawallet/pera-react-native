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

import type Decimal from 'decimal.js'
import {
    ALGO_ASSET,
    ALGO_ASSET_ID,
    toDecimalUnits,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import type { Arc59SendSummaryResponse } from '@perawallet/wallet-core-asa-inbox'
import {
    useArc59SendTransaction,
    useArc59ClaimTransaction,
} from '@perawallet/wallet-core-asa-inbox'
import {
    useAlgorandClient,
    useExpressTransaction,
} from '@perawallet/wallet-core-blockchain'
import { useTransactionSigner } from '@perawallet/wallet-core-signing'
import { WalletAccount } from 'accounts/dist'
import { InvalidSendParamsError } from '../errors'

type BaseSendParams = {
    sendMode: 'normal' | 'express' | 'sendArc59' | 'claimArc59' | 'rejectArc59'
    sender?: WalletAccount
    receiver?: string
    assetId?: string
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

type UseTransactionSendFlowParams = {
    params: SendParams | null
}

export const useTransactionSendFlow = () => {
    const { signTransactions } = useTransactionSigner()
    const algokit = useAlgorandClient(signTransactions)
    const { sendViaInbox } = useArc59SendTransaction(signTransactions)
    const { sendExpress } = useExpressTransaction(signTransactions)
    const { claimAsset, rejectAsset } =
        useArc59ClaimTransaction(signTransactions)
    const { data: assets } = useAssetsQuery()

    const executeSend = useCallback(
        async (params: SendTransactionParams): Promise<string> => {
            if (
                !params.assetId ||
                !params.sender ||
                !params.receiver ||
                params.amount == null
            ) {
                throw new InvalidSendParamsError()
            }

            const asset =
                params.assetId === ALGO_ASSET_ID
                    ? ALGO_ASSET
                    : assets.get(params.assetId)

            if (!asset) {
                throw new Error(`Asset ${params.assetId} not found`)
            }

            switch (params.sendMode) {
                case 'express': {
                    const result = await sendExpress({
                        sender: params.sender.address,
                        receiver: params.receiver,
                        assetId: BigInt(params.assetId),
                        amount: BigInt(
                            toDecimalUnits(params.amount, asset).toString(),
                        ),
                    })
                    return result.txIds[result.txIds.length - 1]
                }
                case 'sendArc59': {
                    if (!params.arc59Summary) {
                        throw new Error(
                            'Missing ARC59 summary for ARC59 transaction',
                        )
                    }
                    const result = await sendViaInbox({
                        sender: params.sender.address,
                        receiver: params.receiver,
                        assetId: BigInt(params.assetId),
                        amount: BigInt(
                            toDecimalUnits(params.amount, asset).toString(),
                        ),
                        summary: params.arc59Summary,
                    })
                    return result.txIds[result.txIds.length - 1]
                }
                case 'normal': {
                    if (params.assetId === ALGO_ASSET_ID) {
                        const result = await algokit.send.payment({
                            sender: params.sender.address,
                            receiver: params.receiver,
                            amount: params.isCloseAccount
                                ? BigInt(0).microAlgo()
                                : BigInt(
                                      toDecimalUnits(
                                          params.amount,
                                          ALGO_ASSET,
                                      ).toString(),
                                  ).microAlgo(),
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
                            amount: BigInt(
                                toDecimalUnits(params.amount, asset).toString(),
                            ),
                            assetId: BigInt(params.assetId),
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
            if (!params.assetId || !params.sender) {
                throw new InvalidSendParamsError()
            }

            if (params.sendMode === 'claimArc59') {
                const result = await claimAsset({
                    sender: params.sender.address,
                    assetId: BigInt(params.assetId),
                    shouldClaimAlgo: params.shouldClaimAlgo,
                })
                return result.txIds[result.txIds.length - 1]
            } else {
                const result = await rejectAsset({
                    sender: params.sender.address,
                    assetId: BigInt(params.assetId),
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
