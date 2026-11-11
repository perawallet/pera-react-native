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
import { encodeFunctionData, maxUint256, parseAbi } from 'viem'
import type { Address } from 'viem'
import type { TransactionSummary } from '@perawallet/wallet-core-chain-contract'
import { ETHEREUM, evmScopeOf } from '../../__tests__/evm-chains'
import { V3_EXACT_IN_PERMIT_SWEEP } from '../../signing/__tests__/contract-action-fixtures'
import { SENDER } from '../../signing/__tests__/fixtures'
import { findKnownEvmContract } from '../../signing/known-contracts'
import { decodedCallSummary } from '../decoded-call-summary'

const USDT: Address = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const SPENDER: Address = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const WETH: Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const PERMIT2: Address = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
const scope = evmScopeOf(ETHEREUM)

const ERC20 = parseAbi([
    'function approve(address spender, uint256 value)',
    'function setApprovalForAll(address operator, bool approved)',
])

const PERMIT2_ABI = parseAbi([
    'function approve(address token, address spender, uint160 amount, uint48 expiration)',
])

const summarize = (
    call: { to?: Address; data: `0x${string}`; value?: bigint; from?: Address },
    isDecoding = true,
) =>
    decodedCallSummary(
        { from: SENDER, value: 0n, ...call },
        ETHEREUM,
        scope,
        isDecoding,
    )

const approve = (value: bigint) =>
    encodeFunctionData({
        abi: ERC20,
        functionName: 'approve',
        args: [SPENDER, value],
    })

const permit2Approve = (amount: bigint) =>
    encodeFunctionData({
        abi: PERMIT2_ABI,
        functionName: 'approve',
        args: [USDT, SPENDER, amount, 1_800_000_000],
    })

