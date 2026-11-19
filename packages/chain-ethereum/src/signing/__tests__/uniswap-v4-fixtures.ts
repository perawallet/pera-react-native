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
    encodeAbiParameters,
    encodeFunctionData,
    parseAbi,
    parseAbiParameters,
    toHex,
    zeroAddress,
} from 'viem'
import type { Address, Hex } from 'viem'

// Built, not recorded: V4 plans laid out as v4-periphery's CalldataDecoder reads them.

export type PoolKey = {
    currency0: Address
    currency1: Address
    fee: number
    tickSpacing: number
    hooks: Address
}

export type Layout = 'without-hop-price' | 'with-hop-price'

/** One planned action: its V4 action id and its encoded parameters. */
export type PlannedAction = readonly [number, Hex]

export const MSG_SENDER: Address = '0x0000000000000000000000000000000000000001'
export const ROUTER_SELF: Address = '0x0000000000000000000000000000000000000002'
export const CONTRACT_BALANCE = 2n ** 255n

const POOL_KEY =
    '(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey'
const PATH_KEY =
    '(address intermediateCurrency, uint24 fee, int24 tickSpacing, address hooks, bytes hookData)[] path'

const SINGLE = {
    'without-hop-price': parseAbiParameters(
        `(${POOL_KEY}, bool zeroForOne, uint128 amount, uint128 limit, bytes hookData) params`,
    ),
    'with-hop-price': parseAbiParameters(
        `(${POOL_KEY}, bool zeroForOne, uint128 amount, uint128 limit, uint256 minHopPriceX36, bytes hookData) params`,
    ),
}

const PATH = {
    'without-hop-price': parseAbiParameters(
        `(address currency, ${PATH_KEY}, uint128 amount, uint128 limit) params`,
    ),
    'with-hop-price': parseAbiParameters(
        `(address currency, ${PATH_KEY}, uint256[] minHopPriceX36, uint128 amount, uint128 limit) params`,
    ),
}

const encode = (types: string, values: readonly unknown[]): Hex =>
    encodeAbiParameters(parseAbiParameters(types), values)

const singleSwap =
    (id: number) =>
    (
        key: PoolKey,
        zeroForOne: boolean,
        amount: bigint,
        limit: bigint,
        layout: Layout,
    ): PlannedAction => [
        id,
        encodeAbiParameters(SINGLE[layout], [
            {
                poolKey: key,
                zeroForOne,
                amount,
                limit,
                ...(layout === 'with-hop-price' && { minHopPriceX36: 0n }),
                hookData: '0x',
            },
        ] as never),
    ]

const pathSwap =
    (id: number) =>
    (
        currency: Address,
        hops: readonly Address[],
        amount: bigint,
        limit: bigint,
        layout: Layout,
    ): PlannedAction => [
        id,
        encodeAbiParameters(PATH[layout], [
            {
                currency,
                path: hops.map(intermediateCurrency => ({
                    intermediateCurrency,
                    fee: 3000,
                    tickSpacing: 60,
                    hooks: zeroAddress,
                    hookData: '0x',
                })),
                ...(layout === 'with-hop-price' && { minHopPriceX36: [] }),
                amount,
                limit,
            },
        ] as never),
    ]

export const swapExactInSingle = singleSwap(0x06)
/** `currency` is the currency in; the path runs forward to the currency out. */
export const swapExactIn = pathSwap(0x07)
export const swapExactOutSingle = singleSwap(0x08)
/** `currency` is the currency out; the path's first hop is the currency in. */
export const swapExactOut = pathSwap(0x09)

