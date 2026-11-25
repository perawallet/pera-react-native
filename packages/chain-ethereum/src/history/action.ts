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

import type { Decimal } from 'decimal.js'
import { zeroAddress, type Address, type Hex } from 'viem'
import {
    type AssetRef,
    type BalanceChange,
    type I18nKey,
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
import { toAllowanceAmount } from '../signing/allowance'
import {
    decodeEvmContractAction,
    decodePermit2Approval,
} from '../signing/contract-actions'
import {
    findKnownEvmContract,
    wrappedNativeOf,
    type KnownEvmContract,
} from '../signing/known-contracts'
import { nftApprovalIdOf } from '../signing/nft-approvals'
import type { EvmStandardCall } from '../signing/standard-call-types'
import {
    decodeEvmStandardCall,
    isEvmApprovalCall,
    isEvmRevocationCall,
} from '../signing/standard-calls'

type SwapSide = { symbol: string; assetRef: AssetRef }

/** What an approval's calldata grants; absent when only its method name is known. */
export type EvmApprovalGrant = {
    /** The spender, or the operator of a collection approval. */
    spender: Address
    /** The registry's name for `spender`, read whatever the capabilities, as signing reads it. */
    spenderName?: string
    /**
     * At least 2^160, as signing reads an allowance. `approve` shares its selector with ERC-721,
     * whose token id can pass that bound; never set once `nftAssetId` places the token.
     */
    isUnlimited: boolean
    /** A zero `approve` of a token the store can't place may be ERC-721 token #0; the detail page's read corrects it. */
    isRevocation: boolean
    /** `setApprovalForAll`: `token` is the collection. */
    isCollection: boolean
    /** Set when the store holds the approved token as this NFT: an ERC-721 `approve` of one token. */
    nftAssetId?: string
}

type HistoryActionVariant =
    /** `token` is absent for a Permit2 approval known only by its method name. */
    | { kind: 'approval'; token?: Address; grant?: EvmApprovalGrant }
    /** `pair` is absent when either side has no symbol. */
    | { kind: 'swap'; pair?: { from: SwapSide; to: SwapSide } }
    | { kind: 'supply' | 'withdraw' | 'borrow' | 'repay' | 'wrap' | 'unwrap' }
    | { kind: 'add-liquidity' | 'remove-liquidity' | 'collect-fees' }
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
    /** Absent from a backend that predates it, and on a plain transfer. */
    calldata?: { from: Address; data: Hex; value: bigint }
    eip155ChainId?: number
    nftApprovals?: ReadonlySet<string>
}

export type EvmDecodableCall = {
    from: Address
    to: Address
    data: Hex
    value: bigint
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

const AAVE_GATEWAY_ACTIONS: ReadonlyMap<string, PlainActionKind> = new Map([
    ['depositETH', 'supply'],
    ['withdrawETH', 'withdraw'],
    ['withdrawETHWithPermit', 'withdraw'],
    ['borrowETH', 'borrow'],
    ['repayETH', 'repay'],
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
    'collect-fees': i18nKey('transactions.list_item.collect_fees'),
    send: i18nKey('transactions.list_item.send'),
    receive: i18nKey('transactions.list_item.receive'),
}

const APPROVE_ASSET = i18nKey('transactions.list_item.approve_asset')
const APPROVE_ALL = i18nKey('transactions.list_item.approve_all')
const APPROVAL = i18nKey('transactions.list_item.approval')
const REVOKE_APPROVAL = i18nKey('transactions.list_item.revoke_approval')
const APPROVAL_FOR = i18nKey('transactions.list_item.approval_for')
const UNLIMITED_APPROVAL_FOR = i18nKey(
    'transactions.list_item.unlimited_approval_for',
)
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
        case 'aave-v3-gateway': {
            return actionByMethod(AAVE_GATEWAY_ACTIONS, facts.method)
        }
        case 'wrapped-native': {
            return actionByMethod(WRAPPED_NATIVE_ACTIONS, facts.method)
        }
        case 'uniswap-v3-position-manager':
        case 'uniswap-v4-position-manager': {
            return positionAction(facts)
        }
        case 'uniswap-universal-router':
        case 'uniswap-permit2':
        case 'aave-v3-rewards':
        case 'aave-v3-adapter': {
            return shapeAction(facts)
        }
    }
}

const spenderNameOf = (
    eip155ChainId: Optional<number>,
    spender: Address,
): Optional<string> => {
    const known =
        eip155ChainId === undefined
            ? undefined
            : findKnownEvmContract(eip155ChainId, spender)
    return known && (known.projectName ?? known.name)
}

const isUnlimitedAllowance = (value: Decimal): boolean =>
    toAllowanceAmount(BigInt(value.toFixed())) === undefined

