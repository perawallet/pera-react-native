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
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'
import { setupServer } from 'msw/node'
import {
    encodeFunctionData,
    erc20Abi,
    parseGwei,
    parseTransaction,
    toHex,
    type Address,
    type Hex,
    type RpcFeeHistory,
} from 'viem'
import { FEE_PRESETS } from '@perawallet/wallet-core-chain-contract'
import { evmRpcHandlers } from '../../blockchain/msw-handlers'
import { createEvmClient } from '../../blockchain/utils/createEvmClient'
import { TEST_RPC_URL, testChainContext } from '../../__tests__/context'
import {
    BASE,
    BSC,
    ETHEREUM,
    OPTIMISM,
    EVM_TEST_CHAINS,
    POLYGON,
    eip155IdOf,
    evmChainOf,
    evmScopeOf,
} from '../../__tests__/evm-chains'
import type { EvmChain } from '../../chains/types'
import { VIEM_TRANSFER_NONCE_0 } from '../../signing/__tests__/fixtures'
import type { EvmTransferCall } from '../builder'
import {
    evmFeePresetOf,
    maxFeePerGasWithin,
    readEvmFeePresets,
    readEvmGas,
    readEvmSurcharge,
    readTransferFees,
    toEvmFeeEstimate,
    withRequestedEvmFees,
} from '../fees'
import {
    OP_STACK_ORACLE_ADDRESS,
    opStackOracleResponder,
    unsignedEncodingOf,
    type OpStackOracleCall,
    type OpStackOracleFixture,
} from './op-stack-oracle'

const call = {
    chainId: 1,
    from: '0x00000000000000000000000000000000000000aa',
    to: '0x00000000000000000000000000000000000000bb',
    value: 1n,
} as const

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const gwei = (...values: number[]) => values.map(v => toHex(parseGwei(`${v}`)))

const readWith = (history: Partial<RpcFeeHistory>) => {
    server.use(
        ...evmRpcHandlers({
            rpcUrl: TEST_RPC_URL,
            responses: {
                eth_feeHistory: {
                    oldestBlock: '0x1',
                    baseFeePerGas: [],
                    gasUsedRatio: [0.5],
                    ...history,
                },
            },
        }),
    )
    return readTransferFees(
        createEvmClient(
            { chainId: 'ethereum', networkId: 'mainnet' },
            testChainContext(),
            ETHEREUM,
        ),
        call,
        ETHEREUM,
        'mainnet',
    )
}

describe('readTransferFees', () => {
    it('maps slow, normal and fast to the 10th, 50th and 90th fee-history percentiles', async () => {
        let params: readonly unknown[] = []
        server.use(
            ...evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: {
                    eth_feeHistory: requestParams => {
                        params = requestParams
                        return {
                            oldestBlock: '0x1',
                            baseFeePerGas: gwei(9, 10),
                            gasUsedRatio: [0.5, 0.5, 0.5],
                            reward: [
                                gwei(1, 4, 9),
                                gwei(2, 5, 7),
                                gwei(3, 6, 8),
                            ],
                        }
                    },
                },
            }),
        )

        const fees = await readTransferFees(
            createEvmClient(
                { chainId: 'ethereum', networkId: 'mainnet' },
                testChainContext(),
                ETHEREUM,
            ),
            call,
            ETHEREUM,
            'mainnet',
        )

        expect(params).toEqual(['0xa', 'latest', [10, 50, 90]])
        expect(fees.gas).toBe(21_000n)
        expect(fees.baseFeePerGas).toBe(parseGwei('10'))
        expect(fees.presets).toEqual({
            slow: {
                maxPriorityFeePerGas: parseGwei('2'),
                maxFeePerGas: parseGwei('22'),
            },
            normal: {
                maxPriorityFeePerGas: parseGwei('5'),
                maxFeePerGas: parseGwei('25'),
            },
            fast: {
                maxPriorityFeePerGas: parseGwei('8'),
                maxFeePerGas: parseGwei('28'),
            },
        })
    })

    it('leaves empty blocks out of the tip', async () => {
        const fees = await readWith({
            baseFeePerGas: gwei(2),
            gasUsedRatio: [0, 0.5, 0],
            reward: [gwei(0, 0, 0), gwei(1, 2, 3), gwei(0, 0, 0)],
        })

        expect(
            Object.values(fees.presets).map(p => p.maxPriorityFeePerGas),
        ).toEqual([parseGwei('1'), parseGwei('2'), parseGwei('3')])
    })

    it.each([
        ['every block empty', { gasUsedRatio: [0], reward: [gwei(0, 0, 0)] }],
        ['no reward', { reward: undefined }],
        ['a row with only one entry', { reward: [gwei(1)] }],
    ])("takes the node's suggested tip when %s", async (_, history) => {
        const fees = await readWith({ baseFeePerGas: gwei(2), ...history })

        for (const preset of Object.values(fees.presets)) {
            expect(preset.maxPriorityFeePerGas).toBe(parseGwei('1'))
            expect(preset.maxFeePerGas).toBe(parseGwei('5'))
        }
    })

    it('rejects an empty fee history', async () => {
        await expect(readWith({ baseFeePerGas: [] })).rejects.toThrow()
    })
})

