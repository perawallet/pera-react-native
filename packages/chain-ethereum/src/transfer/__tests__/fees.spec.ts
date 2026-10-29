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
    vi,
} from 'vitest'
import { setupServer } from 'msw/node'
import { parseGwei, toHex, type RpcFeeHistory } from 'viem'
import { estimateL1Fee, estimateOperatorFee } from 'viem/op-stack'
import { FEE_PRESETS } from '@perawallet/wallet-core-chain-contract'
import { evmRpcHandlers } from '../../blockchain/msw-handlers'
import { createEvmClient } from '../../blockchain/utils/createEvmClient'
import { TEST_RPC_URL, testChainContext } from '../../__tests__/context'
import {
    BASE,
    ETHEREUM,
    EVM_TEST_CHAINS,
    POLYGON,
    evmChainOf,
    evmScopeOf,
} from '../../__tests__/evm-chains'
import type { EvmChain } from '../../chains/types'
import { readTransferFees, toEvmFeeEstimate } from '../fees'

vi.mock('viem/op-stack', () => ({
    estimateL1Fee: vi.fn(),
    estimateOperatorFee: vi.fn(),
}))

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
    ])('treats %s as a zero tip', async (_, history) => {
        const fees = await readWith({ baseFeePerGas: gwei(2), ...history })

        for (const preset of Object.values(fees.presets)) {
            expect(preset.maxPriorityFeePerGas).toBe(0n)
            expect(preset.maxFeePerGas).toBe(parseGwei('4'))
        }
    })

    it('rejects an empty fee history', async () => {
        await expect(readWith({ baseFeePerGas: [] })).rejects.toThrow()
    })
})

describe('toEvmFeeEstimate', () => {
    const fees = {
        gas: 21_000n,
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

    it('prices each preset as gas x (base fee + tip), capped at gas x maxFeePerGas, in wei', () => {
        const estimate = toEvmFeeEstimate(fees, 'normal', ETHEREUM)

        expect(estimate.assetRef).toEqual({
            chainId: 'ethereum',
            assetId: 'native',
        })
        expect(estimate.presets?.normal.amount.toFixed()).toBe(
            (21_000n * parseGwei('15')).toString(),
        )
        expect(estimate.presets?.fast.maxAmount.toFixed()).toBe(
            (21_000n * parseGwei('28')).toString(),
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

    beforeEach(() => {
        vi.mocked(estimateL1Fee).mockReset().mockResolvedValue(L1_DATA_FEE)
        vi.mocked(estimateOperatorFee)
            .mockReset()
            .mockResolvedValue(OPERATOR_FEE)
    })

    const readOn = (
        chain: EvmChain,
        history: Pick<RpcFeeHistory, 'baseFeePerGas'> & Partial<RpcFeeHistory>,
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
                },
            }),
        )
        const scope = evmScopeOf(chain)
        return readTransferFees(
            createEvmClient(scope, testChainContext({ chain }), chain),
            call,
            chain,
            scope.networkId,
        )
    }

    const HISTORY = { baseFeePerGas: gwei(10), reward: [gwei(1, 30, 40)] }

    it("adds Base's L1 data fee and operator fee to every preset", async () => {
        const fees = await readOn(BASE, HISTORY)
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
                (fees.gas * values.maxFeePerGas + surcharge).toString(),
            )
        }
    })

    it('names the OP-stack gas price oracle, which our chain definition lacks', async () => {
        await readOn(BASE, HISTORY)

        const oracle =
            BASE.row.fee.kind === 'eip1559-op-stack'
                ? BASE.row.fee.gasPriceOracleAddress
                : undefined
        expect(oracle).toBe('0x420000000000000000000000000000000000000F')
        expect(vi.mocked(estimateL1Fee).mock.calls[0]?.[1]).toMatchObject({
            gasPriceOracleAddress: oracle,
            to: call.to,
            value: call.value,
        })
        expect(vi.mocked(estimateOperatorFee).mock.calls[0]?.[1]).toMatchObject(
            { gasPriceOracleAddress: oracle },
        )
    })

    it('rejects when the L1 data fee read fails, with no partial fee', async () => {
        vi.mocked(estimateL1Fee).mockRejectedValue(new Error('oracle down'))

        await expect(readOn(BASE, HISTORY)).rejects.toThrow('oracle down')
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
            expect(estimateL1Fee).not.toHaveBeenCalled()
            expect(toEvmFeeEstimate(onChain, 'slow', chain).assetRef).toEqual(
                chain.descriptor.nativeAsset.ref,
            )
        },
    )
})
