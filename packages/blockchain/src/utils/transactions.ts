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

import {
    TransactionType,
    type PaymentTransactionFields,
    type AssetTransferTransactionFields,
    type AssetConfigTransactionFields,
    type AssetFreezeTransactionFields,
    type KeyRegistrationTransactionFields,
    type AppCallTransactionFields,
    OnApplicationComplete,
    decodeTransaction
} from '@algorandfoundation/algokit-utils/transact'
import type {
    AssetConfigType,
    AssetTransferType,
    PeraDisplayableTransaction,
    PeraTransaction,
    PeraTransactionType,
} from '../models'
import { encodeAlgorandAddress } from './addresses'
import { OnCompletion } from '@algorandfoundation/algokit-utils/indexer-client'
import { decodeFromBase64 } from '@perawallet/wallet-core-shared'

export const mapToDisplayableTransaction = (
    tx: PeraTransaction,
): PeraDisplayableTransaction | null => {
    if (tx.type === TransactionType.Unknown) {
        return null
    }

    const displayTx: PeraDisplayableTransaction = {
        fee: tx.fee ?? 0n,
        firstValid: tx.firstValid,
        lastValid: tx.lastValid,
        sender: encodeAlgorandAddress(tx.sender.publicKey),
        txType: mapTransactionType(tx.type) as
            | 'pay'
            | 'keyreg'
            | 'acfg'
            | 'axfer'
            | 'afrz'
            | 'appl'
            | 'stpf'
            | 'hb',
        genesisId: tx.genesisId,
        genesisHash: tx.genesisHash,
        group: tx.group,
        lease: tx.lease,
        note: tx.note,
        rekeyTo: tx.rekeyTo,
        confirmedRound: 0n,
        roundTime: 0,
        intraRoundOffset: 0,
        signature: {},
    }

    // Map specific fields based on type
    switch (tx.type) {
        case TransactionType.Payment: {
            const paymentTx = tx.payment as PaymentTransactionFields
            displayTx.paymentTransaction = {
                amount: paymentTx.amount,
                receiver: encodeAlgorandAddress(paymentTx.receiver.publicKey),
                closeRemainderTo: paymentTx.closeRemainderTo
                    ? encodeAlgorandAddress(
                        paymentTx.closeRemainderTo.publicKey,
                    )
                    : undefined,
            }
            break
        }
        case TransactionType.AssetTransfer: {
            const axferTx = tx.assetTransfer as AssetTransferTransactionFields
            displayTx.assetTransferTransaction = {
                assetId: axferTx.assetId,
                amount: axferTx.amount,
                receiver: encodeAlgorandAddress(axferTx.receiver.publicKey),
                closeTo: axferTx.closeRemainderTo
                    ? encodeAlgorandAddress(axferTx.closeRemainderTo.publicKey)
                    : undefined,
                sender: axferTx.assetSender
                    ? encodeAlgorandAddress(axferTx.assetSender.publicKey)
                    : undefined,
            }
            break
        }
        case TransactionType.AssetConfig: {
            const acfgTx = tx.assetConfig as AssetConfigTransactionFields
            displayTx.assetConfigTransaction = {
                assetId: acfgTx.assetId,
                params: {
                    name: acfgTx.assetName,
                    unitName: acfgTx.unitName,
                    total: acfgTx.total ?? 0n,
                    decimals: acfgTx.decimals ?? 0,
                    defaultFrozen: acfgTx.defaultFrozen,
                    manager: acfgTx.manager
                        ? encodeAlgorandAddress(acfgTx.manager.publicKey)
                        : undefined,
                    reserve: acfgTx.reserve
                        ? encodeAlgorandAddress(acfgTx.reserve.publicKey)
                        : undefined,
                    freeze: acfgTx.freeze
                        ? encodeAlgorandAddress(acfgTx.freeze.publicKey)
                        : undefined,
                    clawback: acfgTx.clawback
                        ? encodeAlgorandAddress(acfgTx.clawback.publicKey)
                        : undefined,
                    url: acfgTx.url,
                    metadataHash: acfgTx.metadataHash,
                    creator: 'n/a',
                },
            }
            break
        }
        case TransactionType.AssetFreeze: {
            const afrzTx = tx.assetFreeze as AssetFreezeTransactionFields
            displayTx.assetFreezeTransaction = {
                assetId: afrzTx.assetId,
                address: afrzTx.freezeTarget
                    ? encodeAlgorandAddress(afrzTx.freezeTarget.publicKey)
                    : 'n/a',
                newFreezeStatus: afrzTx.frozen,
            }
            break
        }
        case TransactionType.KeyRegistration: {
            const keyregTx =
                tx.keyRegistration as KeyRegistrationTransactionFields
            displayTx.keyregTransaction = {
                voteFirstValid: keyregTx.voteFirst,
                voteLastValid: keyregTx.voteLast,
                voteKeyDilution: keyregTx.voteKeyDilution,
                selectionParticipationKey: keyregTx.selectionKey,
                voteParticipationKey: keyregTx.voteKey,
                nonParticipation: keyregTx.nonParticipation,
            }
            break
        }
        case TransactionType.AppCall: {
            const applTx = tx.appCall as AppCallTransactionFields
            displayTx.applicationTransaction = {
                applicationId: applTx.appId,
                onCompletion: mapOnCompletion(
                    applTx.onComplete,
                ) as OnCompletion,
                applicationArgs: applTx.args ? [...applTx.args] : [],
                accounts: applTx.accountReferences
                    ? [...applTx.accountReferences]
                    : [],
                foreignApps: applTx.appReferences
                    ? [...applTx.appReferences]
                    : [],
                foreignAssets: applTx.assetReferences
                    ? [...applTx.assetReferences]
                    : [],
                approvalProgram: applTx.approvalProgram,
                clearStateProgram: applTx.clearStateProgram,
                globalStateSchema: applTx.globalStateSchema
                    ? {
                        numByteSlices: Number(
                            applTx.globalStateSchema.numByteSlices,
                        ),
                        numUints: Number(applTx.globalStateSchema.numUints),
                    }
                    : undefined,
                localStateSchema: applTx.localStateSchema
                    ? {
                        numByteSlices: Number(
                            applTx.localStateSchema.numByteSlices,
                        ),
                        numUints: Number(applTx.localStateSchema.numUints),
                    }
                    : undefined,
            }
            break
        }
    }

    return displayTx
}

