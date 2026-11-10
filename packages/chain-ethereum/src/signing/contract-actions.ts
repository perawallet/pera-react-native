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
    decodeFunctionData,
    encodeFunctionData,
    getAddress,
    maxUint256,
    parseAbi,
    size,
    slice,
    toFunctionSelector,
    zeroAddress,
} from 'viem'
import type { AbiFunction, Address, Hex } from 'viem'
import {
    i18nKey,
    type I18nKey,
    type TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { areEvmAddressesEqual } from '../accounts/address-codec'
import type { EvmChain } from '../chains/types'
import type { EvmContractAction } from './contract-action-types'
import type { KnownEvmContract } from './known-contracts'
import { decodeUniversalRouterSwap } from './universal-router'

type Call = { from: Address; to: Address; data: Hex; value: bigint }

const SELECTOR_SIZE = 4

const TITLE_KEYS: Record<EvmContractAction['kind'], I18nKey> = {
    swap: i18nKey('transactions.list_item.swap'),
    wrap: i18nKey('transactions.list_item.wrap'),
    unwrap: i18nKey('transactions.list_item.unwrap'),
    supply: i18nKey('transactions.list_item.supply'),
    withdraw: i18nKey('transactions.list_item.withdraw'),
    borrow: i18nKey('transactions.list_item.borrow'),
    repay: i18nKey('transactions.list_item.repay'),
    'add-liquidity': i18nKey('transactions.list_item.add_liquidity'),
    'remove-liquidity': i18nKey('transactions.list_item.remove_liquidity'),
}

const CONTRACT_CALL_ICON = 'contract-call'

const WRAPPED_NATIVE_FUNCTIONS = parseAbi([
    'function deposit()',
    'function withdraw(uint256 wad)',
])

const AAVE_POOL_FUNCTIONS = parseAbi([
    'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
    'function supplyWithPermit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode, uint256 deadline, uint8 permitV, bytes32 permitR, bytes32 permitS)',
    'function withdraw(address asset, uint256 amount, address to)',
    'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)',
    'function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf)',
    'function repayWithPermit(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf, uint256 deadline, uint8 permitV, bytes32 permitR, bytes32 permitS)',
])

const PERMIT2_FUNCTIONS = parseAbi([
    'function approve(address token, address spender, uint160 amount, uint48 expiration)',
])

const UNISWAP_V3_MULTICALL = parseAbi(['function multicall(bytes[] data)'])

const UNISWAP_V3_POSITION_FUNCTIONS = parseAbi([
    'struct MintParams { address token0; address token1; uint24 fee; int24 tickLower; int24 tickUpper; uint256 amount0Desired; uint256 amount1Desired; uint256 amount0Min; uint256 amount1Min; address recipient; uint256 deadline; }',
    'struct IncreaseParams { uint256 tokenId; uint256 amount0Desired; uint256 amount1Desired; uint256 amount0Min; uint256 amount1Min; uint256 deadline; }',
    'struct DecreaseParams { uint256 tokenId; uint128 liquidity; uint256 amount0Min; uint256 amount1Min; uint256 deadline; }',
    'struct CollectParams { uint256 tokenId; address recipient; uint128 amount0Max; uint128 amount1Max; }',
    'function mint(MintParams params)',
    'function increaseLiquidity(IncreaseParams params)',
    'function decreaseLiquidity(DecreaseParams params)',
    'function collect(CollectParams params)',
    'function burn(uint256 tokenId)',
    'function refundETH()',
    'function unwrapWETH9(uint256 amountMinimum, address recipient)',
    'function sweepToken(address token, uint256 amountMinimum, address recipient)',
    'function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96)',
])

const toDecimal = (value: bigint): Decimal => new Decimal(value.toString())

// A lenient decoder would accept dirty padding or trailing bytes the contract
// might read differently, so the call must re-encode to exactly its calldata.
const readFunction = (
    functions: readonly AbiFunction[],
    data: Hex,
): Optional<{ name: string; args: readonly unknown[] }> => {
    if (size(data) < SELECTOR_SIZE) return undefined
    const selector = slice(data, 0, SELECTOR_SIZE).toLowerCase()
    const item = functions.find(
        candidate => toFunctionSelector(candidate) === selector,
    )
    if (!item) return undefined
    const { args = [] } = decodeFunctionData({ abi: [item], data })
    const encoded = encodeFunctionData({ abi: [item], args })
    return encoded.toLowerCase() === data.toLowerCase()
        ? { name: item.name, args }
        : undefined
}

const decodeWrappedNativeAction = (call: Call): Optional<EvmContractAction> => {
    const read = readFunction(WRAPPED_NATIVE_FUNCTIONS, call.data)
    if (read?.name === 'deposit' && call.value > 0n) {
        return { kind: 'wrap', amount: toDecimal(call.value) }
    }
    if (read?.name === 'withdraw' && call.value === 0n) {
        return { kind: 'unwrap', amount: toDecimal(read.args[0] as bigint) }
    }
    return undefined
}

const decodeAavePoolAction = (call: Call): Optional<EvmContractAction> => {
    const read = readFunction(AAVE_POOL_FUNCTIONS, call.data)
    if (!read || call.value !== 0n) return undefined
    const { name, args } = read
    const asset = getAddress(args[0] as Address)
    const amount = args[1] as bigint
    const isForSigner = (address: unknown) =>
        areEvmAddressesEqual(address as Address, call.from)
    const isEntireBalance = amount === maxUint256

    switch (name) {
        case 'supply':
        case 'supplyWithPermit': {
            // The pool reads the largest uint256 as "whatever the signer holds" only for withdraw and repay.
            return isForSigner(args[2]) && !isEntireBalance
                ? {
                      kind: 'supply',
                      asset,
                      amount: toDecimal(amount),
                      isEntireBalance,
                  }
                : undefined
        }
        case 'withdraw': {
            return isForSigner(args[2])
                ? {
                      kind: 'withdraw',
                      asset,
                      amount: toDecimal(amount),
                      isEntireBalance,
                  }
                : undefined
        }
        case 'borrow': {
            return isForSigner(args[4]) && !isEntireBalance
                ? {
                      kind: 'borrow',
                      asset,
                      amount: toDecimal(amount),
                      isEntireBalance,
                  }
                : undefined
        }
        case 'repay':
        case 'repayWithPermit': {
            return isForSigner(args[3])
                ? {
                      kind: 'repay',
                      asset,
                      amount: toDecimal(amount),
                      isEntireBalance,
                  }
                : undefined
        }
        default: {
            return undefined
        }
    }
}

type PositionCall = { name: string; args: readonly unknown[] }

type MintParams = {
    token0: Address
    token1: Address
    fee: number
    amount0Desired: bigint
    amount1Desired: bigint
    recipient: Address
}

type TokenIdParams = { tokenId: bigint }

type CollectParams = TokenIdParams & { recipient: Address }

// The manager's own multicall is unwrapped one level: a nested one fails
// `readFunction` because it is not in the allowed set.
const positionCallsOf = (data: Hex): Optional<PositionCall[]> => {
    const multicall = readFunction(UNISWAP_V3_MULTICALL, data)
    const encoded = multicall ? (multicall.args[0] as readonly Hex[]) : [data]
    const calls: PositionCall[] = []
    for (const item of encoded) {
        const read = readFunction(UNISWAP_V3_POSITION_FUNCTIONS, item)
        if (!read) return undefined
        calls.push(read)
    }
    return calls
}

const decodeLiquidityAdd = (
    calls: PositionCall[],
    call: Call,
    wrappedNative: Optional<Address>,
): Optional<EvmContractAction> => {
    const mints = calls.filter(item => item.name === 'mint')
    const increases = calls.filter(item => item.name === 'increaseLiquidity')
    const refunds = calls.filter(item => item.name === 'refundETH')
    const pools = calls.filter(
        item => item.name === 'createAndInitializePoolIfNecessary',
    )
    if (mints.length + increases.length !== 1) return undefined
    if (refunds.length > 1 || pools.length > 1) return undefined
    // Anything else in the batch is a call this decoder doesn't know.
    if (calls.length !== 1 + refunds.length + pools.length) return undefined
    // Leftover ether is only returned to the signer by an explicit refund.
    if (call.value > 0n && refunds.length === 0) return undefined

    if (increases.length === 1) {
        if (pools.length > 0) return undefined
        const { tokenId } = increases[0].args[0] as TokenIdParams
        return {
            kind: 'add-liquidity',
            deposits: [],
            position: { kind: 'existing', tokenId: tokenId.toString() },
        }
    }

    const mint = mints[0]
    const params = mint.args[0] as MintParams
    if (!areEvmAddressesEqual(params.recipient, call.from)) return undefined
    if (areEvmAddressesEqual(params.token0, params.token1)) return undefined
    if (pools.length === 1) {
        const [token0, token1, fee] = pools[0].args as [
            Address,
            Address,
            number,
        ]
        const isBeforeMint = calls.indexOf(pools[0]) < calls.indexOf(mint)
        if (
            !isBeforeMint ||
            !areEvmAddressesEqual(token0, params.token0) ||
            !areEvmAddressesEqual(token1, params.token1) ||
            fee !== params.fee
        ) {
            return undefined
        }
    }

    const sides = [
        { token: params.token0, max: params.amount0Desired },
        { token: params.token1, max: params.amount1Desired },
    ]
    const isWrapped = (token: Address) =>
        !!wrappedNative && areEvmAddressesEqual(token, wrappedNative)
    const isPaidInNative = call.value > 0n
    if (isPaidInNative) {
        const wrapped = sides.filter(side => isWrapped(side.token))
        if (wrapped.length !== 1 || wrapped[0].max > call.value) {
            return undefined
        }
    }
    return {
        kind: 'add-liquidity',
        deposits: sides.map(side => ({
            asset:
                isPaidInNative && isWrapped(side.token)
                    ? { kind: 'native' as const }
                    : {
                          kind: 'token' as const,
                          contract: getAddress(side.token),
                      },
            maxAmount: toDecimal(side.max),
        })),
        position: { kind: 'new' },
    }
}

const decodeLiquidityRemove = (
    calls: PositionCall[],
    call: Call,
): Optional<EvmContractAction> => {
    if (call.value !== 0n) return undefined
    const [decrease, collect, ...rest] = calls
    if (decrease?.name !== 'decreaseLiquidity') return undefined
    if (collect?.name !== 'collect') return undefined
    const { tokenId } = decrease.args[0] as TokenIdParams
    const collected = collect.args[0] as CollectParams
    if (collected.tokenId !== tokenId) return undefined

    const burn = rest.at(-1)?.name === 'burn' ? rest.at(-1) : undefined
    if (burn && (burn.args[0] as bigint) !== tokenId) return undefined
    const payouts = burn ? rest.slice(0, -1) : rest
    const isForSigner = (address: unknown) =>
        areEvmAddressesEqual(address as Address, call.from)
    const isPaidToSigner = (payout: PositionCall) =>
        (payout.name === 'unwrapWETH9' && isForSigner(payout.args[1])) ||
        (payout.name === 'sweepToken' && isForSigner(payout.args[2]))
    if (!payouts.every(isPaidToSigner)) return undefined

    // A zero recipient leaves the proceeds in the manager, where anyone can sweep
    // them, so it is only safe when both an unwrap and a sweep pay the signer.
    const isCollectedToSigner = isForSigner(collected.recipient)
    const isLeftForPayouts =
        areEvmAddressesEqual(collected.recipient, zeroAddress) &&
        payouts.some(payout => payout.name === 'unwrapWETH9') &&
        payouts.some(payout => payout.name === 'sweepToken')
    if (!isCollectedToSigner && !isLeftForPayouts) return undefined

    return {
        kind: 'remove-liquidity',
        tokenId: tokenId.toString(),
        isClosing: !!burn,
    }
}

const decodeUniswapV3PositionAction = (
    call: Call,
    wrappedNative: Optional<Address>,
): Optional<EvmContractAction> => {
    const calls = positionCallsOf(call.data)
    if (!calls) return undefined
    if (
        calls.some(
            item => item.name === 'mint' || item.name === 'increaseLiquidity',
        )
    ) {
        return decodeLiquidityAdd(calls, call, wrappedNative)
    }
    return decodeLiquidityRemove(calls, call)
}

/**
 * What a call to a known contract does, or undefined unless its calldata
 * decodes exactly to an action this knows. Never throws.
 */
export const decodeEvmContractAction = (
    call: Call,
    contract: KnownEvmContract,
    wrappedNative: Optional<Address>,
): Optional<EvmContractAction> => {
    try {
        switch (contract.kind) {
            case 'uniswap-universal-router': {
                return decodeUniversalRouterSwap(call, wrappedNative)
            }
            case 'wrapped-native': {
                return decodeWrappedNativeAction(call)
            }
            case 'aave-v3-pool': {
                return decodeAavePoolAction(call)
            }
            case 'uniswap-v3-position-manager': {
                return decodeUniswapV3PositionAction(call, wrappedNative)
            }
            case 'uniswap-permit2':
            case 'uniswap-v4-position-manager': {
                return undefined
            }
        }
    } catch {
        return undefined
    }
}

/**
 * A Permit2 `approve`, or undefined unless the calldata re-encodes to exactly
 * it and the call sends no ether. `amount` is in base units of `token`. Never
 * throws. Review doesn't read it: Permit2 stays a plain contract call there.
 */
export const decodePermit2Approval = (call: {
    data: Hex
    value: bigint
}): Optional<{ token: Address; spender: Address; amount: bigint }> => {
    if (call.value !== 0n) return undefined
    try {
        const read = readFunction(PERMIT2_FUNCTIONS, call.data)
        if (!read) return undefined
        const [token, spender, amount] = read.args as [Address, Address, bigint]
        return {
            token: getAddress(token),
            spender: getAddress(spender),
            amount,
        }
    } catch {
        return undefined
    }
}

/** The review and history title for an action: `transactions.list_item.<kind>`. */
export const contractActionTitleKeyOf = (action: EvmContractAction): I18nKey =>
    TITLE_KEYS[action.kind]

/**
 * Whether a decoded action stands in for the unknown-contract notice. A swap
 * that pays a third party out of its output doesn't: the notice stays beside
 * the fee, so a fee can never be what silences it.
 */
export const hidesUnknownContractNotice = (
    action: Optional<EvmContractAction>,
): boolean => !!action && (action.kind !== 'swap' || action.fees.length === 0)

/** A contract call's summary, titled for what its calldata proves it does. */
export const contractActionSummary = (
    action: EvmContractAction,
    call: { from: Address; to?: Address; data: Hex; value: bigint },
    chain: EvmChain,
): TransactionSummary => ({
    kind: action.kind === 'swap' ? 'swap' : 'contract-call',
    title: { key: contractActionTitleKeyOf(action) },
    direction: call.value > 0n ? 'out' : 'none',
    ...(call.to && { counterparty: call.to }),
    ...(call.value > 0n && {
        amount: {
            assetRef: chain.descriptor.nativeAsset.ref,
            value: toDecimal(call.value),
        },
    }),
    icon: action.kind === 'swap' ? 'swap' : CONTRACT_CALL_ICON,
})
