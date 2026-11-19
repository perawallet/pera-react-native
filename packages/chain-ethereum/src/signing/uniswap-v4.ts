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

import {
    decodeAbiParameters,
    encodeAbiParameters,
    getAddress,
    hexToBytes,
    parseAbiParameters,
    zeroAddress,
} from 'viem'
import type { AbiParameter, Address, Hex } from 'viem'
import type { Optional } from '@perawallet/wallet-core-shared'
import { areEvmAddressesEqual } from '../accounts/address-codec'

// Recipient aliases V4 resolves itself: the caller that unlocked, and the contract.
export const V4_MSG_SENDER: Address =
    '0x0000000000000000000000000000000000000001'
export const V4_ADDRESS_THIS: Address =
    '0x0000000000000000000000000000000000000002'

// An amount of 0 means "the open delta": whatever the pool manager says is owed.
export const V4_OPEN_DELTA = 0n
// "Whatever the contract holds".
export const V4_CONTRACT_BALANCE = 2n ** 255n

// The router reverts a portion over 10 000 bips of the credit.
const MAX_PORTION_BIPS = 10_000n

const INCREASE_LIQUIDITY = 0x00
const DECREASE_LIQUIDITY = 0x01
const MINT_POSITION = 0x02
const BURN_POSITION = 0x03
const SWAP_EXACT_IN_SINGLE = 0x06
const SWAP_EXACT_IN = 0x07
const SWAP_EXACT_OUT_SINGLE = 0x08
const SWAP_EXACT_OUT = 0x09
const SETTLE = 0x0b
const SETTLE_ALL = 0x0c
const SETTLE_PAIR = 0x0d
const TAKE = 0x0e
const TAKE_ALL = 0x0f
const TAKE_PORTION = 0x10
const TAKE_PAIR = 0x11
const CLOSE_CURRENCY = 0x12
const SWEEP = 0x14

const POOL_KEY =
    '(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey'
const PATH_KEY =
    '(address intermediateCurrency, uint24 fee, int24 tickSpacing, address hooks, bytes hookData)[] path'

/** How a V4 swap's parameters are laid out: routers from 2.1 add a per-hop minimum price. */
export type V4SwapLayout = 'without-hop-price' | 'with-hop-price'

const SINGLE_SWAP_INPUTS: Record<V4SwapLayout, readonly AbiParameter[]> = {
    'without-hop-price': parseAbiParameters(
        `(${POOL_KEY}, bool zeroForOne, uint128 amount, uint128 limit, bytes hookData) params`,
    ),
    'with-hop-price': parseAbiParameters(
        `(${POOL_KEY}, bool zeroForOne, uint128 amount, uint128 limit, uint256 minHopPriceX36, bytes hookData) params`,
    ),
}

const PATH_SWAP_INPUTS: Record<V4SwapLayout, readonly AbiParameter[]> = {
    'without-hop-price': parseAbiParameters(
        `(address currency, ${PATH_KEY}, uint128 amount, uint128 limit) params`,
    ),
    'with-hop-price': parseAbiParameters(
        `(address currency, ${PATH_KEY}, uint256[] minHopPriceX36, uint128 amount, uint128 limit) params`,
    ),
}

const ACTIONS_INPUT = parseAbiParameters('bytes actions, bytes[] params')
const CURRENCY_INPUT = parseAbiParameters('address currency')
const CURRENCY_AMOUNT_INPUT = parseAbiParameters(
    'address currency, uint256 amount',
)
const CURRENCY_AMOUNT_PAYER_INPUT = parseAbiParameters(
    'address currency, uint256 amount, bool payerIsUser',
)
const CURRENCY_RECIPIENT_AMOUNT_INPUT = parseAbiParameters(
    'address currency, address recipient, uint256 amount',
)
const CURRENCY_PAIR_INPUT = parseAbiParameters(
    'address currency0, address currency1',
)
const CURRENCY_PAIR_RECIPIENT_INPUT = parseAbiParameters(
    'address currency0, address currency1, address recipient',
)
const CURRENCY_RECIPIENT_INPUT = parseAbiParameters(
    'address currency, address recipient',
)
const MODIFY_LIQUIDITY_INPUT = parseAbiParameters(
    'uint256 tokenId, uint256 liquidity, uint128 amount0, uint128 amount1, bytes hookData',
)
const MINT_INPUT = parseAbiParameters(
    `${POOL_KEY}, int24 tickLower, int24 tickUpper, uint256 liquidity, uint128 amount0Max, uint128 amount1Max, address owner, bytes hookData`,
)
const BURN_INPUT = parseAbiParameters(
    'uint256 tokenId, uint128 amount0Min, uint128 amount1Min, bytes hookData',
)

