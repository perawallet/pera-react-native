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

import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import { encodeFunctionData, parseAbi, zeroAddress } from 'viem'
import type { Address, Hex } from 'viem'
import { decodeEvmContractAction } from '../contract-actions'
import { findKnownEvmContract } from '../known-contracts'
import { SENDER } from './fixtures'
import {
    MSG_SENDER,
    ROUTER_SELF,
    burn,
    clearOrTake,
    closeCurrency,
    decrease,
    increase,
    mint,
    plan,
    settle,
    settlePair,
    sweep,
    swapExactInSingle,
    take,
    takePair,
    type PoolKey,
} from './uniswap-v4-fixtures'

const MANAGER: Address = '0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e'
const WETH: Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const USDC: Address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const OTHER: Address = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const TOKEN_ID = 41_234n
const ETH_MAX = 5n * 10n ** 16n
const USDC_MAX = 150_000_000n

const ETH_USDC: PoolKey = {
    currency0: zeroAddress,
    currency1: USDC,
    fee: 500,
    tickSpacing: 10,
    hooks: zeroAddress,
}
const USDC_WETH: PoolKey = { ...ETH_USDC, currency0: USDC, currency1: WETH }

const MANAGER_ABI = parseAbi([
    'function modifyLiquidities(bytes unlockData, uint256 deadline)',
    'function modifyLiquiditiesWithoutUnlock(bytes actions, bytes[] params)',
    'function multicall(bytes[] data)',
    'function initializePool((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96)',
    'function permitBatch(address owner, ((address token, uint160 amount, uint48 expiration, uint48 nonce)[] details, address spender, uint256 sigDeadline) _permitBatch, bytes signature)',
    'function permit(address spender, uint256 tokenId, uint256 deadline, uint256 nonce, bytes signature)',
])

const encode = (functionName: string, args: unknown[]): Hex =>
    encodeFunctionData({
        abi: MANAGER_ABI,
        functionName,
        args,
    } as Parameters<typeof encodeFunctionData>[0])

const modify = (unlockData: Hex) =>
    encode('modifyLiquidities', [unlockData, 1_800_000_000n])

const multicall = (...calls: Hex[]) => encode('multicall', [calls])

const initializePool = (key: PoolKey) =>
    encode('initializePool', [key, 2n ** 96n])

const permitBatch = (spender: Address) =>
    encode('permitBatch', [
        SENDER,
        {
            details: [
                {
                    token: USDC,
                    amount: USDC_MAX,
                    expiration: 1_800_000_000,
                    nonce: 0,
                },
            ],
            spender,
            sigDeadline: 1_800_000_000n,
        },
        '0x1234',
    ])

const ethMint = (owner: Address = MSG_SENDER) =>
    mint(ETH_USDC, ETH_MAX, USDC_MAX, owner)

const decode = (data: Hex, value = 0n) => {
    const contract = findKnownEvmContract(1, MANAGER)
    if (!contract) throw new Error('the V4 position manager is not registered')
    return decodeEvmContractAction(
        { from: SENDER, to: MANAGER, data, value },
        contract,
        WETH,
    )
}

const dec = (value: bigint) => new Decimal(value.toString())

