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

import { Decimal } from 'decimal.js'
import {
    type BalanceChange,
    type ChainScope,
    type TransactionSummary,
    i18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { transactionStatusNotice } from '@perawallet/wallet-core-transactions'
import {
    areEvmAddressesEqual,
    normalizeEvmAddress,
} from '../accounts/address-codec'
import { fromCaip19, InvalidCaip19Error } from '../blockchain/utils/caip19'
import type { EvmChain } from '../chains/types'
import type { EvmHistoryItem } from './api/schema'

const SEND = i18nKey('transactions.list_item.send')
const RECEIVE = i18nKey('transactions.list_item.receive')
const CONTRACT_CALL = i18nKey('transactions.list_item.contract_call')

const areEqual = areEvmAddressesEqual
const normalize = normalizeEvmAddress

const balanceChangesOf = (
    item: EvmHistoryItem,
    scope: ChainScope,
    chain: EvmChain,
): BalanceChange[] =>
    item.balance_impacts.flatMap(({ asset_id, amount }) => {
        try {
            return {
                assetRef: {
                    chainId: chain.row.id,
                    assetId: fromCaip19(asset_id, scope, chain),
                },
                value: new Decimal(amount),
            }
        } catch (error) {
            // An asset this client can't name drops its line, not the row.
            if (error instanceof InvalidCaip19Error) return []
            throw error
        }
    })

const summarizeWithdrawal = (
    item: EvmHistoryItem,
    scope: ChainScope,
    chain: EvmChain,
): TransactionSummary => {
    const nativeRef = chain.descriptor.nativeAsset.ref
    const credit = balanceChangesOf(item, scope, chain).find(
        change => change.assetRef.assetId === nativeRef.assetId,
    )
    return {
        kind: 'transfer',
        title: { key: RECEIVE },
        icon: 'receive',
        direction: 'in',
        ...(credit && {
            amount: { assetRef: nativeRef, value: credit.value },
        }),
    }
}

const summarizeNativeTransfer = (
    item: EvmHistoryItem,
    address: string,
    chain: EvmChain,
): TransactionSummary | undefined => {
    const { from, to } = item
    if (
        from === null ||
        to === null ||
        item.method !== null ||
        item.token_transfers.length > 0 ||
        item.nft_transfers.length > 0
    ) {
        return undefined
    }
    const sent = areEqual(from, address)
    // A forwarder's internal transfer lists the row for us without the row's value being ours.
    if (!sent && !areEqual(to, address)) return undefined
    const isSelf = sent && areEqual(to, address)
    return {
        kind: 'transfer',
        title: { key: sent ? SEND : RECEIVE },
        icon: isSelf ? 'self' : sent ? 'send' : 'receive',
        direction: isSelf ? 'self' : sent ? 'out' : 'in',
        counterparty: normalize(sent ? to : from),
        amount: {
            assetRef: chain.descriptor.nativeAsset.ref,
            value: new Decimal(item.value ?? '0'),
        },
    }
}

const summarizeTokenTransfer = (
    item: EvmHistoryItem,
    address: string,
    chain: EvmChain,
): TransactionSummary | undefined => {
    const [leg, ...others] = item.token_transfers
    if (
        !leg ||
        others.length > 0 ||
        item.nft_transfers.length > 0 ||
        !new Decimal(item.value ?? '0').isZero()
    ) {
        return undefined
    }
    // A call to anything but the token itself is a router or a swap.
    if (
        item.from !== null &&
        (item.to === null || !areEqual(item.to, leg.contract))
    ) {
        return undefined
    }
    const out = areEqual(leg.from, address)
    // A spender moving someone else's tokens is not a receive.
    if (!out && !areEqual(leg.to, address)) return undefined
    const isSelf = out && areEqual(leg.to, address)
    return {
        kind: 'token-transfer',
        title: { key: out ? SEND : RECEIVE },
        icon: isSelf ? 'self' : out ? 'send' : 'receive',
        direction: isSelf ? 'self' : out ? 'out' : 'in',
        counterparty: normalize(out ? leg.to : leg.from),
        amount: {
            assetRef: {
                chainId: chain.row.id,
                assetId: normalize(leg.contract),
            },
            value: new Decimal(leg.value),
        },
    }
}

const summarizeContractCall = (
    item: EvmHistoryItem,
    address: string,
    scope: ChainScope,
    chain: EvmChain,
): TransactionSummary => {
    const sent = item.from !== null && areEqual(item.from, address)
    const other = sent ? item.to : item.from
    return {
        kind: 'contract-call',
        title: { key: CONTRACT_CALL },
        icon: 'contract-call',
        direction: 'none',
        ...(other !== null && { counterparty: normalize(other) }),
        balanceChanges: balanceChangesOf(item, scope, chain),
    }
}

/**
 * Read from `address`'s side, from the row's kind, parties, value and
 * transfer legs alone; `method` only tells a plain value transfer from a call.
 */
export const summarizeEthereumHistoryItem = (
    item: EvmHistoryItem,
    address: string,
    scope: ChainScope,
    chain: EvmChain,
): TransactionSummary => {
    const summary =
        item.kind === 'withdrawal'
            ? summarizeWithdrawal(item, scope, chain)
            : (summarizeNativeTransfer(item, address, chain) ??
              summarizeTokenTransfer(item, address, chain) ??
              summarizeContractCall(item, address, scope, chain))
    const notice = transactionStatusNotice(
        item.status === 'success' ? 'confirmed' : 'failed',
    )
    return notice ? { ...summary, notice } : summary
}
