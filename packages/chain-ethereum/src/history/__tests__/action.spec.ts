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
import type { Address } from 'viem'
import {
    type BalanceChange,
    type TransactionSummary,
    i18nKey,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { ETHEREUM } from '../../__tests__/evm-chains'
import { findKnownEvmContract } from '../../signing/known-contracts'
import { classifyEvmHistoryCall, historyActionSummary } from '../action'

const USDT: Address = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const AUSDT: Address = '0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a'
const USDC: Address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const UNKNOWN: Address = '0x00000000000000000000000000000000000000cc'
const ROUTER: Address = '0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af'
const PERMIT2: Address = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
const AAVE_POOL: Address = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'
const WETH: Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const V3_POSITIONS: Address = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
const V4_POSITIONS: Address = '0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e'
const UNI_V2: Address = '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc'

const change = (
    assetId: string,
    value: string,
    symbol?: string,
): BalanceChange => ({
    assetRef: { chainId: 'ethereum', assetId },
    value: new Decimal(value),
    ...(symbol !== undefined && { display: { symbol, decimals: 6 } }),
})

const NATIVE_REF = { chainId: 'ethereum', assetId: 'native' }
const USDT_REF = { chainId: 'ethereum', assetId: USDT }
const ethOut = change('native', '-1143000000000000')
const usdtIn = change(USDT, '2230000', 'USDT')
const usdtOut = change(USDT, '-2230000', 'USDT')
const usdcOut = change(USDC, '-5000000', 'USDC')
const positionIn = change(`${V3_POSITIONS}/1234`, '1', 'UNI-V3-POS')
const positionOut = change(`${V3_POSITIONS}/1234`, '-1', 'UNI-V3-POS')

const classify = (
    to: Address,
    method: Nullable<string>,
    changes: BalanceChange[] = [],
    overrides: { nftLegCount?: number; isDecoding?: boolean } = {},
) =>
    classifyEvmHistoryCall({
        to,
        method,
        changes,
        nftLegCount: 0,
        nativeSymbol: 'ETH',
        contract: findKnownEvmContract(1, to),
        isDecoding: true,
        ...overrides,
    })

describe('classifyEvmHistoryCall', () => {
    describe('approvals', () => {
        it('Given approve on USDT, then approval with token USDT, even with decoding off', () => {
            expect(
                classify(USDT, 'approve', [], { isDecoding: false }),
            ).toEqual({ kind: 'approval', token: USDT })
        })

        it('Given the raw approve selector from an unverified token, then approval', () => {
            expect(classify(UNKNOWN, '0x095ea7b3')).toEqual({
                kind: 'approval',
                token: UNKNOWN,
            })
        })

        it.each([
            'increaseAllowance',
            'setApprovalForAll',
            '0x39509351',
            '0xA22CB465',
        ])('Given %s, then approval', method => {
            expect(classify(UNKNOWN, method)).toEqual({
                kind: 'approval',
                token: UNKNOWN,
            })
        })

        it('Given approve on Permit2, then approval without a token', () => {
            expect(classify(PERMIT2, 'approve')).toEqual({ kind: 'approval' })
        })

        it('Given an approve-like name that is not an approval, then no approval', () => {
            expect(classify(UNKNOWN, 'approveAndCall')).toBeUndefined()
        })
    })

    describe('with decoding off', () => {
        it('Given decoding off and a router call, then no action', () => {
            expect(
                classify(ROUTER, 'execute', [ethOut, usdtIn], {
                    isDecoding: false,
                }),
            ).toBeUndefined()
        })

        it('Given decoding off and a supply on the Aave pool, then no action', () => {
            expect(
                classify(AAVE_POOL, 'supply', [usdtOut], { isDecoding: false }),
            ).toBeUndefined()
        })
    })

    describe('known contracts', () => {
        it('Given supply on the Aave pool, then supply', () => {
            expect(
                classify(AAVE_POOL, 'supply', [
                    usdtOut,
                    change(AUSDT, '2230000', 'aEthUSDT'),
                ]),
            ).toEqual({ kind: 'supply' })
        })

        it.each([
            ['supplyWithPermit', 'supply'],
            ['deposit', 'supply'],
            ['withdraw', 'withdraw'],
            ['borrow', 'borrow'],
            ['repay', 'repay'],
            ['repayWithPermit', 'repay'],
            ['repayWithATokens', 'repay'],
        ])('Given %s on the Aave pool, then %s', (method, kind) => {
            expect(classify(AAVE_POOL, method)).toEqual({ kind })
        })

        it('Given a method the Aave pool reading does not know, then no action, not a shape guess', () => {
            expect(
                classify(AAVE_POOL, 'liquidationCall', [usdtOut, usdtIn]),
            ).toBeUndefined()
        })

        it.each([
            ['deposit', 'wrap'],
            ['withdraw', 'unwrap'],
        ])('Given %s on the wrapped native token, then %s', (method, kind) => {
            expect(classify(WETH, method)).toEqual({ kind })
        })

        it('Given multicall on the V3 position manager moving ETH and USDC out, then add-liquidity', () => {
            expect(
                classify(V3_POSITIONS, 'multicall', [
                    ethOut,
                    usdcOut,
                    positionIn,
                ]),
            ).toEqual({ kind: 'add-liquidity', isInferred: true })
        })

        it('Given modifyLiquidities on the V4 position manager moving tokens out, then add-liquidity', () => {
            expect(
                classify(V4_POSITIONS, 'modifyLiquidities', [ethOut, usdcOut]),
            ).toEqual({ kind: 'add-liquidity', isInferred: true })
        })

        it('Given multicall on the V3 position manager burning the position, then remove-liquidity', () => {
            expect(
                classify(V3_POSITIONS, 'multicall', [
                    change('native', '1000'),
                    change(USDC, '5000000', 'USDC'),
                    positionOut,
                ]),
            ).toEqual({ kind: 'remove-liquidity', isInferred: true })
        })

        it('Given multicall on the V3 position manager only paying tokens in, then no action', () => {
            expect(
                classify(V3_POSITIONS, 'multicall', [
                    change(USDC, '5000000', 'USDC'),
                ]),
            ).toBeUndefined()
        })

        it('Given multicall on the V3 position manager with another NFT leaving, then no remove-liquidity', () => {
            expect(
                classify(V3_POSITIONS, 'multicall', [
                    change(USDC, '5000000', 'USDC'),
                    change(`${UNKNOWN}/7`, '-1', 'OTHER'),
                ]),
            ).toBeUndefined()
        })

        it.each([
            ['mint', 'add-liquidity'],
            ['increaseLiquidity', 'add-liquidity'],
            ['decreaseLiquidity', 'remove-liquidity'],
        ])('Given %s on the V3 position manager, then %s', (method, kind) => {
            expect(classify(V3_POSITIONS, method)).toEqual({ kind })
        })
    })

    describe('balance shape', () => {
        it('Given one ETH out and USDT in on the router, then an inferred swap ETH → USDT naming each side by symbol and asset', () => {
            expect(classify(ROUTER, 'execute', [ethOut, usdtIn])).toEqual({
                kind: 'swap',
                pair: {
                    from: { symbol: 'ETH', assetRef: NATIVE_REF },
                    to: { symbol: 'USDT', assetRef: USDT_REF },
                },
                isInferred: true,
            })
        })

        it('Given a swap whose received token has no symbol, then a swap without a pair', () => {
            expect(
                classify(ROUTER, 'execute', [ethOut, change(USDT, '2230000')]),
            ).toEqual({ kind: 'swap', isInferred: true })
        })

        it('Given a swap whose received token has an empty symbol, then a swap without a pair', () => {
            expect(
                classify(UNKNOWN, 'swap', [
                    usdtOut,
                    change(USDC, '2230000', ''),
                ]),
            ).toEqual({ kind: 'swap', isInferred: true })
        })

        it('Given two tokens out and one in, then not a swap', () => {
            expect(
                classify(ROUTER, 'execute', [
                    usdtOut,
                    usdcOut,
                    change(WETH, '1'),
                ]),
            ).toBeUndefined()
        })

        it('Given a V2 removeLiquidityETH, the pool token out and ETH plus a token in, then not a swap', () => {
            expect(
                classify(UNKNOWN, 'removeLiquidityETH', [
                    change(UNI_V2, '-1000000000000000000', 'UNI-V2'),
                    change('native', '500000000000000000'),
                    change(USDC, '1500000000', 'USDC'),
                ]),
            ).toBeUndefined()
        })

        it('Given one token out and only the same token in, then not a swap', () => {
            expect(
                classify(UNKNOWN, 'execute', [
                    usdtOut,
                    change(USDT, '1', 'USDT'),
                ]),
            ).toBeUndefined()
        })

        it('Given one token out and an NFT in, then not a swap', () => {
            expect(
                classify(UNKNOWN, 'buy', [usdcOut, positionIn]),
            ).toBeUndefined()
        })

        it('Given a token in plus an NFT leg, then not a swap', () => {
            expect(
                classify(UNKNOWN, 'buy', [usdcOut, usdtIn], { nftLegCount: 1 }),
            ).toBeUndefined()
        })

        it('Given only a token in from an unknown contract, then an inferred receive', () => {
            expect(classify(UNKNOWN, 'claim', [usdtIn])).toEqual({
                kind: 'receive',
                isInferred: true,
            })
        })

        it('Given only a token out to an unknown contract, then an inferred send', () => {
            expect(classify(UNKNOWN, 'bridge', [usdtOut])).toEqual({
                kind: 'send',
                isInferred: true,
            })
        })

        it('Given an unknown contract that moved nothing, then no action', () => {
            expect(classify(UNKNOWN, 'register', [])).toBeUndefined()
        })
    })
})

describe('historyActionSummary', () => {
    const base: TransactionSummary = {
        kind: 'contract-call',
        title: { key: i18nKey('transactions.list_item.contract_interaction') },
        icon: 'contract-call',
        direction: 'none',
        counterparty: USDT,
        balanceChanges: [],
    }
    const router = findKnownEvmContract(1, ROUTER)

    it("Given an approval of USDT, then an approval titled with the short token address, filled from USDT's stored name, naming no counterparty", () => {
        expect(
            historyActionSummary(
                { kind: 'approval', token: USDT },
                base,
                undefined,
                ETHEREUM,
            ),
        ).toEqual({
            kind: 'approval',
            direction: 'none',
            balanceChanges: [],
            icon: 'approval',
            title: {
                key: 'transactions.list_item.approve_asset',
                params: { asset: '0xdAC1...1ec7' },
            },
            titleAssets: { asset: USDT_REF },
        })
    })

    it('Given an approval without a token, then a plain approval naming Permit2', () => {
        const summary = historyActionSummary(
            { kind: 'approval' },
            base,
            findKnownEvmContract(1, PERMIT2),
            ETHEREUM,
        )

        expect(summary).toMatchObject({
            kind: 'approval',
            icon: 'approval',
            title: { key: 'transactions.list_item.approval' },
            subtitle: {
                key: 'transactions.list_item.interpreted_title',
                params: { title: 'Permit2' },
            },
        })
        expect(summary.titleAssets).toBeUndefined()
        expect(summary.counterparty).toBeUndefined()
    })

    it('Given a swap with a pair on the router, then a swap titled by its pair, each side filled from its stored name, and named by the router', () => {
        expect(
            historyActionSummary(
                {
                    kind: 'swap',
                    pair: {
                        from: { symbol: 'ETH', assetRef: NATIVE_REF },
                        to: { symbol: 'USDT', assetRef: USDT_REF },
                    },
                },
                base,
                router,
                ETHEREUM,
            ),
        ).toMatchObject({
            kind: 'swap',
            icon: 'swap',
            title: {
                key: 'transactions.list_item.swap_pair',
                params: { from: 'ETH', to: 'USDT' },
            },
            titleAssets: { from: NATIVE_REF, to: USDT_REF },
            subtitle: {
                key: 'transactions.list_item.interpreted_title',
                params: { title: 'Uniswap' },
            },
        })
    })

    it('Given an action read from the balance changes, then its summary is marked inferred', () => {
        expect(
            historyActionSummary(
                { kind: 'receive', isInferred: true },
                base,
                undefined,
                ETHEREUM,
            ).isInferred,
        ).toBe(true)
    })

    it('Given an action read from the method, then its summary is not marked inferred', () => {
        expect(
            historyActionSummary(
                { kind: 'supply' },
                base,
                findKnownEvmContract(1, AAVE_POOL),
                ETHEREUM,
            ).isInferred,
        ).toBeUndefined()
    })

    it.each([
        { kind: 'approval', token: USDT },
        { kind: 'swap' },
        { kind: 'supply' },
        { kind: 'receive', isInferred: true },
    ] as const)(
        'Given $kind over a summary that named no action, then it names one',
        action => {
            expect(
                historyActionSummary(
                    action,
                    { ...base, isActionUnknown: true },
                    undefined,
                    ETHEREUM,
                ).isActionUnknown,
            ).toBeUndefined()
        },
    )

    it('Given a swap without a pair, then a plain swap', () => {
        expect(
            historyActionSummary({ kind: 'swap' }, base, undefined, ETHEREUM)
                .title,
        ).toEqual({ key: 'transactions.list_item.swap' })
    })

    it.each([
        ['supply', 'transactions.list_item.supply'],
        ['withdraw', 'transactions.list_item.withdraw'],
        ['borrow', 'transactions.list_item.borrow'],
        ['repay', 'transactions.list_item.repay'],
        ['wrap', 'transactions.list_item.wrap'],
        ['unwrap', 'transactions.list_item.unwrap'],
        ['add-liquidity', 'transactions.list_item.add_liquidity'],
        ['remove-liquidity', 'transactions.list_item.remove_liquidity'],
        ['send', 'transactions.list_item.send'],
        ['receive', 'transactions.list_item.receive'],
    ] as const)('Given %s, then a contract call titled %s', (kind, key) => {
        expect(
            historyActionSummary({ kind }, base, undefined, ETHEREUM),
        ).toEqual({ ...base, kind: 'contract-call', title: { key } })
    })

    it('Given balance changes, then they stay as computed', () => {
        const changes = [usdtOut, change(AUSDT, '2230000', 'aEthUSDT')]

        expect(
            historyActionSummary(
                { kind: 'supply' },
                { ...base, balanceChanges: changes },
                findKnownEvmContract(1, AAVE_POOL),
                ETHEREUM,
            ).balanceChanges,
        ).toBe(changes)
    })
})