/** Currency `address(0)` is the chain's native coin, never a token. */
export type V4PoolKey = {
    currency0: Address
    currency1: Address
    fee: number
    tickSpacing: number
    hooks: Address
}

/** One V4 action. Amounts are base units of the currency named beside them. */
export type V4Action =
    | {
          kind: 'swap'
          isExactIn: boolean
          currencyIn: Address
          currencyOut: Address
          /** The amount in for exact-in; the amount out for exact-out. */
          amount: bigint
          /** The minimum out for exact-in; the maximum in for exact-out. */
          limit: bigint
      }
    | {
          kind: 'settle'
          currency: Address
          amount: bigint
          payerIsUser: boolean
      }
    | { kind: 'settle-all'; currency: Address; maxAmount: bigint }
    | { kind: 'settle-pair'; currency0: Address; currency1: Address }
    | { kind: 'take'; currency: Address; recipient: Address; amount: bigint }
    | { kind: 'take-all'; currency: Address; minAmount: bigint }
    | {
          kind: 'take-portion'
          currency: Address
          recipient: Address
          bips: number
      }
    | {
          kind: 'take-pair'
          currency0: Address
          currency1: Address
          recipient: Address
      }
    | { kind: 'close-currency'; currency: Address }
    | { kind: 'sweep'; currency: Address; recipient: Address }
    | {
          kind: 'mint'
          poolKey: V4PoolKey
          amount0Max: bigint
          amount1Max: bigint
          owner: Address
      }
    | { kind: 'increase'; tokenId: bigint; liquidity: bigint }
    | { kind: 'decrease'; tokenId: bigint; liquidity: bigint }
    | { kind: 'burn'; tokenId: bigint }

const decodeExactly = (
    parameters: readonly AbiParameter[],
    input: Hex,
): Optional<readonly unknown[]> => {
    try {
        const values = decodeAbiParameters(parameters, input)
        const encoded = encodeAbiParameters(parameters, values)
        return encoded.toLowerCase() === input.toLowerCase()
            ? values
            : undefined
    } catch {
        return undefined
    }
}

const addressOf = (value: unknown): Address => getAddress(value as Address)

const poolKeyOf = (value: unknown): V4PoolKey => {
    const key = value as V4PoolKey
    return {
        currency0: getAddress(key.currency0),
        currency1: getAddress(key.currency1),
        fee: key.fee,
        tickSpacing: key.tickSpacing,
        hooks: getAddress(key.hooks),
    }
}

type SwapParams = {
    poolKey?: V4PoolKey
    zeroForOne?: boolean
    currency?: Address
    path?: readonly { intermediateCurrency: Address }[]
    amount: bigint
    limit: bigint
}

const swapAction = (
    type: number,
    input: Hex,
    layout: V4SwapLayout,
): Optional<V4Action> => {
    const isSingle =
        type === SWAP_EXACT_IN_SINGLE || type === SWAP_EXACT_OUT_SINGLE
    const isExactIn = type === SWAP_EXACT_IN_SINGLE || type === SWAP_EXACT_IN
    const values = decodeExactly(
        (isSingle ? SINGLE_SWAP_INPUTS : PATH_SWAP_INPUTS)[layout],
        input,
    )
    if (!values) return undefined
    const params = values[0] as SwapParams
    let currencyIn: Address
    let currencyOut: Address
    if (isSingle) {
        const key = poolKeyOf(params.poolKey)
        const [from, to] = params.zeroForOne
            ? [key.currency0, key.currency1]
            : [key.currency1, key.currency0]
        currencyIn = from
        currencyOut = to
    } else {
        const path = params.path ?? []
        if (path.length === 0) return undefined
        const named = addressOf(params.currency)
        // Exact-out walks the path backwards from the currency out, so its far end is the currency in.
        const farEnd = addressOf(
            (isExactIn ? path.at(-1)! : path[0]).intermediateCurrency,
        )
        currencyIn = isExactIn ? named : farEnd
        currencyOut = isExactIn ? farEnd : named
    }
    return {
        kind: 'swap',
        isExactIn,
        currencyIn,
        currencyOut,
        amount: params.amount,
        limit: params.limit,
    }
}