const grantOf = (
    spender: Address,
    call: EvmStandardCall,
    eip155ChainId: Optional<number>,
): EvmApprovalGrant => {
    const spenderName = spenderNameOf(eip155ChainId, spender)
    return {
        spender,
        ...(spenderName && { spenderName }),
        isUnlimited:
            (call.kind === 'approve' || call.kind === 'increase-allowance') &&
            isUnlimitedAllowance(call.value),
        // `approve` to the zero address is how ERC-721 clears a token's approval.
        isRevocation:
            isEvmRevocationCall(call) ||
            (call.kind === 'approve' &&
                areEvmAddressesEqual(spender, zeroAddress)),
        isCollection: call.kind === 'set-approval-for-all',
    }
}

const grantOfStandardCall = (
    call: EvmStandardCall,
    eip155ChainId: Optional<number>,
): Optional<EvmApprovalGrant> => {
    if (call.kind === 'set-approval-for-all') {
        return grantOf(call.operator, call, eip155ChainId)
    }
    return 'spender' in call
        ? grantOf(call.spender, call, eip155ChainId)
        : undefined
}

/**
 * The approval a call grants or revokes, named whatever the capabilities, as
 * signing names it. A Permit2 `approve` is read only on the registry's Permit2.
 */
export const approvalActionOfCall = (
    call: EvmDecodableCall,
    contract: Optional<KnownEvmContract>,
    eip155ChainId: Optional<number>,
    nftApprovals?: ReadonlySet<string>,
): Optional<EvmHistoryAction> => {
    const standard = decodeEvmStandardCall(call)
    const nftAssetId =
        standard?.kind === 'approve' && nftApprovals
            ? nftApprovalIdOf(standard, nftApprovals)
            : undefined
    if (standard?.kind === 'approve' && nftAssetId) {
        const spenderName = spenderNameOf(eip155ChainId, standard.spender)
        return {
            kind: 'approval',
            token: call.to,
            grant: {
                spender: standard.spender,
                ...(spenderName && { spenderName }),
                isUnlimited: false,
                isRevocation: isEvmRevocationCall(standard, true),
                isCollection: false,
                nftAssetId,
            },
        }
    }
    if (standard && isEvmApprovalCall(standard)) {
        const grant = grantOfStandardCall(standard, eip155ChainId)
        return { kind: 'approval', token: call.to, ...(grant && { grant }) }
    }
    if (contract?.kind !== 'uniswap-permit2') return undefined
    const permit2 = decodePermit2Approval(call)
    if (!permit2) return undefined
    const spenderName = spenderNameOf(eip155ChainId, permit2.spender)
    return {
        kind: 'approval',
        token: permit2.token,
        grant: {
            spender: permit2.spender,
            ...(spenderName && { spenderName }),
            isUnlimited: toAllowanceAmount(permit2.amount) === undefined,
            isRevocation: permit2.amount === 0n,
            isCollection: false,
        },
    }
}

// The calldata names the action; the amounts, and so a swap's pair, still come
// from the balance changes, which are what actually moved.
const calldataAction = (
    facts: EvmHistoryCallFacts,
    call: EvmDecodableCall,
    contract: KnownEvmContract,
): Optional<EvmHistoryAction> => {
    const action = decodeEvmContractAction(
        call,
        contract,
        facts.eip155ChainId === undefined
            ? undefined
            : wrappedNativeOf(facts.eip155ChainId),
    )
    if (!action) return undefined
    if (action.kind !== 'swap') return { kind: action.kind }
    const shaped = shapeAction(facts)
    return shaped?.kind === 'swap' && shaped.pair
        ? { kind: 'swap', pair: shaped.pair }
        : { kind: 'swap' }
}

/**
 * What a mined call the account sent did, read from its calldata when the row
 * carries it and from its method name and balance changes otherwise. An
 * approval is named whatever the capabilities, as signing names it; anything
 * else only while `isDecoding`.
 */
export const classifyEvmHistoryCall = (
    facts: EvmHistoryCallFacts,
): Optional<EvmHistoryAction> => {
    const {
        to,
        method,
        contract,
        isDecoding,
        calldata,
        eip155ChainId,
        nftApprovals,
    } = facts
    const call = calldata && { ...calldata, to }
    const approval =
        call &&
        approvalActionOfCall(call, contract, eip155ChainId, nftApprovals)
    if (approval) return approval
    if (method !== null && isApprovalMethod(method)) {
        return contract?.kind === 'uniswap-permit2'
            ? { kind: 'approval' }
            : { kind: 'approval', token: to }
    }
    if (!isDecoding) return undefined
    const decoded = call && contract && calldataAction(facts, call, contract)
    if (decoded) return decoded
    return contract ? knownContractAction(facts, contract) : shapeAction(facts)
}

