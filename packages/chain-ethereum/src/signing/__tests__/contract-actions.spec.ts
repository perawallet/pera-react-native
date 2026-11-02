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
import { encodeFunctionData, maxUint256, parseAbi } from 'viem'
import type { Address, Hex } from 'viem'
import { ETHEREUM } from '../../__tests__/evm-chains'
import type { EvmContractAction } from '../contract-action-types'
import {
    contractActionSummary,
    contractActionTitleKeyOf,
    decodeEvmContractAction,
} from '../contract-actions'
import { findKnownEvmContract } from '../known-contracts'
import { SENDER } from './fixtures'
import { V3_EXACT_IN_PERMIT_SWEEP } from './contract-action-fixtures'

const WETH: Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const POOL: Address = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'
const ROUTER: Address = '0x23617e59A5925b2A4Bf75d73ff6711cD0b29De85'
const PERMIT2: Address = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
const USDC: Address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const OTHER: Address = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

const contractAt = (address: Address) => {
    const contract = findKnownEvmContract(1, address)
    if (!contract) throw new Error(`${address} is not registered`)
    return contract
}

const call = (to: Address, data: Hex, value = 0n) => ({
    from: SENDER,
    to,
    data,
    value,
})

const decode = (to: Address, data: Hex, value = 0n) =>
    decodeEvmContractAction(call(to, data, value), contractAt(to), WETH)

const WETH_ABI = parseAbi([
    'function deposit()',
    'function withdraw(uint256 wad)',
])

const AAVE_ABI = parseAbi([
    'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
    'function supplyWithPermit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode, uint256 deadline, uint8 permitV, bytes32 permitR, bytes32 permitS)',
    'function withdraw(address asset, uint256 amount, address to)',
    'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)',
    'function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf)',
    'function repayWithPermit(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf, uint256 deadline, uint8 permitV, bytes32 permitR, bytes32 permitS)',
])

const ZERO_WORD = `0x${'00'.repeat(32)}` as Hex

const aave = (
    functionName: (typeof AAVE_ABI)[number]['name'],
    args: unknown[],
): Hex =>
    encodeFunctionData({
        abi: AAVE_ABI,
        functionName,
        args,
    } as Parameters<typeof encodeFunctionData>[0])

const dec = (value: bigint) => new Decimal(value.toString())

