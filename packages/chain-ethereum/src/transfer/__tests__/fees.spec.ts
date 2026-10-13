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
import { setupServer } from 'msw/node'
import { parseGwei, toHex, type RpcFeeHistory } from 'viem'
import { evmRpcHandlers } from '../../blockchain/msw-handlers'
import { createEvmClient } from '../../blockchain/utils/createEvmClient'
import { TEST_RPC_URL, testChainContext } from '../../__tests__/context'
import { readTransferFees, toEthereumFeeEstimate } from '../fees'

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
        ),
        call,
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
            ),
            call,
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

describe('toEthereumFeeEstimate', () => {
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
    }

    it('prices each preset as gas x (base fee + tip), capped at gas x maxFeePerGas, in wei', () => {
        const estimate = toEthereumFeeEstimate(fees, 'normal')

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
            const estimate = toEthereumFeeEstimate(fees, preset)

            expect(estimate.amount).toBe(estimate.presets?.[preset].amount)
        },
    )
})