/** The subtitle naming a well-known contract; a proper noun, never translated. */
export const knownContractSubtitle = (
    contract: Pick<KnownEvmContract, 'name' | 'projectName'>,
): Pick<
    TransactionSummary,
    'subtitle' | 'subtitleEllipsis' | 'projectName'
> => {
    const projectName = contract.projectName ?? contract.name
    return {
        subtitle: { key: INTERPRETED_TITLE, params: { title: projectName } },
        subtitleEllipsis: 'tail',
        projectName,
    }
}

const spenderNaming = (
    name: string,
    isUnlimited: boolean,
): Pick<
    TransactionSummary,
    'subtitle' | 'subtitleEllipsis' | 'projectName'
> => ({
    subtitle: {
        key: isUnlimited ? UNLIMITED_APPROVAL_FOR : APPROVAL_FOR,
        params: { spender: name },
    },
    subtitleEllipsis: 'tail',
    projectName: name,
})

/** Names an approval row's spender after the fact, keeping whether the grant was unlimited. */
export const withApprovalSpenderName = (
    summary: TransactionSummary,
    name: string,
): TransactionSummary => ({
    ...summary,
    ...spenderNaming(name, summary.subtitle?.key === UNLIMITED_APPROVAL_FOR),
})

type ApprovalAction = Extract<EvmHistoryAction, { kind: 'approval' }>

const approvalTitleOf = (
    { token, grant }: ApprovalAction,
    chain: EvmChain,
): Pick<TransactionSummary, 'title' | 'titleAssets'> => {
    if (grant?.isRevocation) return { title: { key: REVOKE_APPROVAL } }
    if (!token) return { title: { key: APPROVAL } }
    if (grant?.nftAssetId) {
        return {
            title: {
                key: APPROVE_ASSET,
                params: { asset: truncateEvmAddress(token) },
            },
            titleAssets: {
                asset: { chainId: chain.row.id, assetId: grant.nftAssetId },
            },
        }
    }
    // A collection isn't a fungible asset the store could name.
    if (grant?.isCollection) {
        return {
            title: {
                key: APPROVE_ALL,
                params: { collection: truncateEvmAddress(token) },
            },
        }
    }
    return {
        title: {
            key: APPROVE_ASSET,
            params: { asset: truncateEvmAddress(token) },
        },
        titleAssets: {
            asset: {
                chainId: chain.row.id,
                assetId: normalizeEvmAddress(token),
            },
        },
    }
}

// A limited allowance has no amount line: `approve` shares its selector with
// ERC-721, so the value may be a token id, which only the token can tell apart.
const grantPartyOf = (
    grant: EvmApprovalGrant,
): Pick<
    TransactionSummary,
    'counterparty' | 'subtitle' | 'subtitleEllipsis'
> => {
    const counterparty = normalizeEvmAddress(grant.spender)
    const isUnlimited = grant.isUnlimited && !grant.isRevocation
    if (grant.spenderName) {
        return {
            counterparty,
            ...spenderNaming(grant.spenderName, isUnlimited),
        }
    }
    if (!isUnlimited) return { counterparty }
    return {
        counterparty,
        subtitle: {
            key: UNLIMITED_APPROVAL_FOR,
            params: { spender: truncateEvmAddress(grant.spender) },
        },
    }
}

/**
 * An approval drops `base`'s counterparty: the call's target is the token, which would read as
 * the spender. Its calldata, when read, names the spender instead. Pass `contract` only where
 * naming it is allowed.
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
        ...(contract && knownContractSubtitle(contract)),
        ...(action.isInferred && { isInferred: true }),
    }
    switch (action.kind) {
        case 'approval': {
            const { counterparty: _target, ...approval } = named
            if (!action.grant) {
                return {
                    ...approval,
                    kind: 'approval',
                    icon: 'approval',
                    ...approvalTitleOf(action, chain),
                }
            }
            // The token's protocol name would stand in for the spender, the one
            // party an approval row has to show.
            const {
                subtitle: _protocol,
                subtitleEllipsis: _cut,
                projectName: _tokenProject,
                ...granted
            } = approval
            return {
                ...granted,
                kind: 'approval',
                icon: 'approval',
                ...approvalTitleOf(action, chain),
                ...grantPartyOf(action.grant),
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
            const isTransfer =
                action.kind === 'send' || action.kind === 'receive'
            return {
                ...named,
                kind: 'contract-call',
                title: { key: TITLE_KEYS[action.kind] },
                ...(!isTransfer && { isProtocolAction: true }),
            }
        }
    }
}