describe('evmFeePresetOf', () => {
    const presets = {
        slow: {
            maxPriorityFeePerGas: parseGwei('0.5'),
            maxFeePerGas: parseGwei('4.5'),
        },
        normal: {
            maxPriorityFeePerGas: parseGwei('1'),
            maxFeePerGas: parseGwei('5'),
        },
        fast: {
            maxPriorityFeePerGas: parseGwei('2'),
            maxFeePerGas: parseGwei('6'),
        },
    }

    it.each([
        ['at the normal tip', '1', 'normal'],
        ['between normal and fast', '1.5', 'normal'],
        ['at the fast tip', '2', 'fast'],
        ['above the fast tip', '9', 'fast'],
        ['at the slow tip', '0.5', 'slow'],
        ['below every preset', '0.1', 'slow'],
    ])('reads %s as %s', (_label, tip, expected) => {
        expect(evmFeePresetOf(parseGwei(tip), presets)).toBe(expected)
    })
})

describe('maxFeePerGasWithin', () => {
    it('floors the budget left after the surcharge headroom over the gas', () => {
        expect(maxFeePerGasWithin(1_000_000n + 2n * 100n, 21_000n, 100n)).toBe(
            47n,
        )
    })

    it('answers zero when the surcharge headroom alone exceeds the budget', () => {
        expect(maxFeePerGasWithin(150n, 21_000n, 100n)).toBe(0n)
    })

    it('never answers a price whose worst case exceeds the budget', () => {
        const budget = 123_456_789n
        const price = maxFeePerGasWithin(budget, 21_000n, 777n)

        expect(21_000n * price + 2n * 777n).toBeLessThanOrEqual(budget)
        expect(21_000n * (price + 1n) + 2n * 777n).toBeGreaterThan(budget)
    })
})

