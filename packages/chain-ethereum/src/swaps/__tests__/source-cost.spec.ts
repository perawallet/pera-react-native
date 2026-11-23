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

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    decodeFunctionData,
    encodeFunctionResult,
    erc20Abi,
    isAddressEqual,
    numberToHex,
    parseAbi,
    parseTransaction,
    toHex,
} from 'viem'
import type { Address, Hex } from 'viem'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'
import { createEvmClient } from '../../blockchain/utils/createEvmClient'
import {
    fakeNode,
    SENDER,
    server,
    TOKEN,
} from '../../connect/callBatch/__tests__/harness'
import { TEST_RPC_URL, testChainContext } from '../../__tests__/context'
import {
    BASE,
    ETHEREUM,
    OPTIMISM,
    POLYGON,
    evmChainOf,
    evmScopeOf,
} from '../../__tests__/evm-chains'
import { evmRpcHandlers } from '../../blockchain/msw-handlers'
import type { EvmChain } from '../../chains/types'
import {
    INTRINSIC_TRANSFER_GAS,
    readEvmFeePresets,
    SURCHARGE_HEADROOM,
} from '../../transfer/fees'
import { OP_STACK_ORACLE_ADDRESS } from '../../transfer/__tests__/op-stack-oracle'
import {
    estimateEvmSwapFeeReserve,
    estimateEvmSwapSourceCost,
    evmShortfallOf,
    SWAP_TOKEN_DEPOSIT_GAS_CEILING,
} from '../source-cost'

const AMOUNT = 1_000_000n
const scope = evmScopeOf(ETHEREUM)
const ctx = testChainContext()

const quoteOf = (assetId: string): SwapQuote =>
    ({
        request: {
            sourceAsset: { ...scope, assetId },
            sourceAmount: new Decimal(AMOUNT.toString()),
            sourceAddress: SENDER,
        },
    }) as unknown as SwapQuote

const estimate = (assetId: string) =>
    estimateEvmSwapSourceCost({
        client: createEvmClient(scope, ctx, ETHEREUM),
        chain: ETHEREUM,
        quote: quoteOf(assetId),
        scope,
    })

const RICH = numberToHex(10n ** 21n)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('estimateEvmSwapSourceCost', () => {
    it.each([
        ['a token', TOKEN, SWAP_TOKEN_DEPOSIT_GAS_CEILING],
        [
            'the native asset',
            ETHEREUM.nativeAsset.assetId,
            INTRINSIC_TRANSFER_GAS,
        ],
    ])('prices %s source as one deposit', async (_, assetId, gas) => {
        fakeNode({ balance: RICH })
        const client = createEvmClient(scope, ctx, ETHEREUM)
        const { presets } = await readEvmFeePresets(
            client,
            ETHEREUM,
            scope.networkId,
        )

        const cost = await estimate(assetId)

        expect(cost).toMatchObject({
            shortfall: null,
            nativeSymbol: 'ETH',
            nativeDecimals: 18,
        })
        expect(cost.networkFee.toString()).toBe(
            (gas * presets.normal.maxFeePerGas).toString(),
        )
    })

    it('expects the swap to pay the base fee plus the tip, not the signed maximum', async () => {
        fakeNode({ balance: RICH })
        const client = createEvmClient(scope, ctx, ETHEREUM)
        const { baseFeePerGas, presets } = await readEvmFeePresets(
            client,
            ETHEREUM,
            scope.networkId,
        )

        const cost = await estimate(ETHEREUM.nativeAsset.assetId)

        expect(cost.expectedNetworkFee.toString()).toBe(
            (
                INTRINSIC_TRANSFER_GAS *
                (baseFeePerGas + presets.normal.maxPriorityFeePerGas)
            ).toString(),
        )
        expect(cost.expectedNetworkFee.lessThan(cost.networkFee)).toBe(true)
    })

    it('counts only the fee against the balance for a token source', async () => {
        fakeNode({ balance: '0x1' })

        const cost = await estimate(TOKEN)

        expect(cost.shortfall?.toString()).toBe(
            cost.networkFee.minus(1).toString(),
        )
    })

    it('counts the swap amount as well for a native source', async () => {
        fakeNode({ balance: '0x1' })

        const cost = await estimate(ETHEREUM.nativeAsset.assetId)

        expect(cost.shortfall?.toString()).toBe(
            cost.networkFee.plus(AMOUNT.toString()).minus(1).toString(),
        )
    })
})

