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

import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'

export type AccountOnChainState = {
    address: string
    amount: bigint
    minBalance: bigint
    assets: Array<{ assetId: bigint; amount: bigint }>
}

export type InsufficientAlgoError = {
    type: 'insufficient-algo'
    address: string
    required: bigint
    available: bigint
}

export type InsufficientAssetError = {
    type: 'insufficient-asset'
    address: string
    assetId: bigint
    required: bigint
    available: bigint
}

export type BalanceValidationError =
    | InsufficientAlgoError
    | InsufficientAssetError

export type BalanceValidationResult = {
    isValid: boolean
    errors: BalanceValidationError[]
}

export const validateSignerBalances = (
    transactions: PeraDisplayableTransaction[],
    signableAddresses: Set<string>,
    accountStates: Map<string, AccountOnChainState>,
    includeMBR: boolean = true,
): BalanceValidationResult => {
    const errors: BalanceValidationError[] = []

    for (const address of signableAddresses) {
        const account = accountStates.get(address)
        const accountAmount = account?.amount ?? 0n
        const accountMinBalance = account?.minBalance ?? 0n

        let totalFees = 0n
        let totalPayments = 0n
        const assetAmounts = new Map<bigint, bigint>()

        for (const tx of transactions) {
            if (tx.sender !== address) continue

            totalFees += tx.fee ?? 0n

            if (tx.paymentTransaction) {
                totalPayments += tx.paymentTransaction.amount ?? 0n
            }

            if (tx.assetTransferTransaction) {
                // If sender field is set on asset transfer, it's a clawback —
                // signer pays fee only, not the asset amount
                if (!tx.assetTransferTransaction.sender) {
                    const assetId = tx.assetTransferTransaction.assetId
                    const amount = tx.assetTransferTransaction.amount ?? 0n
                    const current = assetAmounts.get(assetId) ?? 0n
                    assetAmounts.set(assetId, current + amount)
                }
            }
        }

        // Skip addresses that have no transactions to sign
        if (totalFees === 0n && totalPayments === 0n && assetAmounts.size === 0)
            continue

        // ALGO check: required = fees + payments + minBalance
        const required =
            totalFees + totalPayments + (includeMBR ? accountMinBalance : 0n)
        if (accountAmount < required) {
            errors.push({
                type: 'insufficient-algo',
                address,
                required,
                available: accountAmount,
            })
        }

        // Asset checks
        for (const [assetId, totalRequired] of assetAmounts) {
            const holding = account?.assets.find(a => a.assetId === assetId)
            const available = holding?.amount ?? 0n
            if (available < totalRequired) {
                errors.push({
                    type: 'insufficient-asset',
                    address,
                    assetId,
                    required: totalRequired,
                    available,
                })
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
    }
}
