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

import { TransactionType, type OnApplicationComplete } from 'algosdk'
import type {
    AssetConfigType,
    AssetTransferType,
    PeraDisplayableTransaction,
    PeraTransaction,
    PeraTransactionType,
} from '../models'
import { encodeAlgorandAddress } from './addresses'

import type { Nullable } from '@perawallet/wallet-core-shared'

export const mapIndexerTxToDisplayableTransaction = (
    tx: PeraDisplayableTransaction,
): PeraDisplayableTransaction => {
    return {
        ...tx,
        roundTimeMillis: tx.roundTime ? Number(tx.roundTime) * 1000 : undefined,
    }
}

export const mapToDisplayableTransaction = (
    tx: PeraTransaction,
): Nullable<PeraDisplayableTransaction> => {
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
        genesisId: tx.genesisID,
        genesisHash: tx.genesisHash,
        group: tx.group,
        lease: tx.lease,
        note: tx.note,
        rekeyTo: tx.rekeyTo,
        rawTransaction: tx,
    }

    // Map specific fields based on type
    switch (tx.type) {
        case TransactionType.pay: {
            const paymentTx = tx.payment!
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
        case TransactionType.axfer: {
            const axferTx = tx.assetTransfer!
            displayTx.assetTransferTransaction = {
                assetId: axferTx.assetIndex,
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
        case TransactionType.acfg: {
            const acfgTx = tx.assetConfig!
            displayTx.assetConfigTransaction = {
                assetId: acfgTx.assetIndex,
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
                    url: acfgTx.assetURL,
                    metadataHash: acfgTx.assetMetadataHash,
                    creator: '',
                },
            }
            break
        }
        case TransactionType.afrz: {
            const afrzTx = tx.assetFreeze!
            displayTx.assetFreezeTransaction = {
                assetId: afrzTx.assetIndex,
                address: afrzTx.freezeAccount
                    ? encodeAlgorandAddress(afrzTx.freezeAccount.publicKey)
                    : '',
                newFreezeStatus: afrzTx.frozen,
            }
            break
        }
        case TransactionType.keyreg: {
            const keyregTx = tx.keyreg!
            displayTx.keyregTransaction = {
                voteFirstValid: keyregTx.voteFirst,
                voteLastValid: keyregTx.voteLast,
                voteKeyDilution: keyregTx.voteKeyDilution,
                selectionParticipationKey: keyregTx.selectionKey,
                voteParticipationKey: keyregTx.voteKey,
                stateProofKey: keyregTx.stateProofKey,
                nonParticipation: keyregTx.nonParticipation,
            }
            break
        }
        case TransactionType.appl: {
            const applTx = tx.applicationCall!
            displayTx.applicationTransaction = {
                applicationId: applTx.appIndex,
                onCompletion: mapOnCompletion(applTx.onComplete),
                applicationArgs: applTx.appArgs ? [...applTx.appArgs] : [],
                accounts: applTx.accounts ? [...applTx.accounts] : [],
                foreignApps: applTx.foreignApps ? [...applTx.foreignApps] : [],
                foreignAssets: applTx.foreignAssets
                    ? [...applTx.foreignAssets]
                    : [],
                approvalProgram: applTx.approvalProgram,
                clearStateProgram: applTx.clearProgram,
                globalStateSchema: {
                    numByteSlice: Number(applTx.numGlobalByteSlices),
                    numUint: Number(applTx.numGlobalInts),
                },
                localStateSchema: {
                    numByteSlice: Number(applTx.numLocalByteSlices),
                    numUint: Number(applTx.numLocalInts),
                },
            }
            break
        }
    }

    return displayTx
}

const transactionTypeMap: Record<
    TransactionType,
    'pay' | 'keyreg' | 'acfg' | 'axfer' | 'afrz' | 'appl' | 'stpf' | 'hb'
> = {
    [TransactionType.pay]: 'pay',
    [TransactionType.axfer]: 'axfer',
    [TransactionType.acfg]: 'acfg',
    [TransactionType.afrz]: 'afrz',
    [TransactionType.keyreg]: 'keyreg',
    [TransactionType.appl]: 'appl',
    [TransactionType.stpf]: 'stpf',
    [TransactionType.hb]: 'hb',
}

const mapTransactionType = (
    type: TransactionType,
): 'pay' | 'keyreg' | 'acfg' | 'axfer' | 'afrz' | 'appl' | 'stpf' | 'hb' => {
    return transactionTypeMap[type] ?? 'pay'
}

const onCompletionMap: Record<number, string> = {
    0: 'noop',
    1: 'optin',
    2: 'closeout',
    3: 'clear',
    4: 'update',
    5: 'delete',
}

const mapOnCompletion = (oc: OnApplicationComplete): string => {
    if (typeof oc === 'string') return oc
    return onCompletionMap[Number(oc)] ?? 'noop'
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

const txTypeToPeraTypeMap: Record<string, PeraTransactionType> = {
    pay: 'payment',
    axfer: 'asset-transfer',
    acfg: 'asset-config',
    afrz: 'asset-freeze',
    keyreg: 'key-registration',
    appl: 'app-call',
    stpf: 'state-proof',
    hb: 'heartbeat',
}

export const getTransactionType = (
    tx: PeraDisplayableTransaction,
): PeraTransactionType => {
    return txTypeToPeraTypeMap[tx.txType ?? ''] ?? 'unknown'
}

/**
 * Classify a raw PeraTransaction into a detailed PeraTransactionType,
 * including asset transfer sub-types (opt-in, opt-out, clawback).
 */
const ASSET_TRANSFER_TYPE_MAP = {
    'opt-in': 'asset-opt-in',
    'opt-out': 'asset-opt-out',
    clawback: 'asset-clawback',
    transfer: 'asset-transfer',
    unknown: 'asset-transfer',
} as const satisfies Record<AssetTransferType, PeraTransactionType>

/**
 * Classify a PeraDisplayableTransaction into a detailed PeraTransactionType,
 * including asset transfer sub-types (opt-in, opt-out, clawback).
 *
 * Use this when you already have a displayable transaction (e.g. from the indexer).
 * For raw PeraTransaction objects, use classifyPeraTransaction instead.
 */
export const classifyDisplayableTransaction = (
    tx: PeraDisplayableTransaction,
): PeraTransactionType => {
    const baseType = getTransactionType(tx)

    if (baseType === 'asset-transfer') {
        const subType = getAssetTransferType(tx)
        return (
            ASSET_TRANSFER_TYPE_MAP[
                subType as keyof typeof ASSET_TRANSFER_TYPE_MAP
            ] ?? 'asset-transfer'
        )
    }

    return baseType
}

export const classifyPeraTransaction = (
    tx: PeraTransaction,
): PeraTransactionType => {
    const displayTx = mapToDisplayableTransaction(tx)
    if (!displayTx) {
        return 'unknown'
    }

    const baseType = getTransactionType(displayTx)

    if (baseType === 'asset-transfer') {
        const subType = getAssetTransferType(displayTx)
        return (
            ASSET_TRANSFER_TYPE_MAP[
                subType as keyof typeof ASSET_TRANSFER_TYPE_MAP
            ] ?? 'asset-transfer'
        )
    }

    return baseType
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