describe('toEvmFeeEstimate', () => {
    const fees = {
        gas: 21_000n,
        gasLimit: 25_200n,
        baseFeePerGas: parseGwei('10'),
        presets: {
            slow: {
                maxPriorityFeePerGas: parseGwei('2'),
                maxFeePerGas: parseGwei('22'),
            },
            normal: {
                maxPriorityFeePerGas: parseGwei('5'),
                maxFeePerGas: parseGwei('25'),
            },
            fast: {
                maxPriorityFeePerGas: parseGwei('8'),
                maxFeePerGas: parseGwei('28'),
            },
        },
        surcharge: 0n,
    }

    it('prices each preset as gas x (base fee + tip), capped at gasLimit x maxFeePerGas, in wei', () => {
        const estimate = toEvmFeeEstimate(fees, 'normal', ETHEREUM)

        expect(estimate.assetRef).toEqual({
            chainId: 'ethereum',
            assetId: 'native',
        })
        expect(estimate.presets?.normal.amount.toFixed()).toBe(
            (21_000n * parseGwei('15')).toString(),
        )
        expect(estimate.presets?.fast.maxAmount.toFixed()).toBe(
            (25_200n * parseGwei('28')).toString(),
        )
    })

    it.each(['slow', 'normal', 'fast'] as const)(
        'reports the %s preset as the headline amount',
        preset => {
            const estimate = toEvmFeeEstimate(fees, preset, ETHEREUM)

            expect(estimate.amount).toBe(estimate.presets?.[preset].amount)
        },
    )

    it("expects Ethereum's presets to land within a minute, 36 seconds and 12 seconds", () => {
        const { presets } = toEvmFeeEstimate(fees, 'normal', ETHEREUM)

        expect(presets?.slow.estimatedWaitSeconds).toBe(60)
        expect(presets?.normal.estimatedWaitSeconds).toBe(36)
        expect(presets?.fast.estimatedWaitSeconds).toBe(12)
    })

    it('never expects a sub-second chain to land in under a second', () => {
        const { presets } = toEvmFeeEstimate(
            fees,
            'normal',
            evmChainOf('arbitrum'),
        )

        expect(presets?.fast.estimatedWaitSeconds).toBe(1)
        expect(presets?.slow.estimatedWaitSeconds).toBe(2)
    })

    it.each(EVM_TEST_CHAINS)(
        'expects a whole-second wait on $row.id that shortens as the preset speeds up',
        chain => {
            const { presets } = toEvmFeeEstimate(fees, 'normal', chain)
            const waits = FEE_PRESETS.map(
                preset => presets?.[preset].estimatedWaitSeconds ?? 0,
            )

            for (const wait of waits) {
                expect(Number.isInteger(wait) && wait >= 1).toBe(true)
            }
            expect(waits).toEqual([...waits].sort((a, b) => b - a))
        },
    )
})

