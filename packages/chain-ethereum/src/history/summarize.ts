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
    type AssetDisplayHint,
    type BalanceChange,
    type ChainScope,
    type TransactionSummary,
    i18nKey,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { transactionStatusNotice } from '@perawallet/wallet-core-transactions'
import {
    areEvmAddressesEqual,
    normalizeEvmAddress,
} from '../accounts/address-codec'
import {
    fromCaip19,
    InvalidCaip19Error,
    toEvmNftAssetId,
} from '../blockchain/utils/caip19'
import type { EvmChain } from '../chains/types'
import type { EvmHistoryItem, EvmNftTransfer } from './api/schema'

const SEND = i18nKey('transactions.list_item.send')
const RECEIVE = i18nKey('transactions.list_item.receive')
const CONTRACT_CALL = i18nKey('transactions.list_item.contract_call')
const NFT_SUBTITLE = i18nKey('transactions.list_item.nft_subtitle')

const areEqual = areEvmAddressesEqual
const normalize = normalizeEvmAddress

type NftLeg = {
    leg: EvmNftTransfer
    assetId: string
    isIn: boolean
    isOut: boolean
}

const nftDisplayOf = (leg: EvmNftTransfer): AssetDisplayHint => ({
    symbol: leg.collection_symbol ?? '',
    decimals: 0,
})

// The NFT legs `address` sends or receives; a leg whose token id this client
// can't name drops itself.
const nftLegsOf = (item: EvmHistoryItem, address: string): NftLeg[] =>
    item.nft_transfers.flatMap(leg => {
        const isIn = areEqual(leg.to, address)
        const isOut = areEqual(leg.from, address)
        if (!isIn && !isOut) return []
        let assetId: string
        try {
            assetId = toEvmNftAssetId(leg.contract, leg.token_id)
        } catch {
            return []
        }
        return [{ leg, assetId, isIn, isOut }]
    })

const nftChangeOf = (
    chain: EvmChain,
    { leg, assetId, isIn }: NftLeg,
): BalanceChange => {
    const quantity = new Decimal(leg.quantity)
    return {
        assetRef: { chainId: chain.row.id, assetId },
        value: isIn ? quantity : quantity.negated(),
        display: nftDisplayOf(leg),
    }
}

// The backend's impacts may leave an NFT out, so a leg it misses adds its own
// line; a self-transfer nets to nothing and adds none.
const balanceChangesOf = (
    item: EvmHistoryItem,
    address: string,
    scope: ChainScope,
    chain: EvmChain,
): BalanceChange[] => {
    const nftLegs = nftLegsOf(item, address)
    const displayById = new Map(
        nftLegs.map(({ assetId, leg }) => [assetId, nftDisplayOf(leg)]),
    )
    const impacts: BalanceChange[] = item.balance_impacts.flatMap(
        ({ asset_id, amount }) => {
            try {
                const assetId = fromCaip19(asset_id, scope, chain)
                const display = displayById.get(assetId)
                return {
                    assetRef: { chainId: chain.row.id, assetId },
                    value: new Decimal(amount),
                    ...(display && { display }),
                }
            } catch (error) {
                // An asset this client can't name drops its line, not the row.
                if (error instanceof InvalidCaip19Error) return []
                throw error
            }
        },
    )
    const listed = new Set(impacts.map(change => change.assetRef.assetId))
    const missing = nftLegs
        .filter(
            ({ assetId, isIn, isOut }) =>
                isIn !== isOut && !listed.has(assetId),
        )
        .map(nftLeg => nftChangeOf(chain, nftLeg))
    return [...impacts, ...missing]
}

const summarizeWithdrawal = (
    item: EvmHistoryItem,
    address: string,
    scope: ChainScope,
    chain: EvmChain,
): TransactionSummary => {
    const nativeRef = chain.descriptor.nativeAsset.ref
    const credit = balanceChangesOf(item, address, scope, chain).find(
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
): Optional<TransactionSummary> => {
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
): Optional<TransactionSummary> => {
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

type NftDirection = 'in' | 'out' | 'self'

const nftDirectionOf = (legs: NftLeg[]): NftDirection => {
    if (legs.every(({ isIn, isOut }) => isIn && !isOut)) return 'in'
    if (legs.every(({ isIn, isOut }) => isOut && !isIn)) return 'out'
    return 'self'
}

const NFT_PRESENTATION: Record<
    NftDirection,
    Pick<TransactionSummary, 'icon'> & { title: typeof SEND }
> = {
    in: { title: RECEIVE, icon: 'receive' },
    out: { title: SEND, icon: 'send' },
    self: { title: CONTRACT_CALL, icon: 'contract-call' },
}

// Only NFTs move: no tokens, and no value that would make it a purchase.
const summarizeNftTransfer = (
    item: EvmHistoryItem,
    address: string,
    chain: EvmChain,
): Optional<TransactionSummary> => {
    const legs = nftLegsOf(item, address)
    if (
        legs.length === 0 ||
        item.token_transfers.length > 0 ||
        !new Decimal(item.value ?? '0').isZero()
    ) {
        return undefined
    }
    const direction = nftDirectionOf(legs)
    const presentation = NFT_PRESENTATION[direction]
    const base = {
        kind: 'nft-transfer',
        title: { key: presentation.title },
        icon: presentation.icon,
        direction,
    } as const
    const [only, ...others] = legs
    if (!only || others.length > 0) {
        return {
            ...base,
            balanceChanges: legs
                .filter(({ isIn, isOut }) => isIn !== isOut)
                .map(leg => nftChangeOf(chain, leg)),
        }
    }
    const { leg, assetId } = only
    const counterparty: Nullable<string> =
        direction === 'in' ? leg.from : direction === 'out' ? leg.to : null
    return {
        ...base,
        ...(counterparty !== null && {
            counterparty: normalize(counterparty),
        }),
        subtitle: {
            key: NFT_SUBTITLE,
            params: {
                collection: leg.collection_name ?? normalize(leg.contract),
                tokenId: leg.token_id,
            },
        },
        amount: {
            assetRef: { chainId: chain.row.id, assetId },
            value: new Decimal(leg.quantity),
            display: nftDisplayOf(leg),
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
        balanceChanges: balanceChangesOf(item, address, scope, chain),
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
            ? summarizeWithdrawal(item, address, scope, chain)
            : (summarizeNativeTransfer(item, address, chain) ??
              summarizeTokenTransfer(item, address, chain) ??
              summarizeNftTransfer(item, address, chain) ??
              summarizeContractCall(item, address, scope, chain))
    const notice = transactionStatusNotice(
        item.status === 'success' ? 'confirmed' : 'failed',
    )
    return notice ? { ...summary, notice } : summary
}
