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
import type {
    BalanceChange,
    ChainScope,
    TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import { ethereumAddressCodec } from '../accounts/address-codec'
import { fromCaip19, InvalidCaip19Error } from '../blockchain/utils/caip19'
import { ETHEREUM_CHAIN_ID } from '../chain-id'
import { ethereumDescriptor } from '../descriptor'
import type { EvmHistoryItem } from './api/schema'

const SEND = 'transactions.list_item.send'
const RECEIVE = 'transactions.list_item.receive'
const CONTRACT_CALL = 'transactions.list_item.contract_call'

/** Every i18n key a history summary can carry. */
export const ETHEREUM_HISTORY_SUMMARY_KEYS = [
    SEND,
    RECEIVE,
    CONTRACT_CALL,
] as const

const { areEqual, normalize } = ethereumAddressCodec
const NATIVE_REF = ethereumDescriptor.nativeAsset.ref

const balanceChangesOf = (
    item: EvmHistoryItem,
    scope: ChainScope,
): BalanceChange[] =>
    item.balance_impacts.flatMap(({ asset_id, amount }) => {
        try {
            return {
                assetRef: {
                    chainId: ETHEREUM_CHAIN_ID,
                    assetId: fromCaip19(asset_id, scope),
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
): TransactionSummary => {
    const credit = balanceChangesOf(item, scope).find(
        change => change.assetRef.assetId === NATIVE_REF.assetId,
    )
    return {
        kind: 'transfer',
        title: { key: RECEIVE },
        icon: 'receive',
        direction: 'in',
        ...(credit && {
            amount: { assetRef: NATIVE_REF, value: credit.value },
        }),
    }
}

const summarizeNativeTransfer = (
    item: EvmHistoryItem,
    address: string,
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
            assetRef: NATIVE_REF,
            value: new Decimal(item.value ?? '0'),
        },
    }
}

const summarizeTokenTransfer = (
    item: EvmHistoryItem,
    address: string,
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
                chainId: ETHEREUM_CHAIN_ID,
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
): TransactionSummary => {
    const sent = item.from !== null && areEqual(item.from, address)
    const other = sent ? item.to : item.from
    return {
        kind: 'contract-call',
        title: { key: CONTRACT_CALL },
        icon: 'contract-call',
        direction: 'none',
        ...(other !== null && { counterparty: normalize(other) }),
        balanceChanges: balanceChangesOf(item, scope),
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
): TransactionSummary =>
    item.kind === 'withdrawal'
        ? summarizeWithdrawal(item, scope)
        : (summarizeNativeTransfer(item, address) ??
          summarizeTokenTransfer(item, address) ??
          summarizeContractCall(item, address, scope))