describe('per-chain fee strategies', () => {
    const L1_DATA_FEE = 1_234_567_890n
    const OPERATOR_FEE = 9_876n
    const HISTORY = { baseFeePerGas: gwei(10), reward: [gwei(1, 30, 40)] }
    // The fast preset of HISTORY: its caps encode longest, so it prices every preset.
    const FAST = {
        maxPriorityFeePerGas: parseGwei('40'),
        maxFeePerGas: parseGwei('60'),
    }

    let oracleCalls: OpStackOracleCall[]
    let nonceReads: number
    let nodeResponses: Partial<
        Record<'eth_estimateGas' | 'eth_getTransactionCount', Hex>
    >

    beforeEach(() => {
        oracleCalls = []
        nonceReads = 0
        nodeResponses = {}
    })

    const baseCall = {
        ...call,
        chainId: eip155IdOf(BASE),
    }

    const pricedAs = (
        nonce: number,
        gas: bigint,
        data?: Hex,
        chain: EvmChain = BASE,
    ): Parameters<typeof unsignedEncodingOf>[0] => ({
        type: 'eip1559',
        chainId: eip155IdOf(chain),
        nonce,
        to: call.to,
        value: call.value,
        data,
        gas,
        ...FAST,
    })

    const oracleOf = (
        encodings: Hex[],
        l1Fee = L1_DATA_FEE,
    ): OpStackOracleFixture => ({
        l1Fees: new Map(encodings.map(encoding => [encoding, l1Fee])),
        operatorFee: OPERATOR_FEE,
    })

    const readOn = (
        chain: EvmChain,
        history: Pick<RpcFeeHistory, 'baseFeePerGas'> & Partial<RpcFeeHistory>,
        {
            oracle = oracleOf([unsignedEncodingOf(pricedAs(0, 21_000n))]),
            transfer = call,
        }: {
            oracle?: OpStackOracleFixture
            transfer?: EvmTransferCall & { data?: Hex }
        } = {},
    ) => {
        server.use(
            ...evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: {
                    eth_feeHistory: {
                        oldestBlock: '0x1',
                        gasUsedRatio: [0.5],
                        ...history,
                    },
                    eth_call: opStackOracleResponder(oracle, oracleCalls),
                    eth_getTransactionCount: () => {
                        nonceReads += 1
                        return nodeResponses.eth_getTransactionCount ?? '0x0'
                    },
                    ...(nodeResponses.eth_estimateGas && {
                        eth_estimateGas: nodeResponses.eth_estimateGas,
                    }),
                },
            }),
        )
        const scope = evmScopeOf(chain)
        return readTransferFees(
            createEvmClient(scope, testChainContext({ chain }), chain),
            transfer,
            chain,
            scope.networkId,
        )
    }

    const readBase = (options: Parameters<typeof readOn>[2] = {}) =>
        readOn(BASE, HISTORY, { transfer: baseCall, ...options })

    it("adds Base's L1 data fee and operator fee to every preset", async () => {
        const fees = await readBase()
        const estimate = toEvmFeeEstimate(fees, 'normal', BASE)
        const surcharge = L1_DATA_FEE + OPERATOR_FEE

        expect(fees.surcharge).toBe(surcharge)
        for (const [preset, values] of Object.entries(fees.presets)) {
            const priced =
                estimate.presets?.[preset as keyof typeof fees.presets]
            expect(priced?.amount.toFixed()).toBe(
                (
                    fees.gas *
                        (fees.baseFeePerGas + values.maxPriorityFeePerGas) +
                    surcharge
                ).toString(),
            )
            expect(priced?.maxAmount.toFixed()).toBe(
                (fees.gas * values.maxFeePerGas + 2n * surcharge).toString(),
            )
        }
    })

    it("adds Optimism's L1 data fee and operator fee from the same oracle", async () => {
        const fees = await readOn(OPTIMISM, HISTORY, {
            transfer: { ...call, chainId: eip155IdOf(OPTIMISM) },
            oracle: oracleOf([
                unsignedEncodingOf(pricedAs(0, 21_000n, undefined, OPTIMISM)),
            ]),
        })

        expect(fees.surcharge).toBe(L1_DATA_FEE + OPERATOR_FEE)
    })

    it('prices the L1 fee on the transaction the send would sign', async () => {
        nodeResponses = {
            eth_getTransactionCount: '0x12c',
            eth_estimateGas: '0xfde8',
        }
        const data = encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [call.to, 5n],
        })
        const encoding = unsignedEncodingOf(pricedAs(300, 65_000n, data))

        const fees = await readBase({
            oracle: oracleOf([encoding]),
            transfer: { ...baseCall, data },
        })

        expect(fees.surcharge).toBe(L1_DATA_FEE + OPERATOR_FEE)
        expect(oracleCalls).toContainEqual({
            functionName: 'getOperatorFee',
            gas: 65_000n,
        })
        expect(oracleCalls).toContainEqual({
            functionName: 'getL1Fee',
            encoding,
        })
    })

    it("reads Base's oracle at the OP-stack predeploy", async () => {
        let target: unknown
        const answer = opStackOracleResponder(
            oracleOf([unsignedEncodingOf(pricedAs(0, 21_000n))]),
        )
        server.use(
            ...evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: {
                    eth_feeHistory: {
                        oldestBlock: '0x1',
                        gasUsedRatio: [0.5],
                        ...HISTORY,
                    },
                    eth_call: params => {
                        target = (params[0] as { to: unknown }).to
                        return answer(params)
                    },
                },
            }),
        )
        const scope = evmScopeOf(BASE)

        await readTransferFees(
            createEvmClient(scope, testChainContext({ chain: BASE }), BASE),
            baseCall,
            BASE,
            scope.networkId,
        )

        const oracle =
            BASE.row.fee.kind === 'eip1559-op-stack'
                ? BASE.row.fee.gasPriceOracleAddress
                : undefined
        expect(oracle).toBe(OP_STACK_ORACLE_ADDRESS)
        expect(target).toBe(OP_STACK_ORACLE_ADDRESS)
    })

    it('rejects when the L1 data fee read fails, with no partial fee', async () => {
        await expect(readBase({ oracle: oracleOf([]) })).rejects.toThrow()
    })

    it("never prices Polygon's tip below the network minimum", async () => {
        const fees = await readOn(POLYGON, HISTORY)

        expect(fees.presets.slow).toEqual({
            maxPriorityFeePerGas: parseGwei('25'),
            maxFeePerGas: parseGwei('45'),
        })
        expect(fees.presets.normal.maxPriorityFeePerGas).toBe(parseGwei('30'))
        expect(fees.presets.fast.maxPriorityFeePerGas).toBe(parseGwei('40'))
    })

    it("floors every Polygon preset on a quiet network's empty blocks", async () => {
        const fees = await readOn(POLYGON, {
            baseFeePerGas: gwei(10),
            gasUsedRatio: [0],
            reward: [gwei(0, 0, 0)],
        })

        for (const preset of Object.values(fees.presets)) {
            expect(preset.maxPriorityFeePerGas).toBe(parseGwei('25'))
        }
    })

    it.each(EVM_TEST_CHAINS.filter(chain => chain.row.fee.kind === 'eip1559'))(
        "prices $row.id with Ethereum's math, in its own coin",
        async chain => {
            const [onChain, onEthereum] = [
                await readOn(chain, HISTORY),
                await readOn(ETHEREUM, HISTORY),
            ]

            expect(onChain).toEqual(onEthereum)
            expect(oracleCalls).toEqual([])
            expect(nonceReads).toBe(0)
            expect(onChain.surcharge).toBe(0n)
            expect(toEvmFeeEstimate(onChain, 'slow', chain).assetRef).toEqual(
                chain.descriptor.nativeAsset.ref,
            )
        },
    )
})

