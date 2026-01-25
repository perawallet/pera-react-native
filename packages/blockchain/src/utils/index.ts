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

import { encodeAddress } from '@algorandfoundation/algokit-utils'
import { TransactionType } from '@algorandfoundation/algokit-utils/transact'
import type { PeraTransaction } from '../models'

export const encodeAlgorandAddress = (bytes: Uint8Array): string => {
    return encodeAddress(bytes)
}

export const isValidAlgorandAddress = (address?: string) => {
    if (!address) {
        return false
    }
    return /^[0-9a-zA-Z]{58}$/.test(address)
}
export * from './algorandClient'

export type PeraTransactionType =
    | 'payment'
    | 'asset-transfer'
    | 'asset-config'
    | 'asset-freeze'
    | 'key-registration'
    | 'app-call'
    | 'state-proof'
    | 'heartbeat'
    | 'unknown'

export const getTransactionType = (
    tx: PeraTransaction,
): PeraTransactionType => {
    switch (tx.type) {
        case TransactionType.Payment:
            return 'payment'
        case TransactionType.AssetTransfer:
            return 'asset-transfer'
        case TransactionType.AssetConfig:
            return 'asset-config'
        case TransactionType.AssetFreeze:
            return 'asset-freeze'
        case TransactionType.KeyRegistration:
            return 'key-registration'
        case TransactionType.AppCall:
            return 'app-call'
        case TransactionType.StateProof:
            return 'state-proof'
        case TransactionType.Heartbeat:
            return 'heartbeat'
        default:
            return 'unknown'
    }
}

export const isPaymentTransaction = (tx: PeraTransaction): boolean => {
    return tx.type === TransactionType.Payment && tx.payment !== undefined
}

export const isAssetTransferTransaction = (tx: PeraTransaction): boolean => {
    return (
        tx.type === TransactionType.AssetTransfer &&
        tx.assetTransfer !== undefined
    )
}

export const isAssetConfigTransaction = (tx: PeraTransaction): boolean => {
    return (
        tx.type === TransactionType.AssetConfig && tx.assetConfig !== undefined
    )
}

export const isAssetFreezeTransaction = (tx: PeraTransaction): boolean => {
    return (
        tx.type === TransactionType.AssetFreeze && tx.assetFreeze !== undefined
    )
}

export const isKeyRegistrationTransaction = (tx: PeraTransaction): boolean => {
    return tx.type === TransactionType.KeyRegistration
}

export const isAppCallTransaction = (tx: PeraTransaction): boolean => {
    return tx.type === TransactionType.AppCall && tx.appCall !== undefined
}

export const microAlgosToAlgos = (microAlgos: bigint): number => {
    return Number(microAlgos) / 1_000_000
}

export const formatMicroAlgos = (microAlgos: bigint): string => {
    return microAlgosToAlgos(microAlgos).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 6,
    })
}

export { TransactionType }
