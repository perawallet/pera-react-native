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

import type { Address } from 'viem'
import {
    type AssetRef,
    type BalanceChange,
    type I18nKey,
    type LocalizedText,
    type TransactionSummary,
    i18nKey,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import {
    areEvmAddressesEqual,
    normalizeEvmAddress,
    truncateEvmAddress,
} from '../accounts/address-codec'
import { parseEvmNftAssetId } from '../blockchain/utils/caip19'
import { NATIVE_ASSET_ID } from '../chains/create-evm-chain'
import type { EvmChain } from '../chains/types'
import type { KnownEvmContract } from '../signing/known-contracts'

type SwapSide = { symbol: string; assetRef: AssetRef }

type HistoryActionVariant =
    /** `token` is absent for a mined Permit2 approval, whose calldata History doesn't read. */
    | { kind: 'approval'; token?: Address }
    /** `pair` is absent when either side has no symbol. */
    | { kind: 'swap'; pair?: { from: SwapSide; to: SwapSide } }
    | { kind: 'supply' | 'withdraw' | 'borrow' | 'repay' | 'wrap' | 'unwrap' }
    | { kind: 'add-liquidity' | 'remove-liquidity' }
    | { kind: 'send' | 'receive' }

/** What a call the account sent did, mined or still pending; `isInferred` when only its balance changes said so. */
export type EvmHistoryAction = HistoryActionVariant & { isInferred?: boolean }

type PlainActionKind = Exclude<EvmHistoryAction['kind'], 'approval' | 'swap'>

export type EvmHistoryCallFacts = {
    to: Address
    /** A verified contract's function name, or the raw selector when it isn't verified. */
    method: Nullable<string>
    /** Without the gas the account paid. */
    changes: BalanceChange[]
    /** NFT legs the account sends or receives. */
    nftLegCount: number
    nativeSymbol: string
    contract: Optional<KnownEvmContract>
    isDecoding: boolean
}

const APPROVAL_METHODS: ReadonlySet<string> = new Set([
    'approve',
    'increaseAllowance',
    'setApprovalForAll',
])

const APPROVAL_SELECTORS: ReadonlySet<string> = new Set([
    '0x095ea7b3',
    '0x39509351',
    '0xa22cb465',
])

const AAVE_POOL_ACTIONS: ReadonlyMap<string, PlainActionKind> = new Map([
    ['supply', 'supply'],
    ['supplyWithPermit', 'supply'],
    ['deposit', 'supply'],
    ['withdraw', 'withdraw'],
    ['borrow', 'borrow'],
    ['repay', 'repay'],
    ['repayWithPermit', 'repay'],
    ['repayWithATokens', 'repay'],
])

const WRAPPED_NATIVE_ACTIONS: ReadonlyMap<string, PlainActionKind> = new Map([
    ['deposit', 'wrap'],
    ['withdraw', 'unwrap'],
])

const POSITION_MANAGER_ACTIONS: ReadonlyMap<string, PlainActionKind> = new Map([
    ['mint', 'add-liquidity'],
    ['increaseLiquidity', 'add-liquidity'],
    ['decreaseLiquidity', 'remove-liquidity'],
])

const TITLE_KEYS: Record<PlainActionKind, I18nKey> = {
    supply: i18nKey('transactions.list_item.supply'),
    withdraw: i18nKey('transactions.list_item.withdraw'),
    borrow: i18nKey('transactions.list_item.borrow'),
    repay: i18nKey('transactions.list_item.repay'),
    wrap: i18nKey('transactions.list_item.wrap'),
    unwrap: i18nKey('transactions.list_item.unwrap'),
    'add-liquidity': i18nKey('transactions.list_item.add_liquidity'),
    'remove-liquidity': i18nKey('transactions.list_item.remove_liquidity'),
    send: i18nKey('transactions.list_item.send'),
    receive: i18nKey('transactions.list_item.receive'),
}

const APPROVE_ASSET = i18nKey('transactions.list_item.approve_asset')
const APPROVAL = i18nKey('transactions.list_item.approval')
const SWAP = i18nKey('transactions.list_item.swap')
const SWAP_PAIR = i18nKey('transactions.list_item.swap_pair')
const INTERPRETED_TITLE = i18nKey('transactions.list_item.interpreted_title')

const isApprovalMethod = (method: string): boolean =>
    APPROVAL_METHODS.has(method) || APPROVAL_SELECTORS.has(method.toLowerCase())

const isNftChange = (change: BalanceChange): boolean =>
    parseEvmNftAssetId(change.assetRef.assetId) !== null

const actionByMethod = (
    actions: ReadonlyMap<string, PlainActionKind>,
    method: Nullable<string>,
): Optional<EvmHistoryAction> => {
    const kind = method === null ? undefined : actions.get(method)
    return kind && { kind }
}

// Without calldata a batch only shows its balances: the position NFT leaving
// is a removal, tokens only leaving is an addition. Fees collected without a
// removal look the same as a partial removal, so those stay unnamed.
const positionAction = ({
    to,
    method,
    changes,
}: EvmHistoryCallFacts): Optional<EvmHistoryAction> => {
    const named = actionByMethod(POSITION_MANAGER_ACTIONS, method)
    if (named) return named
    const isPositionLeaving = changes.some(change => {
        const nft = parseEvmNftAssetId(change.assetRef.assetId)
        return (
            !!nft &&
            change.value.isNegative() &&
            areEvmAddressesEqual(nft.contract, to)
        )
    })
    if (isPositionLeaving) return { kind: 'remove-liquidity', isInferred: true }
    const fungible = changes.filter(change => !isNftChange(change))
    return fungible.length > 0 &&
        fungible.every(change => change.value.isNegative())
        ? { kind: 'add-liquidity', isInferred: true }
        : undefined
}

const symbolOf = (
    change: BalanceChange,
    nativeSymbol: string,
): Optional<string> => {
    const symbol =
        change.assetRef.assetId === NATIVE_ASSET_ID
            ? nativeSymbol
            : change.display?.symbol
    return symbol === '' ? undefined : symbol
}

const shapeAction = ({
    changes,
    nftLegCount,
    nativeSymbol,
}: EvmHistoryCallFacts): Optional<EvmHistoryAction> => {
    const outs = changes.filter(change => change.value.isNegative())
    const ins = changes.filter(change => change.value.isPositive())
    if (outs.length === 0) {
        return ins.length > 0
            ? { kind: 'receive', isInferred: true }
            : undefined
    }
    if (ins.length === 0) return { kind: 'send', isInferred: true }
    // A liquidity removal pays out two assets for one, so a swap is exactly one for one.
    if (outs.length > 1 || ins.length > 1 || nftLegCount > 0) return undefined
    const [out] = outs
    const [received] = ins
    if (
        isNftChange(out) ||
        isNftChange(received) ||
        received.assetRef.assetId === out.assetRef.assetId
    ) {
        return undefined
    }
    const from = symbolOf(out, nativeSymbol)
    const to = symbolOf(received, nativeSymbol)
    return from && to
        ? {
              kind: 'swap',
              pair: {
                  from: { symbol: from, assetRef: out.assetRef },
                  to: { symbol: to, assetRef: received.assetRef },
              },
              isInferred: true,
          }
        : { kind: 'swap', isInferred: true }
}

// Aave, wrapped native and the position managers are read by method, never by
// shape: a deposit that mints a receipt token has a swap's shape.
const knownContractAction = (
    facts: EvmHistoryCallFacts,
    contract: KnownEvmContract,
): Optional<EvmHistoryAction> => {
    switch (contract.kind) {
        case 'aave-v3-pool': {
            return actionByMethod(AAVE_POOL_ACTIONS, facts.method)
        }
        case 'wrapped-native': {
            return actionByMethod(WRAPPED_NATIVE_ACTIONS, facts.method)
        }
        case 'uniswap-v3-position-manager':
        case 'uniswap-v4-position-manager': {
            return positionAction(facts)
        }
        case 'uniswap-universal-router':
        case 'uniswap-permit2': {
            return shapeAction(facts)
        }
    }
}

/**
 * What a mined call the account sent did. An approval is named whatever the
 * capabilities, as signing names it; anything else only while `isDecoding`.
 */
export const classifyEvmHistoryCall = (
    facts: EvmHistoryCallFacts,
): Optional<EvmHistoryAction> => {
    const { to, method, contract, isDecoding } = facts
    if (method !== null && isApprovalMethod(method)) {
        return contract?.kind === 'uniswap-permit2'
            ? { kind: 'approval' }
            : { kind: 'approval', token: to }
    }
    if (!isDecoding) return undefined
    return contract ? knownContractAction(facts, contract) : shapeAction(facts)
}

/** The subtitle naming a well-known contract; a proper noun, never translated. */
export const knownContractSubtitle = (
    contract: KnownEvmContract,
): LocalizedText => ({
    key: INTERPRETED_TITLE,
    params: { title: contract.projectName ?? contract.name },
})

/**
 * An approval drops `base`'s counterparty: the call's target is the token, which would read as
 * the spender. Pass `contract` only where naming it is allowed.
 */
export const historyActionSummary = (
    action: EvmHistoryAction,
    base: TransactionSummary,
    contract: Optional<KnownEvmContract>,
    chain: EvmChain,
): TransactionSummary => {
    const { isActionUnknown: _unknown, ...known } = base
    const named: TransactionSummary = {
        ...known,
        ...(contract && { subtitle: knownContractSubtitle(contract) }),
        ...(action.isInferred && { isInferred: true }),
    }
    switch (action.kind) {
        case 'approval': {
            const { token } = action
            const { counterparty: _target, ...approval } = named
            return {
                ...approval,
                kind: 'approval',
                icon: 'approval',
                title: token
                    ? {
                          key: APPROVE_ASSET,
                          params: { asset: truncateEvmAddress(token) },
                      }
                    : { key: APPROVAL },
                ...(token && {
                    titleAssets: {
                        asset: {
                            chainId: chain.row.id,
                            assetId: normalizeEvmAddress(token),
                        },
                    },
                }),
            }
        }
        case 'swap': {
            const { pair } = action
            return {
                ...named,
                kind: 'swap',
                icon: 'swap',
                ...(pair
                    ? {
                          title: {
                              key: SWAP_PAIR,
                              params: {
                                  from: pair.from.symbol,
                                  to: pair.to.symbol,
                              },
                          },
                          titleAssets: {
                              from: pair.from.assetRef,
                              to: pair.to.assetRef,
                          },
                      }
                    : { title: { key: SWAP } }),
            }
        }
        default: {
            return {
                ...named,
                kind: 'contract-call',
                title: { key: TITLE_KEYS[action.kind] },
            }
        }
    }
}