describe('decodedCallSummary', () => {
    it('names an unlimited approval after its token and spender, whatever the capabilities', () => {
        const summary = summarize(
            { to: USDT, data: approve(maxUint256) },
            false,
        )

        expect(summary).toMatchObject({
            kind: 'approval',
            icon: 'approval',
            counterparty: SPENDER,
            titleAssets: { asset: { chainId: 'ethereum', assetId: USDT } },
        })
        expect(summary.title.key).toBe('transactions.list_item.approve_asset')
        expect(summary.subtitle).toBeUndefined()
    })

    it('calls an approve of zero a revocation', () => {
        const summary = summarize({ to: USDT, data: approve(0n) })

        expect(summary.kind).toBe('approval')
        expect(summary.title.key).toBe('transactions.list_item.revoke_approval')
        expect(summary.counterparty).toBe(SPENDER)
    })

    it('reads a collection approval by its operator and a withdrawn one as a revocation', () => {
        const data = (approved: boolean) =>
            encodeFunctionData({
                abi: ERC20,
                functionName: 'setApprovalForAll',
                args: [SPENDER, approved],
            })

        const granted = summarize({ to: USDT, data: data(true) })
        const revoked = summarize({ to: USDT, data: data(false) })

        expect(granted.counterparty).toBe(SPENDER)
        expect(granted.title.key).toBe('transactions.list_item.approve_asset')
        expect(revoked.title.key).toBe('transactions.list_item.revoke_approval')
    })

    it('titles a swap through the router while decoding', () => {
        const { from, to, data, value } = V3_EXACT_IN_PERMIT_SWEEP

        const summary = summarize({ from, to, data, value })

        expect(summary.kind).toBe('swap')
        expect(summary.title.key).toBe('transactions.list_item.swap')
        expect(summary.subtitle?.params).toEqual({
            title: findKnownEvmContract(1, to)?.name,
        })
    })

    it('leaves the same router call a generic interaction without a subtitle when decoding is off', () => {
        const { from, to, data, value } = V3_EXACT_IN_PERMIT_SWEEP

        const summary = summarize({ from, to, data, value }, false)

        expect(summary.kind).toBe('contract-call')
        expect(summary.title.key).toBe(
            'transactions.list_item.contract_interaction',
        )
        expect(summary.subtitle).toBeUndefined()
    })

    describe('a pending Uniswap V3 mint', () => {
        const MANAGER: Address = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
        const MANAGER_ABI = parseAbi([
            'struct MintParams { address token0; address token1; uint24 fee; int24 tickLower; int24 tickUpper; uint256 amount0Desired; uint256 amount1Desired; uint256 amount0Min; uint256 amount1Min; address recipient; uint256 deadline; }',
            'function mint(MintParams params)',
            'function refundETH()',
            'function multicall(bytes[] data)',
        ])
        const mint = encodeFunctionData({
            abi: MANAGER_ABI,
            functionName: 'mint',
            args: [
                {
                    token0: USDT,
                    token1: WETH,
                    fee: 500,
                    tickLower: -887_270,
                    tickUpper: 887_270,
                    amount0Desired: 353_961n,
                    amount1Desired: 168n * 10n ** 12n,
                    amount0Min: 0n,
                    amount1Min: 0n,
                    recipient: SENDER,
                    deadline: 1_800_000_000n,
                },
            ],
        })
        const data = encodeFunctionData({
            abi: MANAGER_ABI,
            functionName: 'multicall',
            args: [
                [
                    mint,
                    encodeFunctionData({
                        abi: MANAGER_ABI,
                        functionName: 'refundETH',
                    }),
                ],
            ],
        })
        const value = 168n * 10n ** 12n

        it('is titled Add liquidity with the Uniswap V3 Positions subtitle while decoding', () => {
            const summary = summarize({ to: MANAGER, data, value })

            expect(summary.title.key).toBe(
                'transactions.list_item.add_liquidity',
            )
            expect(summary.subtitle?.params).toEqual({
                title: 'Uniswap V3 Positions',
            })
        })

        it('is a contract interaction when decoding is off', () => {
            const summary = summarize({ to: MANAGER, data, value }, false)

            expect(summary.title.key).toBe(
                'transactions.list_item.contract_interaction',
            )
        })
    })

    it('names a wrapped native deposit while decoding', () => {
        const data = encodeFunctionData({
            abi: parseAbi(['function deposit()']),
            functionName: 'deposit',
        })

        const summary = summarize({ to: WETH, data, value: 10n ** 18n })

        expect(summary.title.key).toBe('transactions.list_item.wrap')
        expect(summary.subtitle).toBeDefined()
    })

    it('adds only the protocol subtitle to a known contract it cannot decode', () => {
        const summary = summarize({ to: PERMIT2, data: '0x12345678' })

        expect(summary.kind).toBe('contract-call')
        expect(summary.title.key).toBe(
            'transactions.list_item.contract_interaction',
        )
        expect(summary.subtitle).toBeDefined()
    })

    it('gives an approval on a known contract its protocol subtitle only while decoding', () => {
        const data = approve(maxUint256)

        const decoding = summarize({ to: WETH, data }, true)
        const off = summarize({ to: WETH, data }, false)

        expect(decoding.kind).toBe('approval')
        expect(decoding.subtitle?.params).toEqual({
            title: findKnownEvmContract(1, WETH)?.name,
        })
        expect(off.kind).toBe('approval')
        expect(off.subtitle).toBeUndefined()
    })

    describe('Permit2 approve', () => {
        it('names the token it approves and its spender, with the Permit2 subtitle while decoding', () => {
            const summary = summarize({ to: PERMIT2, data: permit2Approve(5n) })

            expect(summary).toMatchObject({
                kind: 'approval',
                icon: 'approval',
                counterparty: SPENDER,
                title: {
                    key: 'transactions.list_item.approve_asset',
                    params: { asset: '0xdAC1...1ec7' },
                },
                titleAssets: { asset: { chainId: 'ethereum', assetId: USDT } },
                subtitle: { params: { title: 'Permit2' } },
            })
        })

        it('names it whatever the capabilities, without the Permit2 subtitle', () => {
            const summary = summarize(
                { to: PERMIT2, data: permit2Approve(5n) },
                false,
            )

            expect(summary.kind).toBe('approval')
            expect(summary.title.key).toBe(
                'transactions.list_item.approve_asset',
            )
            expect(summary.counterparty).toBe(SPENDER)
            expect(summary.subtitle).toBeUndefined()
        })

        it('calls an approve of zero a revocation', () => {
            const summary = summarize({ to: PERMIT2, data: permit2Approve(0n) })

            expect(summary.kind).toBe('approval')
            expect(summary.title.key).toBe(
                'transactions.list_item.revoke_approval',
            )
            expect(summary.counterparty).toBe(SPENDER)
        })

        it('leaves calldata that does not re-encode exactly a contract call', () => {
            const summary = summarize({
                to: PERMIT2,
                data: `${permit2Approve(5n)}00`,
            })

            expect(summary.kind).toBe('contract-call')
            expect(summary.title.key).toBe(
                'transactions.list_item.contract_interaction',
            )
        })

        it('leaves the same call to a contract that is not Permit2 a contract call', () => {
            const summary = summarize({ to: USDT, data: permit2Approve(5n) })

            expect(summary.kind).toBe('contract-call')
        })
    })

    it('titles a contract deployment as a generic interaction', () => {
        const summary = summarize({ data: '0x6080604052' })

        expect(summary.kind).toBe('contract-call')
        expect(summary.title.key).toBe(
            'transactions.list_item.contract_interaction',
        )
    })

    it('keeps a plain value transfer as a transfer', () => {
        const summary = summarize({ to: SPENDER, data: '0x', value: 5n })

        expect(summary.kind).toBe('transfer')
    })

    describe('a title that names no action', () => {
        const swap = V3_EXACT_IN_PERMIT_SWEEP

        it.each<[string, () => TransactionSummary]>([
            ['a router call with decoding off', () => summarize(swap, false)],
            [
                'a known contract call it cannot decode',
                () => summarize({ to: PERMIT2, data: '0x12345678' }),
            ],
            [
                'a contract deployment',
                () => summarize({ data: '0x6080604052' }),
            ],
        ])('Given %s, then the summary says so', (_, summaryOf) => {
            expect(summaryOf().isActionUnknown).toBe(true)
        })

        it.each<[string, () => TransactionSummary]>([
            [
                'an approval with decoding off',
                () => summarize({ to: USDT, data: approve(maxUint256) }, false),
            ],
            ['a revocation', () => summarize({ to: USDT, data: approve(0n) })],
            [
                'a Permit2 approve',
                () => summarize({ to: PERMIT2, data: permit2Approve(5n) }),
            ],
            ['a router swap, decoded', () => summarize(swap)],
            [
                'a plain value transfer',
                () => summarize({ to: SPENDER, data: '0x', value: 5n }),
            ],
        ])('Given %s, then the summary names an action', (_, summaryOf) => {
            expect(summaryOf().isActionUnknown).toBeUndefined()
        })
    })
})