describe('decodeEvmContractAction, Uniswap V4 position manager', () => {
    it('reads an ether mint, settled and swept back to the signer, as an add into a new position', () => {
        const data = modify(
            plan(
                ethMint(),
                settlePair(zeroAddress, USDC),
                sweep(zeroAddress, MSG_SENDER),
            ),
        )

        expect(decode(data, ETH_MAX)).toEqual({
            kind: 'add-liquidity',
            deposits: [
                { asset: { kind: 'native' }, maxAmount: dec(ETH_MAX) },
                {
                    asset: { kind: 'token', contract: USDC },
                    maxAmount: dec(USDC_MAX),
                },
            ],
            position: { kind: 'new' },
        })
    })

    it('reads a token-pair mint owned by the signer address itself', () => {
        const data = modify(
            plan(
                mint(USDC_WETH, USDC_MAX, ETH_MAX, SENDER),
                settlePair(USDC, WETH),
            ),
        )

        expect(decode(data)).toEqual({
            kind: 'add-liquidity',
            deposits: [
                {
                    asset: { kind: 'token', contract: USDC },
                    maxAmount: dec(USDC_MAX),
                },
                {
                    asset: { kind: 'token', contract: WETH },
                    maxAmount: dec(ETH_MAX),
                },
            ],
            position: { kind: 'new' },
        })
    })

    it('reads a mint batched behind a pool creation and a Permit2 permit for the manager', () => {
        const data = multicall(
            permitBatch(MANAGER),
            initializePool(ETH_USDC),
            modify(
                plan(
                    ethMint(),
                    settlePair(zeroAddress, USDC),
                    sweep(zeroAddress, MSG_SENDER),
                ),
            ),
        )

        expect(decode(data, ETH_MAX)?.kind).toBe('add-liquidity')
    })

    it('reads an increase as an add to an existing position with no deposits', () => {
        const data = modify(
            plan(increase(TOKEN_ID, 10n), settlePair(USDC, WETH)),
        )

        expect(decode(data)).toEqual({
            kind: 'add-liquidity',
            deposits: [],
            position: { kind: 'existing', tokenId: TOKEN_ID.toString() },
        })
    })

    it('reads a decrease taken to the signer as a removal that keeps the position', () => {
        const data = modify(
            plan(
                decrease(TOKEN_ID, 10n),
                takePair(zeroAddress, USDC, MSG_SENDER),
            ),
        )

        expect(decode(data)).toEqual({
            kind: 'remove-liquidity',
            tokenId: TOKEN_ID.toString(),
            isClosing: false,
        })
    })

    it.each([
        ['a burn', () => plan(burn(TOKEN_ID), takePair(USDC, WETH, SENDER))],
        [
            'a decrease and a burn of the same position',
            () =>
                plan(
                    decrease(TOKEN_ID, 10n),
                    burn(TOKEN_ID),
                    closeCurrency(USDC),
                    closeCurrency(WETH),
                ),
        ],
    ])('reads %s as a removal that closes the position', (_name, build) => {
        expect(decode(modify(build()))).toEqual({
            kind: 'remove-liquidity',
            tokenId: TOKEN_ID.toString(),
            isClosing: true,
        })
    })

    it.each([
        ['a take of the pair', () => takePair(zeroAddress, USDC, MSG_SENDER)],
        ['a take to the signer', () => take(USDC, SENDER, 0n)],
    ])(
        'reads a decrease of no liquidity paid by %s as collecting fees',
        (_name, payout) => {
            const data = modify(plan(decrease(TOKEN_ID, 0n), payout()))

            expect(decode(data)).toEqual({
                kind: 'collect-fees',
                tokenId: TOKEN_ID.toString(),
            })
        },
    )

    it.each([
        [
            'fees taken to someone else',
            () =>
                modify(
                    plan(
                        decrease(TOKEN_ID, 0n),
                        takePair(zeroAddress, USDC, OTHER),
                    ),
                ),
            0n,
        ],
        [
            'fees taken to the manager, where anyone can sweep them',
            () =>
                modify(
                    plan(
                        decrease(TOKEN_ID, 0n),
                        takePair(zeroAddress, USDC, ROUTER_SELF),
                    ),
                ),
            0n,
        ],
        [
            'fees taken to the signer and one token to someone else',
            () =>
                modify(
                    plan(
                        decrease(TOKEN_ID, 0n),
                        take(zeroAddress, SENDER, 0n),
                        take(USDC, OTHER, 0n),
                    ),
                ),
            0n,
        ],
        [
            'a removal swept to someone else',
            () =>
                modify(
                    plan(
                        decrease(TOKEN_ID, 10n),
                        take(USDC, ROUTER_SELF, 0n),
                        sweep(USDC, OTHER),
                    ),
                ),
            0n,
        ],
        [
            'a mint owned by someone else',
            () =>
                modify(
                    plan(
                        ethMint(OTHER),
                        settlePair(zeroAddress, USDC),
                        sweep(zeroAddress, MSG_SENDER),
                    ),
                ),
            ETH_MAX,
        ],
        [
            'an ether mint without a sweep back',
            () => modify(plan(ethMint(), settlePair(zeroAddress, USDC))),
            ETH_MAX,
        ],
        [
            'an ether mint swept back to someone else',
            () =>
                modify(
                    plan(
                        ethMint(),
                        settlePair(zeroAddress, USDC),
                        sweep(zeroAddress, OTHER),
                    ),
                ),
            ETH_MAX,
        ],
        [
            'less ether than the native side asks for',
            () =>
                modify(
                    plan(
                        ethMint(),
                        settlePair(zeroAddress, USDC),
                        sweep(zeroAddress, MSG_SENDER),
                    ),
                ),
            ETH_MAX - 1n,
        ],
        [
            'a native-pair mint with no ether sent',
            () =>
                modify(
                    plan(
                        ethMint(),
                        settlePair(zeroAddress, USDC),
                        sweep(zeroAddress, MSG_SENDER),
                    ),
                ),
            0n,
        ],
        [
            'ether sent to a token-pair mint',
            () =>
                modify(
                    plan(
                        mint(USDC_WETH, USDC_MAX, ETH_MAX, MSG_SENDER),
                        settlePair(USDC, WETH),
                        sweep(zeroAddress, MSG_SENDER),
                    ),
                ),
            1n,
        ],
        [
            'a mint of one currency against itself',
            () =>
                modify(
                    plan(
                        mint(
                            { ...USDC_WETH, currency1: USDC },
                            1n,
                            1n,
                            MSG_SENDER,
                        ),
                        settlePair(USDC, USDC),
                    ),
                ),
            0n,
        ],
        [
            'a token settled from the manager balance',
            () =>
                modify(
                    plan(
                        mint(USDC_WETH, USDC_MAX, ETH_MAX, MSG_SENDER),
                        settle(USDC, 0n, false),
                        settle(WETH, 0n, true),
                    ),
                ),
            0n,
        ],
        [
            'a pool creation for another pool',
            () =>
                multicall(
                    initializePool(USDC_WETH),
                    modify(
                        plan(
                            ethMint(),
                            settlePair(zeroAddress, USDC),
                            sweep(zeroAddress, MSG_SENDER),
                        ),
                    ),
                ),
            ETH_MAX,
        ],
        [
            'a pool creation ahead of an increase',
            () =>
                multicall(
                    initializePool(USDC_WETH),
                    modify(
                        plan(increase(TOKEN_ID, 1n), settlePair(USDC, WETH)),
                    ),
                ),
            0n,
        ],
        [
            'a Permit2 permit for another spender',
            () =>
                multicall(
                    permitBatch(OTHER),
                    modify(
                        plan(increase(TOKEN_ID, 1n), settlePair(USDC, WETH)),
                    ),
                ),
            0n,
        ],
        [
            'a position NFT permit',
            () =>
                multicall(
                    encode('permit', [OTHER, TOKEN_ID, 1n, 0n, '0x12']),
                    modify(
                        plan(
                            decrease(TOKEN_ID, 0n),
                            takePair(USDC, WETH, SENDER),
                        ),
                    ),
                ),
            0n,
        ],
        [
            'a batch whose plan is not last',
            () =>
                multicall(
                    modify(
                        plan(increase(TOKEN_ID, 1n), settlePair(USDC, WETH)),
                    ),
                    initializePool(USDC_WETH),
                ),
            0n,
        ],
        [
            'two plans in one batch',
            () =>
                multicall(
                    modify(
                        plan(increase(TOKEN_ID, 1n), settlePair(USDC, WETH)),
                    ),
                    modify(
                        plan(increase(TOKEN_ID, 1n), settlePair(USDC, WETH)),
                    ),
                ),
            0n,
        ],
        [
            'a settle ahead of the position change',
            () => modify(plan(settlePair(USDC, WETH), increase(TOKEN_ID, 1n))),
            0n,
        ],
        [
            'a decrease of one position and a burn of another',
            () =>
                modify(
                    plan(
                        decrease(TOKEN_ID, 10n),
                        burn(TOKEN_ID + 1n),
                        takePair(USDC, WETH, SENDER),
                    ),
                ),
            0n,
        ],
        [
            'a removal that sends ether',
            () =>
                modify(
                    plan(decrease(TOKEN_ID, 10n), takePair(USDC, WETH, SENDER)),
                ),
            1n,
        ],
        [
            'a removal that also settles',
            () =>
                modify(
                    plan(
                        decrease(TOKEN_ID, 10n),
                        settlePair(USDC, WETH),
                        takePair(USDC, WETH, SENDER),
                    ),
                ),
            0n,
        ],
        [
            'a swap in the plan',
            () =>
                modify(
                    plan(
                        decrease(TOKEN_ID, 10n),
                        swapExactInSingle(
                            ETH_USDC,
                            true,
                            1n,
                            0n,
                            'without-hop-price',
                        ),
                        takePair(USDC, WETH, SENDER),
                    ),
                ),
            0n,
        ],
        [
            'an action this does not read',
            () => modify(plan(decrease(TOKEN_ID, 10n), clearOrTake(USDC, 10n))),
            0n,
        ],
        [
            'a trailing byte',
            () =>
                `${modify(plan(decrease(TOKEN_ID, 0n), takePair(USDC, WETH, SENDER)))}00` as Hex,
            0n,
        ],
        [
            'a plan run without unlocking',
            () =>
                encode('modifyLiquiditiesWithoutUnlock', [
                    '0x01',
                    [decrease(TOKEN_ID, 0n)[1]],
                ]),
            0n,
        ],
    ] as const)('gives nothing for %s', (_name, build, value) => {
        expect(decode(build(), value)).toBeUndefined()
    })
})