const EMPTY_REWARDS = { gasUsedRatio: [0], reward: [gwei(0, 0, 0)] }

const readPresetsOn = (
    chain: EvmChain,
    history: Partial<RpcFeeHistory>,
    suggestedTip: Hex = toHex(parseGwei('1')),
) => {
    let tipReads = 0
    server.use(
        ...evmRpcHandlers({
            rpcUrl: TEST_RPC_URL,
            responses: {
                eth_feeHistory: {
                    oldestBlock: '0x1',
                    baseFeePerGas: gwei(2),
                    gasUsedRatio: [0.5],
                    ...history,
                },
                eth_maxPriorityFeePerGas: () => {
                    tipReads += 1
                    return suggestedTip
                },
            },
        }),
    )
    const scope = evmScopeOf(chain)
    return {
        presets: readEvmFeePresets(
            createEvmClient(scope, testChainContext({ chain }), chain),
            chain,
            scope.networkId,
        ),
        tipReads: () => tipReads,
    }
}

describe('readEvmFeePresets on a quiet network', () => {
    it.each([ETHEREUM, BASE, BSC])(
        'tips a non-zero amount on $row.id when the fee history has no rewards',
        async chain => {
            const read = readPresetsOn(chain, EMPTY_REWARDS)

            const { presets } = await read.presets

            for (const preset of Object.values(presets)) {
                expect(preset.maxPriorityFeePerGas).toBeGreaterThan(0n)
            }
        },
    )

    it('keeps slow <= normal <= fast when the floor lifts only some presets', async () => {
        const read = readPresetsOn(
            ETHEREUM,
            { gasUsedRatio: [0.5], reward: [gwei(0, 3, 5)] },
            toHex(parseGwei('2')),
        )

        const { presets } = await read.presets

        expect(
            [presets.slow, presets.normal, presets.fast].map(
                p => p.maxPriorityFeePerGas,
            ),
        ).toEqual([parseGwei('2'), parseGwei('3'), parseGwei('5')])
    })

    it('never leaves the max fee at zero on a chain with a zero base fee', async () => {
        const read = readPresetsOn(BSC, {
            ...EMPTY_REWARDS,
            baseFeePerGas: ['0x0', '0x0'],
        })

        const { presets } = await read.presets

        for (const preset of Object.values(presets)) {
            expect(preset.maxFeePerGas).toBe(parseGwei('0.05'))
            expect(preset.maxPriorityFeePerGas).toBe(parseGwei('0.05'))
        }
    })

    it('reads no suggestion when the history carries a tip for every preset', async () => {
        const read = readPresetsOn(ETHEREUM, { reward: [gwei(1, 2, 3)] })

        await read.presets

        expect(read.tipReads()).toBe(0)
    })

    it.each([
        [POLYGON, '25'],
        [BSC, '0.05'],
    ])(
        'reads no suggestion on $row.id, which has a minimum tip, and applies that minimum',
        async (chain, minimumGwei) => {
            const read = readPresetsOn(chain, EMPTY_REWARDS)

            const { presets } = await read.presets

            expect(read.tipReads()).toBe(0)
            expect(presets.slow.maxPriorityFeePerGas).toBe(
                parseGwei(minimumGwei),
            )
        },
    )

    it('still tips a wei where the node suggests no tip', async () => {
        const read = readPresetsOn(ETHEREUM, EMPTY_REWARDS, '0x0')

        const { presets } = await read.presets

        for (const preset of Object.values(presets)) {
            expect(preset.maxPriorityFeePerGas).toBe(1n)
        }
    })
})

