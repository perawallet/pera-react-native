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

import { describe, expect, it, vi } from 'vitest'
import { encodeFunctionData, maxUint160, maxUint256, parseAbi } from 'viem'
import type { Address } from 'viem'
import type { TransactionSummary } from '@perawallet/wallet-core-chain-contract'
import { ETHEREUM, evmScopeOf } from '../../__tests__/evm-chains'
import { V3_EXACT_IN_PERMIT_SWEEP } from '../../signing/__tests__/contract-action-fixtures'
import { SENDER } from '../../signing/__tests__/fixtures'
import { getAssetsByIds, type PeraAsset } from '@perawallet/wallet-core-assets'
import {
    decodedCallSummary,
    readDecodedCallSummary,
} from '../decoded-call-summary'

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-assets')
    >()),
    getAssetsByIds: vi.fn(async () => []),
}))

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
        expect(summary.subtitle).toEqual({
            key: 'transactions.list_item.unlimited_approval_for',
            params: { spender: '0x7099...79C8' },
        })
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
        expect(granted.title).toEqual({
            key: 'transactions.list_item.approve_all',
            params: { collection: '0xdAC1...1ec7' },
        })
        expect(granted.titleAssets).toBeUndefined()
        expect(revoked.title.key).toBe('transactions.list_item.revoke_approval')
    })

    it('titles a swap through the router while decoding', () => {
        const { from, to, data, value } = V3_EXACT_IN_PERMIT_SWEEP

        const summary = summarize({ from, to, data, value })

        expect(summary.kind).toBe('swap')
        expect(summary.title.key).toBe('transactions.list_item.swap')
        expect(summary.subtitle?.params).toEqual({
            title: 'Uniswap',
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

        it('is titled Add liquidity with the Uniswap subtitle while decoding', () => {
            const summary = summarize({ to: MANAGER, data, value })

            expect(summary.title.key).toBe(
                'transactions.list_item.add_liquidity',
            )
            expect(summary.subtitle?.params).toEqual({
                title: 'Uniswap',
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

    it("shows a limited approval's unknown spender, not the known token's protocol name", () => {
        const summary = summarize({ to: WETH, data: approve(5n) }, true)

        expect(summary.kind).toBe('approval')
        expect(summary.subtitle).toBeUndefined()
        expect(summary.subtitleEllipsis).toBeUndefined()
        expect(summary.counterparty).toBe(SPENDER)
    })

    it('names a known spender from the registry whatever the capabilities', () => {
        const router = V3_EXACT_IN_PERMIT_SWEEP.to
        const data = (value: bigint) =>
            encodeFunctionData({
                abi: ERC20,
                functionName: 'approve',
                args: [router, value],
            })

        const unlimited = summarize({ to: USDT, data: data(maxUint256) }, false)
        const limited = summarize({ to: USDT, data: data(5n) }, false)

        expect(unlimited.subtitle).toEqual({
            key: 'transactions.list_item.unlimited_approval_for',
            params: { spender: 'Uniswap' },
        })
        expect(unlimited.subtitleEllipsis).toBe('tail')
        expect(limited.subtitle).toEqual({
            key: 'transactions.list_item.approval_for',
            params: { spender: 'Uniswap' },
        })
    })

    it('reads an allowance from 2^160 as unlimited, as signing does', () => {
        const below = summarize({ to: USDT, data: approve(maxUint160 - 1n) })
        const at = summarize({ to: USDT, data: approve(maxUint160) })

        expect(below.subtitle).toBeUndefined()
        expect(at.subtitle?.key).toBe(
            'transactions.list_item.unlimited_approval_for',
        )
    })

    describe('Permit2 approve', () => {
        it('names the token it approves and its spender while decoding', () => {
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
            })
            expect(summary.subtitle).toBeUndefined()
        })

        it('names it whatever the capabilities', () => {
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

    describe('an approve the store knows as an NFT', () => {
        const APE: Address = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'
        const storeHolds = (...assetIds: string[]) =>
            vi
                .mocked(getAssetsByIds)
                .mockResolvedValueOnce(
                    assetIds.map(assetId => ({ assetId }) as PeraAsset),
                )
        const pending = (value: bigint) =>
            readDecodedCallSummary(
                { from: SENDER, to: APE, data: approve(value), value: 0n },
                ETHEREUM,
                scope,
                false,
            )

        it('names a pending grant of token #0 as an approval of that NFT, as its mined row will', async () => {
            storeHolds(`${APE}/0`)

            const summary = await pending(0n)

            expect(summary.title.key).toBe(
                'transactions.list_item.approve_asset',
            )
            expect(summary.titleAssets).toEqual({
                asset: { chainId: 'ethereum', assetId: `${APE}/0` },
            })
        })

        it('never calls a pending ENS-sized token id unlimited', async () => {
            const ensId = 2n ** 255n + 7n
            storeHolds(`${APE}/${ensId}`)

            const summary = await pending(ensId)

            expect(summary.subtitle).toBeUndefined()
        })

        it('keeps the ERC-20 reading when the store also holds the token as fungible', async () => {
            storeHolds(APE, `${APE}/0`)

            const summary = await pending(0n)

            expect(summary.title.key).toBe(
                'transactions.list_item.revoke_approval',
            )
        })

        it('reads the store only for an approve', async () => {
            vi.mocked(getAssetsByIds).mockClear()

            await readDecodedCallSummary(
                { from: SENDER, to: SPENDER, data: '0x', value: 5n },
                ETHEREUM,
                scope,
                false,
            )

            expect(getAssetsByIds).not.toHaveBeenCalled()
        })
    })
})
