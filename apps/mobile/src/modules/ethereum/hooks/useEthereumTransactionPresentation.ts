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
import type {
    ChainScope,
    TransactionNative,
} from '@perawallet/wallet-core-chain-contract'
import {
    ETHEREUM_CHAIN_ID,
    ETHEREUM_NATIVE_ASSET,
    readEthereumNative,
    type EthereumTransactionView,
    type EvmNftItem,
} from '@perawallet/wallet-core-chain-ethereum'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    baseUnitsToDisplayUnits,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type { IconName } from '@components/core'
import { transactionIconName } from '@components/TransactionIcon'
import { useBaseUnitsAmount } from '@hooks/useBaseUnitsAmount'
import {
    useEthereumStandardCall,
    type EthereumAmount,
    type EthereumStandardCallPresentation,
} from './useEthereumStandardCall'

export type { EthereumAmount } from './useEthereumStandardCall'

export type EthereumTransactionPresentation = {
    view: EthereumTransactionView
    scope: ChainScope
    titleKey:
        | 'transactions.list_item.send'
        | 'transactions.list_item.contract_call'
        | 'transactions.list_item.approval'
        | 'transactions.list_item.revoke_approval'
    iconName: IconName
    /** A contract call read as a standard token call; null for any other call. */
    standardCall: Nullable<EthereumStandardCallPresentation>
    /** Moves value: a transfer view, or a contract call read as a token or NFT transfer. */
    isTransfer: boolean
    /**
     * A transfer's recipient (`view.to`, `view.token.to` for a token,
     * `view.nft.to` for an NFT, or a read call's recipient), an approval's
     * spender or operator, or the called contract; absent for a contract
     * creation.
     */
    counterparty?: string
    /** Set on a read transfer whose holder isn't the signer, as `transferFrom` allows. */
    sender?: string
    /** Set on a read NFT transfer, one per token id. */
    nftItems?: EvmNftItem[]
    /** Set on an NFT transfer. */
    collectible?: { tokenId: string; collectionName?: string }
    /** What a transfer moves; absent on a contract call. */
    amount?: EthereumAmount
    isAmountLoading: boolean
    /** `view.value` in ether. */
    value: EthereumAmount
    /**
     * `view.fee.maxFee` in ether: the most the signature authorises. Null on a
     * batch call not yet reached, which is priced only once it is.
     */
    maxFee: Nullable<EthereumAmount>
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

const isApproval = (
    standardCall: Nullable<EthereumStandardCallPresentation>,
): boolean =>
    standardCall?.kind === 'token-approval' ||
    standardCall?.kind === 'nft-approval' ||
    standardCall?.kind === 'collection-approval'

const isRevocation = (
    standardCall: EthereumStandardCallPresentation,
): boolean =>
    (standardCall.kind === 'token-approval' && !standardCall.spendApproval) ||
    (standardCall.kind === 'nft-approval' && standardCall.isRevocation) ||
    (standardCall.kind === 'collection-approval' && !standardCall.isApproved)

const counterpartyOf = (
    standardCall: EthereumStandardCallPresentation,
): string => {
    switch (standardCall.kind) {
        case 'token-transfer':
        case 'nft-transfer': {
            return standardCall.to
        }
        case 'token-approval':
        case 'nft-approval': {
            return standardCall.spender
        }
        case 'collection-approval': {
            return standardCall.operator
        }
    }
}

const titleKeyOf = (
    view: EthereumTransactionView,
    standardCall: Nullable<EthereumStandardCallPresentation>,
): EthereumTransactionPresentation['titleKey'] => {
    if (standardCall && isApproval(standardCall)) {
        return isRevocation(standardCall)
            ? 'transactions.list_item.revoke_approval'
            : 'transactions.list_item.approval'
    }
    return view.kind === 'contract-call' && !standardCall
        ? 'transactions.list_item.contract_call'
        : 'transactions.list_item.send'
}

const iconNameOf = (
    view: EthereumTransactionView,
    standardCall: Nullable<EthereumStandardCallPresentation>,
): IconName => {
    if (isApproval(standardCall)) return transactionIconName('approval')
    return transactionIconName(
        view.kind === 'contract-call' && !standardCall
            ? 'contract-call'
            : 'send',
    )
}

type StandardCallFields = Pick<
    EthereumTransactionPresentation,
    | 'counterparty'
    | 'sender'
    | 'nftItems'
    | 'amount'
    | 'isAmountLoading'
    | 'collectible'
>

// A read transfer reads like a wallet-built send: recipient, amount and, for
// one NFT, its collection and token id.
const standardCallFields = (
    view: EthereumTransactionView,
    standardCall: EthereumStandardCallPresentation,
    isLoading: boolean,
): StandardCallFields => {
    const counterparty = counterpartyOf(standardCall)
    if (
        standardCall.kind !== 'token-transfer' &&
        standardCall.kind !== 'nft-transfer'
    ) {
        return { counterparty, isAmountLoading: false }
    }
    const isOtherHolder =
        standardCall.from.toLowerCase() !== view.from.toLowerCase()
    const sender = isOtherHolder ? standardCall.from : undefined
    if (standardCall.kind === 'token-transfer') {
        return {
            counterparty,
            sender,
            amount: standardCall.amount,
            isAmountLoading: isLoading,
        }
    }
    const [first] = standardCall.items
    const isSingle = standardCall.items.length === 1
    return {
        counterparty,
        sender,
        nftItems: standardCall.items,
        isAmountLoading: isSingle && isLoading,
        ...(isSingle && {
            amount: { asset: standardCall.asset, value: first.amount },
            collectible: {
                tokenId: first.tokenId,
                collectionName: standardCall.collectionName,
            },
        }),
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
    const {
        asset: tokenAsset,
        value: tokenValue,
        isLoading: isTokenLoading,
    } = useBaseUnitsAmount(
        view?.token?.contract ?? view?.nft?.assetId ?? '',
        view?.token?.amount ?? view?.nft?.amount,
        scope,
    )
    const signingAccount = useFindAccountByAddress(view?.from ?? '', scope)
    const { standardCall, isLoading: isStandardCallLoading } =
        useEthereumStandardCall(view, scope)

    return useMemo(() => {
        if (!view) return null

        const isAmountLoading =
            (view.kind === 'token-transfer' || view.kind === 'nft-transfer') &&
            isTokenLoading

        let amount: Optional<EthereumAmount>
        if (view.kind === 'transfer') {
            amount = toEther(view.value)
        } else if (tokenValue) {
            amount = { asset: tokenAsset, value: tokenValue }
        }

        const isReadTransfer =
            standardCall?.kind === 'token-transfer' ||
            standardCall?.kind === 'nft-transfer'

        return {
            view,
            scope,
            titleKey: titleKeyOf(view, standardCall),
            iconName: iconNameOf(view, standardCall),
            standardCall,
            isTransfer: view.kind !== 'contract-call' || isReadTransfer,
            counterparty: view.token?.to ?? view.nft?.to ?? view.to,
            ...(view.nft && {
                collectible: {
                    tokenId: view.nft.tokenId,
                    collectionName:
                        tokenAsset?.peraMetadata?.collectible?.collection?.name,
                },
            }),
            amount,
            isAmountLoading,
            ...(standardCall &&
                standardCallFields(view, standardCall, isStandardCallLoading)),
            value: toEther(view.value),
            maxFee: view.isPreview ? null : toEther(view.fee.maxFee),
            signingAccount,
        }
    }, [
        view,
        scope,
        tokenAsset,
        tokenValue,
        isTokenLoading,
        signingAccount,
        standardCall,
        isStandardCallLoading,
    ])
}