export const settle = (
    currency: Address,
    amount: bigint,
    payerIsUser: boolean,
): PlannedAction => [
    0x0b,
    encode('address, uint256, bool', [currency, amount, payerIsUser]),
]
export const settleAll = (
    currency: Address,
    maxAmount: bigint,
): PlannedAction => [0x0c, encode('address, uint256', [currency, maxAmount])]
export const settlePair = (
    currency0: Address,
    currency1: Address,
): PlannedAction => [0x0d, encode('address, address', [currency0, currency1])]
export const take = (
    currency: Address,
    recipient: Address,
    amount: bigint,
): PlannedAction => [
    0x0e,
    encode('address, address, uint256', [currency, recipient, amount]),
]
export const takeAll = (
    currency: Address,
    minAmount: bigint,
): PlannedAction => [0x0f, encode('address, uint256', [currency, minAmount])]
export const takePortion = (
    currency: Address,
    recipient: Address,
    bips: bigint,
): PlannedAction => [
    0x10,
    encode('address, address, uint256', [currency, recipient, bips]),
]
export const takePair = (
    currency0: Address,
    currency1: Address,
    recipient: Address,
): PlannedAction => [
    0x11,
    encode('address, address, address', [currency0, currency1, recipient]),
]
export const closeCurrency = (currency: Address): PlannedAction => [
    0x12,
    encode('address', [currency]),
]
export const clearOrTake = (
    currency: Address,
    amountMax: bigint,
): PlannedAction => [0x13, encode('address, uint256', [currency, amountMax])]
export const sweep = (currency: Address, recipient: Address): PlannedAction => [
    0x14,
    encode('address, address', [currency, recipient]),
]
export const increase = (tokenId: bigint, liquidity: bigint): PlannedAction => [
    0x00,
    encode('uint256, uint256, uint128, uint128, bytes', [
        tokenId,
        liquidity,
        2n ** 128n - 1n,
        2n ** 128n - 1n,
        '0x',
    ]),
]
export const decrease = (tokenId: bigint, liquidity: bigint): PlannedAction => [
    0x01,
    encode('uint256, uint256, uint128, uint128, bytes', [
        tokenId,
        liquidity,
        0n,
        0n,
        '0x',
    ]),
]
export const mint = (
    key: PoolKey,
    amount0Max: bigint,
    amount1Max: bigint,
    owner: Address,
): PlannedAction => [
    0x02,
    encode(
        `${POOL_KEY}, int24, int24, uint256, uint128, uint128, address, bytes`,
        [
            key,
            -887_220,
            887_220,
            10n ** 12n,
            amount0Max,
            amount1Max,
            owner,
            '0x',
        ],
    ),
]
export const burn = (tokenId: bigint): PlannedAction => [
    0x03,
    encode('uint256, uint128, uint128, bytes', [tokenId, 0n, 0n, '0x']),
]

/** The `(bytes actions, bytes[] params)` plan a V4 router or the position manager unlocks with. */
export const plan = (...actions: readonly PlannedAction[]): Hex =>
    encode('bytes, bytes[]', [
        toHex(new Uint8Array(actions.map(([id]) => id))),
        actions.map(([, params]) => params),
    ])

const EXECUTE = parseAbi([
    'function execute(bytes commands, bytes[] inputs, uint256 deadline)',
])

/** A router command: its byte and its encoded input. */
export type RouterCommand = readonly [number, Hex]

export const V4_SWAP_COMMAND = 0x10

export const routerPermit = (
    token: Address,
    spender: Address,
): RouterCommand => [
    0x0a,
    encode(
        '((address token, uint160 amount, uint48 expiration, uint48 nonce) details, address spender, uint256 sigDeadline), bytes',
        [
            {
                details: {
                    token,
                    amount: 2n ** 160n - 1n,
                    expiration: 1_800_000_000,
                    nonce: 0,
                },
                spender,
                sigDeadline: 1_800_000_000n,
            },
            '0x1234',
        ],
    ),
]

export const routerSweep = (
    token: Address,
    recipient: Address,
    amountMin: bigint,
): RouterCommand => [
    0x04,
    encode('address, address, uint256', [token, recipient, amountMin]),
]

export const routerPayPortion = (
    token: Address,
    recipient: Address,
    bips: bigint,
): RouterCommand => [
    0x06,
    encode('address, address, uint256', [token, recipient, bips]),
]

export const routerExecute = (...commands: readonly RouterCommand[]): Hex =>
    encodeFunctionData({
        abi: EXECUTE,
        functionName: 'execute',
        args: [
            toHex(new Uint8Array(commands.map(([id]) => id))),
            commands.map(([, input]) => input),
            1_800_000_000n,
        ],
    })

export const v4Swap = (...actions: readonly PlannedAction[]): RouterCommand => [
    V4_SWAP_COMMAND,
    plan(...actions),
]
