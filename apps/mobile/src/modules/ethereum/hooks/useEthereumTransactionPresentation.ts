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

import { useMemo } from 'react'
import type { Decimal } from 'decimal.js'
import {
    useFindAccountByAddress,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useSingleAssetDetailsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import type {
    ChainScope,
    TransactionNative,
} from '@perawallet/wallet-core-chain-contract'
import {
    ETHEREUM_CHAIN_ID,
    ETHEREUM_NATIVE_ASSET,
    readEthereumNative,
    type EthereumTransactionView,
} from '@perawallet/wallet-core-chain-ethereum'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    baseUnitsToDisplayUnits,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type { IconName } from '@components/core'
import { transactionIconName } from '@components/TransactionIcon'

export type EthereumAmount = {
    /** Null only when a token's record can't be read; `value` is then in base units. */
    asset: Nullable<PeraAsset>
    /** In display units of `asset`. */
    value: Decimal
}

export type EthereumTransactionPresentation = {
    view: EthereumTransactionView
    scope: ChainScope
    titleKey:
        | 'transactions.list_item.send'
        | 'transactions.list_item.contract_call'
    iconName: IconName
    /**
     * A transfer's recipient (`view.to`, or `view.token.to` for a token) or the
     * called contract; absent for a contract creation.
     */
    counterparty?: string
    /** What a transfer moves; absent on a contract call. */
    amount?: EthereumAmount
    isAmountLoading: boolean
    /** `view.value` in ether. */
    value: EthereumAmount
    /** `view.fee.maxFee` in ether: the most the signature authorises. */
    maxFee: EthereumAmount
    signingAccount: Nullable<WalletAccount>
}

export type UseEthereumTransactionPresentationResult =
    Nullable<EthereumTransactionPresentation>

const readView = (
    transaction: TransactionNative,
): Nullable<EthereumTransactionView> => {
    try {
        return readEthereumNative(transaction)
    } catch {
        return null
    }
}

const toEther = (wei: Decimal): EthereumAmount => ({
    asset: ETHEREUM_NATIVE_ASSET,
    value: baseUnitsToDisplayUnits(wei, ETHEREUM_NATIVE_ASSET.decimals),
})

export const useEthereumTransactionPresentation = (
    transaction: TransactionNative,
): UseEthereumTransactionPresentationResult => {
    const view = useMemo(() => readView(transaction), [transaction])
    const scope = useSelectedScope(ETHEREUM_CHAIN_ID)
    // An empty id disables the query.
    const { data: tokenRecord, isPending: isTokenPending } =
        useSingleAssetDetailsQuery(view?.token?.contract ?? '', scope)
    const signingAccount = useFindAccountByAddress(view?.from ?? '', scope)

    return useMemo(() => {
        if (!view) return null

        const { token } = view
        // A disabled query is pending too, so only a token transfer waits on it.
        const isAmountLoading =
            view.kind === 'token-transfer' && !!token && isTokenPending

        let amount: EthereumAmount | undefined
        if (view.kind === 'transfer') {
            amount = toEther(view.value)
        } else if (token && !isAmountLoading) {
            amount = tokenRecord
                ? {
                      asset: tokenRecord,
                      value: baseUnitsToDisplayUnits(
                          token.amount,
                          tokenRecord.decimals,
                      ),
                  }
                : { asset: null, value: token.amount }
        }

        return {
            view,
            scope,
            titleKey:
                view.kind === 'contract-call'
                    ? 'transactions.list_item.contract_call'
                    : 'transactions.list_item.send',
            iconName: transactionIconName(
                view.kind === 'contract-call' ? 'contract-call' : 'send',
            ),
            counterparty: token?.to ?? view.to,
            amount,
            isAmountLoading,
            value: toEther(view.value),
            maxFee: toEther(view.fee.maxFee),
            signingAccount,
        }
    }, [view, scope, tokenRecord, isTokenPending, signingAccount])
}