describe('decodeEvmContractAction', () => {
    describe('wrapped native token', () => {
        const deposit = encodeFunctionData({
            abi: WETH_ABI,
            functionName: 'deposit',
        })
        const withdraw = (wad: bigint) =>
            encodeFunctionData({
                abi: WETH_ABI,
                functionName: 'withdraw',
                args: [wad],
            })

        it('reads a deposit as a wrap of the value sent', () => {
            expect(decode(WETH, deposit, 10n ** 18n)).toEqual({
                kind: 'wrap',
                amount: dec(10n ** 18n),
            })
        })

        it('reads a withdraw as an unwrap of its amount', () => {
            expect(decode(WETH, withdraw(5n))).toEqual({
                kind: 'unwrap',
                amount: dec(5n),
            })
        })

        it('gives nothing for a deposit that sends no ether or a withdraw that does', () => {
            expect(decode(WETH, deposit, 0n)).toBeUndefined()
            expect(decode(WETH, withdraw(5n), 1n)).toBeUndefined()
        })

        it('gives nothing for a deposit with extra bytes, or for another function', () => {
            expect(decode(WETH, `${deposit}00`, 1n)).toBeUndefined()
            expect(decode(WETH, `${withdraw(5n)}00`)).toBeUndefined()
            // transfer(address,uint256) is a standard call, not a wrap.
            expect(
                decode(
                    WETH,
                    `0xa9059cbb${ZERO_WORD.slice(2)}${ZERO_WORD.slice(2)}`,
                ),
            ).toBeUndefined()
        })
    })

    describe('Aave V3 pool', () => {
        it('reads supply, with its permit form', () => {
            const expected: EvmContractAction = {
                kind: 'supply',
                asset: USDC,
                amount: dec(1_000_000n),
                isEntireBalance: false,
            }

            expect(
                decode(POOL, aave('supply', [USDC, 1_000_000n, SENDER, 0])),
            ).toEqual(expected)
            expect(
                decode(
                    POOL,
                    aave('supplyWithPermit', [
                        USDC,
                        1_000_000n,
                        SENDER,
                        0,
                        1n,
                        27,
                        ZERO_WORD,
                        ZERO_WORD,
                    ]),
                ),
            ).toEqual(expected)
        })

        it('reads withdraw of an amount, and of the whole balance', () => {
            expect(decode(POOL, aave('withdraw', [USDC, 5n, SENDER]))).toEqual({
                kind: 'withdraw',
                asset: USDC,
                amount: dec(5n),
                isEntireBalance: false,
            })
            expect(
                decode(POOL, aave('withdraw', [USDC, maxUint256, SENDER])),
            ).toEqual({
                kind: 'withdraw',
                asset: USDC,
                amount: dec(maxUint256),
                isEntireBalance: true,
            })
        })

        it('reads borrow', () => {
            expect(
                decode(POOL, aave('borrow', [USDC, 7n, 2n, 0, SENDER])),
            ).toEqual({
                kind: 'borrow',
                asset: USDC,
                amount: dec(7n),
                isEntireBalance: false,
            })
        })

        it('reads repay of an amount, of the whole debt, and its permit form', () => {
            expect(
                decode(POOL, aave('repay', [USDC, 3n, 2n, SENDER])),
            ).toMatchObject({ kind: 'repay', amount: dec(3n) })
            expect(
                decode(POOL, aave('repay', [USDC, maxUint256, 2n, SENDER])),
            ).toMatchObject({ kind: 'repay', isEntireBalance: true })
            expect(
                decode(
                    POOL,
                    aave('repayWithPermit', [
                        USDC,
                        3n,
                        2n,
                        SENDER,
                        1n,
                        27,
                        ZERO_WORD,
                        ZERO_WORD,
                    ]),
                ),
            ).toMatchObject({ kind: 'repay', amount: dec(3n) })
        })

        it('gives nothing when the position is not the signer’s', () => {
            expect(
                decode(POOL, aave('supply', [USDC, 1n, OTHER, 0])),
            ).toBeUndefined()
            expect(
                decode(POOL, aave('withdraw', [USDC, 1n, OTHER])),
            ).toBeUndefined()
            expect(
                decode(POOL, aave('borrow', [USDC, 1n, 2n, 0, OTHER])),
            ).toBeUndefined()
            expect(
                decode(POOL, aave('repay', [USDC, 1n, 2n, OTHER])),
            ).toBeUndefined()
        })

        it('gives nothing for a supply or borrow of the largest amount', () => {
            expect(
                decode(POOL, aave('supply', [USDC, maxUint256, SENDER, 0])),
            ).toBeUndefined()
            expect(
                decode(POOL, aave('borrow', [USDC, maxUint256, 2n, 0, SENDER])),
            ).toBeUndefined()
        })

        it('gives nothing when ether is sent', () => {
            expect(
                decode(POOL, aave('supply', [USDC, 1n, SENDER, 0]), 1n),
            ).toBeUndefined()
        })

        it('gives nothing for an unknown function or extra calldata', () => {
            expect(decode(POOL, '0x5ae401dc')).toBeUndefined()
            expect(
                decode(POOL, `${aave('supply', [USDC, 1n, SENDER, 0])}00`),
            ).toBeUndefined()
        })
    })

    it('reads a swap through the Universal Router', () => {
        const router = V3_EXACT_IN_PERMIT_SWEEP.to
        const action = decodeEvmContractAction(
            V3_EXACT_IN_PERMIT_SWEEP,
            contractAt(router),
            WETH,
        )

        expect(action?.kind).toBe('swap')
    })

    it('leaves a call to Permit2 a plain contract call', () => {
        expect(decode(PERMIT2, '0x87517c45')).toBeUndefined()
        expect(decode(ROUTER, '0x')).toBeUndefined()
    })
})

describe('contractActionTitleKeyOf', () => {
    it.each([
        ['swap', 'transactions.list_item.swap'],
        ['wrap', 'transactions.list_item.wrap'],
        ['unwrap', 'transactions.list_item.unwrap'],
        ['supply', 'transactions.list_item.supply'],
        ['withdraw', 'transactions.list_item.withdraw'],
        ['borrow', 'transactions.list_item.borrow'],
        ['repay', 'transactions.list_item.repay'],
    ] as const)('titles a %s', (kind, key) => {
        const action = {
            kind,
            amount: dec(1n),
            asset: USDC,
            isEntireBalance: false,
            input: undefined,
            output: undefined,
        } as unknown as EvmContractAction

        expect(contractActionTitleKeyOf(action)).toBe(key)
    })
})

describe('contractActionSummary', () => {
    const callFacts = { from: SENDER, to: WETH, data: '0xd0e30db0' as Hex }

    it('summarises a wrap as a contract call carrying the ether sent', () => {
        const summary = contractActionSummary(
            { kind: 'wrap', amount: dec(10n ** 18n) },
            { ...callFacts, value: 10n ** 18n },
            ETHEREUM,
        )

        expect(summary).toEqual({
            kind: 'contract-call',
            title: { key: 'transactions.list_item.wrap' },
            direction: 'out',
            counterparty: WETH,
            amount: {
                assetRef: ETHEREUM.descriptor.nativeAsset.ref,
                value: dec(10n ** 18n),
            },
            icon: 'contract-call',
        })
    })

    it('summarises a swap as a swap with the swap icon', () => {
        const summary = contractActionSummary(
            {
                kind: 'swap',
                input: {
                    asset: { kind: 'token', contract: USDC },
                    amount: dec(1n),
                    bound: 'exact',
                },
                output: {
                    asset: { kind: 'native' },
                    amount: dec(1n),
                    bound: 'at-least',
                },
            },
            { ...callFacts, to: ROUTER, value: 0n },
            ETHEREUM,
        )

        expect(summary).toMatchObject({
            kind: 'swap',
            title: { key: 'transactions.list_item.swap' },
            direction: 'none',
            icon: 'swap',
        })
        expect(summary.amount).toBeUndefined()
    })
})