describe('readEvmGas', () => {
    const address = (n: number) =>
        `0x${n.toString(16).padStart(40, '0')}` as Address
    const gasCall = { from: address(1), to: address(2), value: 0n }
    const clientOn = (responses: Parameters<typeof evmRpcHandlers>[0]) => {
        server.use(...evmRpcHandlers({ rpcUrl: TEST_RPC_URL, ...responses }))
        return createEvmClient(
            { chainId: 'ethereum', networkId: 'mainnet' },
            testChainContext(),
            ETHEREUM,
        )
    }

    it('pads a call with calldata by a fifth', async () => {
        const client = clientOn({ responses: { eth_estimateGas: '0xfde8' } })

        const gas = await readEvmGas(client, { ...gasCall, data: '0xa9059cbb' })

        expect(gas).toEqual({ gas: 65_000n, gasLimit: 78_000n })
    })

    it('leaves a plain send at its estimate and reads no block', async () => {
        let blockReads = 0
        const client = clientOn({
            responses: {
                eth_getBlockByNumber: () => {
                    blockReads += 1
                    return { gasLimit: '0x1c9c380' }
                },
            },
        })

        const gas = await readEvmGas(client, gasCall)

        expect(gas).toEqual({ gas: 21_000n, gasLimit: 21_000n })
        expect(blockReads).toBe(0)
    })

    it('pads a plain send whose estimate shows the recipient ran code', async () => {
        let blockReads = 0
        const client = clientOn({
            responses: {
                eth_estimateGas: '0xc350',
                eth_getBlockByNumber: () => {
                    blockReads += 1
                    return { gasLimit: '0x1c9c380' }
                },
            },
        })

        const gas = await readEvmGas(client, gasCall)

        expect(gas).toEqual({ gas: 50_000n, gasLimit: 60_000n })
        expect(blockReads).toBe(1)
    })

    it('treats empty calldata as a plain send', async () => {
        const client = clientOn({})

        const gas = await readEvmGas(client, { ...gasCall, data: '0x' })

        expect(gas.gasLimit).toBe(gas.gas)
    })

    it('caps the padded limit at the block gas limit', async () => {
        const client = clientOn({
            responses: {
                eth_estimateGas: '0xfde8',
                eth_getBlockByNumber: { gasLimit: '0x11170' },
            },
        })

        const gas = await readEvmGas(client, { ...gasCall, data: '0xa9059cbb' })

        expect(gas).toEqual({ gas: 65_000n, gasLimit: 70_000n })
    })
})