describe('estimateEvmSwapSourceCost surcharge', () => {
    const L1_FEE = 4_000_000_000_000n
    const OPERATOR_FEE = 6n
    const oracleAbi = parseAbi([
        'function getL1Fee(bytes _data) view returns (uint256)',
        'function getOperatorFee(uint256 _gasUsed) view returns (uint256)',
    ])

    const useNode = (balance: bigint) => {
        const encodings: Hex[] = []
        server.use(
            ...evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: {
                    eth_getBalance: toHex(balance),
                    eth_call: params => {
                        const { to, data } = params[0] as {
                            to: Address
                            data: Hex
                        }
                        if (!isAddressEqual(to, OP_STACK_ORACLE_ADDRESS)) {
                            return '0x'
                        }
                        const call = decodeFunctionData({
                            abi: oracleAbi,
                            data,
                        })
                        if (call.functionName === 'getL1Fee') {
                            encodings.push(call.args[0])
                        }
                        return encodeFunctionResult({
                            abi: oracleAbi,
                            functionName: call.functionName,
                            result:
                                call.functionName === 'getL1Fee'
                                    ? L1_FEE
                                    : OPERATOR_FEE,
                        })
                    },
                },
            }),
        )
        return encodings
    }

    const estimateOn = (chain: EvmChain, assetId: string) => {
        const chainScope = evmScopeOf(chain)
        const client = createEvmClient(
            chainScope,
            testChainContext({ chain }),
            chain,
        )
        return {
            client,
            cost: estimateEvmSwapSourceCost({
                client,
                chain,
                quote: {
                    request: {
                        sourceAsset: { ...chainScope, assetId },
                        sourceAmount: new Decimal(AMOUNT.toString()),
                        sourceAddress: SENDER,
                    },
                } as unknown as SwapQuote,
                scope: chainScope,
            }),
        }
    }

    describe.each([BASE, OPTIMISM])('on $row.id', chain => {
        it('adds the swap surcharge to the expected fee, and with its headroom to the maximum and the shortfall', async () => {
            const encodings = useNode(1n)
            const { client, cost } = estimateOn(
                chain,
                chain.nativeAsset.assetId,
            )
            const { baseFeePerGas, presets } = await readEvmFeePresets(
                client,
                chain,
                'mainnet',
            )
            const surcharge = L1_FEE + OPERATOR_FEE
            const maximum =
                INTRINSIC_TRANSFER_GAS * presets.normal.maxFeePerGas +
                SURCHARGE_HEADROOM * surcharge

            const { networkFee, expectedNetworkFee, shortfall } = await cost

            expect(networkFee.toString()).toBe(maximum.toString())
            expect(expectedNetworkFee.toString()).toBe(
                (
                    INTRINSIC_TRANSFER_GAS *
                        (baseFeePerGas + presets.normal.maxPriorityFeePerGas) +
                    surcharge
                ).toString(),
            )
            expect(shortfall?.toString()).toBe(
                (maximum + AMOUNT - 1n).toString(),
            )
            expect(encodings).toHaveLength(1)
            const priced = parseTransaction(encodings[0])
            expect(isAddressEqual(priced.to!, SENDER)).toBe(true)
            expect(priced.value).toBe(AMOUNT)
            expect(priced.data).toBeUndefined()
        })

        it('prices a token source on its transfer to the token contract', async () => {
            const encodings = useNode(10n ** 21n)
            const { client, cost } = estimateOn(chain, TOKEN)
            const { presets } = await readEvmFeePresets(
                client,
                chain,
                'mainnet',
            )

            const { networkFee } = await cost

            expect(encodings).toHaveLength(1)
            const priced = parseTransaction(encodings[0])
            expect(isAddressEqual(priced.to!, TOKEN)).toBe(true)
            expect(
                decodeFunctionData({ abi: erc20Abi, data: priced.data! }),
            ).toMatchObject({
                functionName: 'transfer',
                args: [SENDER, AMOUNT],
            })
            expect(networkFee.toString()).toBe(
                (
                    SWAP_TOKEN_DEPOSIT_GAS_CEILING *
                        presets.normal.maxFeePerGas +
                    SURCHARGE_HEADROOM * (L1_FEE + OPERATOR_FEE)
                ).toString(),
            )
        })
    })

    it.each([ETHEREUM, evmChainOf('arbitrum')])(
        'reads no oracle on $row.id',
        async chain => {
            const encodings = useNode(10n ** 21n)

            await estimateOn(chain, TOKEN).cost

            expect(encodings).toEqual([])
        },
    )
})

