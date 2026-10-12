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
import { readTransferFees } from '../fees'

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
    it("takes the next block's base fee and the median tip, and doubles the base fee for the cap", async () => {
        const fees = await readWith({
            baseFeePerGas: [toHex(parseGwei('1')), toHex(parseGwei('2'))],
            reward: [[toHex(parseGwei('1'))]],
        })

        expect(fees).toEqual({
            gas: 21_000n,
            baseFeePerGas: parseGwei('2'),
            maxPriorityFeePerGas: parseGwei('1'),
            maxFeePerGas: parseGwei('5'),
        })
    })

    it.each([
        ['a zero reward', [['0x0' as const]]],
        ['no reward', undefined],
    ])('treats %s as a zero tip', async (_, reward) => {
        const fees = await readWith({
            baseFeePerGas: [toHex(parseGwei('2'))],
            reward,
        })

        expect(fees.maxPriorityFeePerGas).toBe(0n)
        expect(fees.maxFeePerGas).toBe(parseGwei('4'))
    })

    it('rejects an empty fee history', async () => {
        await expect(readWith({ baseFeePerGas: [] })).rejects.toThrow()
    })
})
