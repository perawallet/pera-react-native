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

import type { TransactionNative } from '@perawallet/wallet-core-chain-contract'
import type { ReviewedAddress } from '@perawallet/wallet-core-signing'
import { readAlgorandNative } from '../blockchain/models/transaction-view'
import { encodeAlgorandAddress } from '../blockchain/utils/addresses'

// A malformed key names no address rather than failing the whole review.
const addressOfKey = (key: { readonly publicKey: Uint8Array }): string[] => {
    try {
        return [encodeAlgorandAddress(key.publicKey)]
    } catch {
        return []
    }
}

export const algorandReviewedAddresses = (
    transaction: TransactionNative,
): ReviewedAddress[] => {
    const view = readAlgorandNative(transaction)
    if (!view) return []

    const reviewed: ReviewedAddress[] = []
    const payment = view.paymentTransaction
    if (payment) {
        reviewed.push({ address: payment.receiver, role: 'recipient' })
        if (payment.closeRemainderTo) {
            reviewed.push({
                address: payment.closeRemainderTo,
                role: 'close-recipient',
            })
        }
    }
    const assetTransfer = view.assetTransferTransaction
    if (assetTransfer) {
        reviewed.push({
            address: assetTransfer.receiver,
            role: 'token-recipient',
        })
        if (assetTransfer.closeTo) {
            reviewed.push({
                address: assetTransfer.closeTo,
                role: 'close-recipient',
            })
        }
        if (assetTransfer.sender) {
            reviewed.push({
                address: assetTransfer.sender,
                role: 'referenced-account',
            })
        }
    }
    // Handing an asset's manager or clawback to a look-alike takes it over as
    // surely as a rekey takes an account.
    const params = view.assetConfigTransaction?.params
    for (const address of [
        params?.manager,
        params?.reserve,
        params?.freeze,
        params?.clawback,
    ]) {
        if (address) reviewed.push({ address, role: 'new-authorizer' })
    }
    if (view.assetFreezeTransaction) {
        reviewed.push({
            address: view.assetFreezeTransaction.address,
            role: 'referenced-account',
        })
    }
    for (const account of view.applicationTransaction?.accounts ?? []) {
        for (const address of addressOfKey(account)) {
            reviewed.push({ address, role: 'referenced-account' })
        }
    }
    if (view.rekeyTo) {
        for (const address of addressOfKey(view.rekeyTo)) {
            reviewed.push({ address, role: 'new-authorizer' })
        }
    }
    return reviewed
}