describe('estimateEvmSwapFeeReserve', () => {
    const GWEI = 10n ** 9n
    const ETH = 10n ** 18n
    const oracleAbi = parseAbi([
        'function getL1Fee(bytes _data) view returns (uint256)',
        'function getOperatorFee(uint256 _gasUsed) view returns (uint256)',
    ])

    const reserveOn = (
        chain: EvmChain,
        {
            baseFee,
            tip,
            l1Fee = 0n,
        }: { baseFee: bigint; tip: bigint; l1Fee?: bigint },
    ) => {
        server.use(
            ...evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: {
                    eth_feeHistory: () => ({
                        oldestBlock: '0x1',
                        baseFeePerGas: [toHex(baseFee), toHex(baseFee)],
                        gasUsedRatio: [0.5],
                        reward: [[toHex(tip), toHex(tip), toHex(tip)]],
                    }),
                    eth_call: params => {
                        const { data } = params[0] as { data: Hex }
                        const call = decodeFunctionData({
                            abi: oracleAbi,
                            data,
                        })
                        return encodeFunctionResult({
                            abi: oracleAbi,
                            functionName: call.functionName,
                            result:
                                call.functionName === 'getL1Fee' ? l1Fee : 0n,
                        })
                    },
                },
            }),
        )
        const chainScope = evmScopeOf(chain)
        return estimateEvmSwapFeeReserve({
            client: createEvmClient(
                chainScope,
                testChainContext({ chain }),
                chain,
            ),
            chain,
            scope: chainScope,
        })
    }

    it('holds back cents, not dollars, on Base, L1 data fee included', async () => {
        const l1Fee = 300_000_000_000n
        const reserve = await reserveOn(BASE, {
            baseFee: 5_000_000n,
            tip: 1_000_000n,
            l1Fee,
        })

        expect(reserve.toString()).toBe(
            (
                2n *
                (SWAP_TOKEN_DEPOSIT_GAS_CEILING *
                    (2n * 5_000_000n + 1_000_000n) +
                    SURCHARGE_HEADROOM * l1Fee)
            ).toString(),
        )
        // The reported account: 0.0135 ETH used to fill only 0.0085.
        const balance = new Decimal(((135n * ETH) / 10_000n).toString())
        expect(
            balance
                .sub(reserve)
                .greaterThan(((134n * ETH) / 10_000n).toString()),
        ).toBe(true)
    })

    // Polygon's fee is in POL and its tip is floored at 25 gwei.
    it.each([
        ['Optimism', OPTIMISM, ETH / 10_000n],
        ['Arbitrum', evmChainOf('arbitrum'), ETH / 10_000n],
        ['Polygon', POLYGON, ETH / 100n],
    ])('stays a small fraction of the coin on %s', async (_, chain, bound) => {
        const reserve = await reserveOn(chain, {
            baseFee: 10_000_000n,
            tip: 1_000_000n,
            l1Fee: 100_000_000_000n,
        })

        expect(reserve.greaterThan(0)).toBe(true)
        expect(reserve.lessThan(bound.toString())).toBe(true)
    })

    it('covers a router swap at the going gas price on Ethereum', async () => {
        const baseFee = 20n * GWEI
        const tip = GWEI

        const reserve = await reserveOn(ETHEREUM, { baseFee, tip })

        const routerSwapFee = 200_000n * (baseFee + tip)
        expect(reserve.greaterThanOrEqualTo(routerSwapFee.toString())).toBe(
            true,
        )
        expect(reserve.toString()).toBe(
            (
                2n *
                SWAP_TOKEN_DEPOSIT_GAS_CEILING *
                (2n * baseFee + tip)
            ).toString(),
        )
    })
})

describe('evmShortfallOf', () => {
    it('is null at exactly the required balance', () => {
        expect(evmShortfallOf(5n, 5n)).toBeNull()
    })

    it('is the difference below it', () => {
        expect(evmShortfallOf(4n, 5n)?.toString()).toBe('1')
    })
})