describe('withRequestedEvmFees', () => {
    const preset = {
        maxPriorityFeePerGas: parseGwei('2'),
        maxFeePerGas: parseGwei('12'),
    }
    const base = parseGwei('5')

    it('takes a dApp fee above the preset', () => {
        expect(
            withRequestedEvmFees(base, preset, {
                maxFeePerGas: parseGwei('50'),
                maxPriorityFeePerGas: parseGwei('9'),
            }),
        ).toEqual({
            maxFeePerGas: parseGwei('50'),
            maxPriorityFeePerGas: parseGwei('9'),
        })
    })

    it('keeps the preset where the dApp asked for less', () => {
        expect(
            withRequestedEvmFees(base, preset, {
                maxFeePerGas: parseGwei('1'),
                maxPriorityFeePerGas: parseGwei('1'),
            }),
        ).toEqual(preset)
        expect(withRequestedEvmFees(base, preset, {})).toEqual(preset)
    })

    it('lifts the max fee to cover the base-fee headroom when the dApp raised only the tip', () => {
        expect(
            withRequestedEvmFees(base, preset, {
                maxPriorityFeePerGas: parseGwei('9'),
            }),
        ).toEqual({
            maxFeePerGas: parseGwei('19'),
            maxPriorityFeePerGas: parseGwei('9'),
        })
    })

    it('keeps a max fee the dApp named, adding no headroom to it', () => {
        expect(
            withRequestedEvmFees(base, preset, {
                maxFeePerGas: parseGwei('30'),
                maxPriorityFeePerGas: parseGwei('20'),
            }),
        ).toEqual({
            maxFeePerGas: parseGwei('30'),
            maxPriorityFeePerGas: parseGwei('20'),
        })
    })

    it("counts a dApp's tip only as far as its max fee leaves room above the base fee", () => {
        expect(
            withRequestedEvmFees(base, preset, {
                maxFeePerGas: parseGwei('30'),
                maxPriorityFeePerGas: parseGwei('30'),
            }),
        ).toEqual({
            maxFeePerGas: parseGwei('30'),
            maxPriorityFeePerGas: parseGwei('25'),
        })
    })

    it('pays a legacy gasPrice near the market price exactly that, not the preset max fee mixed with its tip', () => {
        // Base 5, preset { max 12, tip 2 }: a legacy 8 gwei is a tip of 3 over the base fee.
        const signed = withRequestedEvmFees(base, preset, {
            maxFeePerGas: parseGwei('8'),
            maxPriorityFeePerGas: parseGwei('8'),
        })

        expect(signed).toEqual({
            maxFeePerGas: parseGwei('12'),
            maxPriorityFeePerGas: parseGwei('3'),
        })
        const paid = (fees: typeof signed) =>
            fees.maxFeePerGas < base + fees.maxPriorityFeePerGas
                ? fees.maxFeePerGas
                : base + fees.maxPriorityFeePerGas
        expect(paid(signed)).toBe(parseGwei('8'))
    })

    it('floors a dApp max fee below the base fee at no tip', () => {
        expect(
            withRequestedEvmFees(base, preset, {
                maxFeePerGas: parseGwei('1'),
                maxPriorityFeePerGas: parseGwei('1'),
            }),
        ).toEqual(preset)
    })

    it('never signs a max fee below the tip', () => {
        const { maxFeePerGas, maxPriorityFeePerGas } = withRequestedEvmFees(
            base,
            preset,
            {
                maxFeePerGas: parseGwei('1'),
                maxPriorityFeePerGas: parseGwei('30'),
            },
        )

        expect(maxFeePerGas).toBeGreaterThanOrEqual(maxPriorityFeePerGas)
    })
})

describe('readEvmSurcharge', () => {
    it("prices a signed transaction's unsigned encoding", async () => {
        const signed = parseTransaction(VIEM_TRANSFER_NONCE_0)
        if (signed.type !== 'eip1559') throw new Error('expected eip1559')
        const encoding = unsignedEncodingOf(signed)
        const calls: OpStackOracleCall[] = []
        server.use(
            ...evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: {
                    eth_call: opStackOracleResponder(
                        {
                            l1Fees: new Map([[encoding, 777n]]),
                            operatorFee: 3n,
                        },
                        calls,
                    ),
                },
            }),
        )
        const scope = evmScopeOf(BASE)

        const surcharge = await readEvmSurcharge(
            createEvmClient(scope, testChainContext({ chain: BASE }), BASE),
            BASE,
            signed as Parameters<typeof readEvmSurcharge>[2],
        )

        expect(surcharge).toBe(780n)
        expect(calls).toContainEqual({ functionName: 'getL1Fee', encoding })
    })
})