const mapTransactionType = (
    type: TransactionType,
): 'pay' | 'keyreg' | 'acfg' | 'axfer' | 'afrz' | 'appl' | 'stpf' | 'hb' => {
    switch (type) {
        case TransactionType.Payment:
            return 'pay'
        case TransactionType.AssetTransfer:
            return 'axfer'
        case TransactionType.AssetConfig:
            return 'acfg'
        case TransactionType.AssetFreeze:
            return 'afrz'
        case TransactionType.KeyRegistration:
            return 'keyreg'
        case TransactionType.AppCall:
            return 'appl'
        case TransactionType.StateProof:
            return 'stpf'
        case TransactionType.Heartbeat:
            return 'hb'
        default:
            return 'pay' // Fallback
    }
}

const mapOnCompletion = (oc: OnApplicationComplete): string => {
    if (typeof oc === 'string') return oc

    switch (Number(oc)) {
        case 0:
            return 'noop'
        case 1:
            return 'optin'
        case 2:
            return 'closeout'
        case 3:
            return 'clear'
        case 4:
            return 'update'
        case 5:
            return 'delete'
        default:
            return 'noop'
    }
}

export const getAssetTransferType = (
    tx: PeraDisplayableTransaction,
): AssetTransferType => {
    const assetTransfer = tx.assetTransferTransaction
    if (!assetTransfer) {
        return 'unknown'
    }

    const senderAddress = tx.sender
    const receiverAddress = assetTransfer.receiver
    const isToSelf = senderAddress === receiverAddress
    const isZeroAmount = assetTransfer.amount === 0n
    const hasCloseRemainder = !!assetTransfer.closeTo
    const hasAssetSender = !!assetTransfer.sender

    if (hasAssetSender) {
        return 'clawback'
    }

    if (isToSelf && isZeroAmount && !hasCloseRemainder) {
        return 'opt-in'
    }

    if (hasCloseRemainder) {
        return 'opt-out'
    }

    return 'transfer'
}

export const getAssetConfigType = (
    tx: PeraDisplayableTransaction,
): AssetConfigType => {
    const assetConfig = tx.assetConfigTransaction
    if (!assetConfig) {
        return 'update'
    }

    if (assetConfig.assetId === BigInt(0)) {
        return 'create'
    }

    const hasNoAddresses =
        assetConfig.params?.manager === undefined &&
        assetConfig.params?.reserve === undefined &&
        assetConfig.params?.freeze === undefined &&
        assetConfig.params?.clawback === undefined

    if (hasNoAddresses) {
        return 'destroy'
    }

    return 'update'
}

export const getTransactionType = (
    tx: PeraDisplayableTransaction,
): PeraTransactionType => {
    const type = tx.txType
    switch (type) {
        case 'pay':
            return 'payment'
        case 'axfer':
            return 'asset-transfer'
        case 'acfg':
            return 'asset-config'
        case 'afrz':
            return 'asset-freeze'
        case 'keyreg':
            return 'key-registration'
        case 'appl':
            return 'app-call'
        case 'stpf':
            return 'state-proof'
        case 'hb':
            return 'heartbeat'
        default:
            return 'unknown'
    }
}

export const isPaymentTransaction = (
    tx: PeraDisplayableTransaction,
): boolean => {
    return tx.txType === 'pay' && tx.paymentTransaction !== undefined
}

export const isAssetTransferTransaction = (
    tx: PeraDisplayableTransaction,
): boolean => {
    return tx.txType === 'axfer' && tx.assetTransferTransaction !== undefined
}

export const isAssetConfigTransaction = (
    tx: PeraDisplayableTransaction,
): boolean => {
    return tx.txType === 'acfg' && tx.assetConfigTransaction !== undefined
}

export const isAssetFreezeTransaction = (
    tx: PeraDisplayableTransaction,
): boolean => {
    return tx.txType === 'afrz' && tx.assetFreezeTransaction !== undefined
}

export const isKeyRegistrationTransaction = (
    tx: PeraDisplayableTransaction,
): boolean => {
    return tx.txType === 'keyreg'
}

export const isAppCallTransaction = (
    tx: PeraDisplayableTransaction,
): boolean => {
    return tx.txType === 'appl' && tx.applicationTransaction !== undefined
}

export const decodeAlgorandTransactions = (transactions: string[]): PeraTransaction[] => {
    return transactions.map(txn => decodeTransaction(decodeFromBase64(txn)))
}