const actionOf = (
    type: number,
    input: Hex,
    layout: Optional<V4SwapLayout>,
): Optional<V4Action> => {
    switch (type) {
        case SWAP_EXACT_IN_SINGLE:
        case SWAP_EXACT_IN:
        case SWAP_EXACT_OUT_SINGLE:
        case SWAP_EXACT_OUT: {
            return layout && swapAction(type, input, layout)
        }
        case SETTLE: {
            const values = decodeExactly(CURRENCY_AMOUNT_PAYER_INPUT, input)
            return (
                values && {
                    kind: 'settle',
                    currency: addressOf(values[0]),
                    amount: values[1] as bigint,
                    payerIsUser: values[2] as boolean,
                }
            )
        }
        case SETTLE_ALL:
        case TAKE_ALL: {
            const values = decodeExactly(CURRENCY_AMOUNT_INPUT, input)
            if (!values) return undefined
            const currency = addressOf(values[0])
            const amount = values[1] as bigint
            return type === SETTLE_ALL
                ? { kind: 'settle-all', currency, maxAmount: amount }
                : { kind: 'take-all', currency, minAmount: amount }
        }
        case SETTLE_PAIR: {
            const values = decodeExactly(CURRENCY_PAIR_INPUT, input)
            return (
                values && {
                    kind: 'settle-pair',
                    currency0: addressOf(values[0]),
                    currency1: addressOf(values[1]),
                }
            )
        }
        case TAKE:
        case TAKE_PORTION: {
            const values = decodeExactly(CURRENCY_RECIPIENT_AMOUNT_INPUT, input)
            if (!values) return undefined
            const currency = addressOf(values[0])
            const recipient = addressOf(values[1])
            const amount = values[2] as bigint
            if (type === TAKE)
                return { kind: 'take', currency, recipient, amount }
            return amount > 0n && amount <= MAX_PORTION_BIPS
                ? {
                      kind: 'take-portion',
                      currency,
                      recipient,
                      bips: Number(amount),
                  }
                : undefined
        }
        case TAKE_PAIR: {
            const values = decodeExactly(CURRENCY_PAIR_RECIPIENT_INPUT, input)
            return (
                values && {
                    kind: 'take-pair',
                    currency0: addressOf(values[0]),
                    currency1: addressOf(values[1]),
                    recipient: addressOf(values[2]),
                }
            )
        }
        case CLOSE_CURRENCY: {
            const values = decodeExactly(CURRENCY_INPUT, input)
            return (
                values && {
                    kind: 'close-currency',
                    currency: addressOf(values[0]),
                }
            )
        }
        case SWEEP: {
            const values = decodeExactly(CURRENCY_RECIPIENT_INPUT, input)
            return (
                values && {
                    kind: 'sweep',
                    currency: addressOf(values[0]),
                    recipient: addressOf(values[1]),
                }
            )
        }
        case INCREASE_LIQUIDITY:
        case DECREASE_LIQUIDITY: {
            const values = decodeExactly(MODIFY_LIQUIDITY_INPUT, input)
            if (!values) return undefined
            const tokenId = values[0] as bigint
            const liquidity = values[1] as bigint
            return type === INCREASE_LIQUIDITY
                ? { kind: 'increase', tokenId, liquidity }
                : { kind: 'decrease', tokenId, liquidity }
        }
        case MINT_POSITION: {
            const values = decodeExactly(MINT_INPUT, input)
            return (
                values && {
                    kind: 'mint',
                    poolKey: poolKeyOf(values[0]),
                    amount0Max: values[4] as bigint,
                    amount1Max: values[5] as bigint,
                    owner: addressOf(values[6]),
                }
            )
        }
        case BURN_POSITION: {
            const values = decodeExactly(BURN_INPUT, input)
            return values && { kind: 'burn', tokenId: values[0] as bigint }
        }
        default: {
            return undefined
        }
    }
}

/**
 * The actions an encoded `(bytes actions, bytes[] params)` plan runs, or
 * undefined unless every action is one this reads and re-encodes byte for byte.
 * Swaps are read only with a `layout`, which only the router's release can say.
 */
export const readV4Actions = (
    plan: Hex,
    layout: Optional<V4SwapLayout>,
): Optional<V4Action[]> => {
    const values = decodeExactly(ACTIONS_INPUT, plan)
    if (!values) return undefined
    const types = hexToBytes(values[0] as Hex)
    const params = values[1] as readonly Hex[]
    if (types.length === 0 || types.length !== params.length) return undefined
    const actions: V4Action[] = []
    for (const [index, type] of types.entries()) {
        const action = actionOf(type, params[index], layout)
        if (!action) return undefined
        actions.push(action)
    }
    return actions
}

export const isV4Native = (currency: Address): boolean =>
    areEvmAddressesEqual(currency, zeroAddress)

/** Whether a V4 recipient resolves to the caller: its alias or its own address. */
export const isV4Caller = (recipient: Address, caller: Address): boolean =>
    areEvmAddressesEqual(recipient, V4_MSG_SENDER) ||
    areEvmAddressesEqual(recipient, caller)
