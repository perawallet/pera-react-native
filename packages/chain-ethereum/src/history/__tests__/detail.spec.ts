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
import { encodeFunctionData, erc20Abi, maxUint256, type Hex } from 'viem'
import { setupServer } from 'msw/node'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    EvmRpcErrorFixture,
    evmRpcHandlers,
    evmRpcTransaction,
    type EvmRpcResponder,
} from '../../blockchain/msw-handlers'
import { TEST_RPC_URL, testChainContext } from '../../__tests__/context'
import { ETHEREUM } from '../../__tests__/evm-chains'
import { readEthereumNative } from '../../signing/transaction-view'
import { readEvmTransactionDetail } from '../detail'

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const HASH = `0x${'ab'.repeat(32)}` as Hex
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const SPENDER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const node = (
    eth_getTransactionByHash: EvmRpcResponder<'eth_getTransactionByHash'>,
) =>
    server.use(
        ...evmRpcHandlers({
            rpcUrl: TEST_RPC_URL,
            responses: { eth_getTransactionByHash },
        }),
    )

const read = (feePaid?: Decimal) =>
    readEvmTransactionDetail(testChainContext(), ETHEREUM, SCOPE, HASH, feePaid)

describe('readEvmTransactionDetail', () => {
    it("reads an unlimited approval's calldata from the node, mined and with the fee paid", async () => {
        node(
            evmRpcTransaction({
                hash: HASH,
                to: USDC,
                input: encodeFunctionData({
                    abi: erc20Abi,
                    functionName: 'approve',
                    args: [SPENDER, maxUint256],
                }),
            }),
        )

        const native = await read(new Decimal('21000'))

        expect(native?.family).toBe('evm')
        expect(readEthereumNative(native!)).toMatchObject({
            kind: 'contract-call',
            isMined: true,
            feePaid: new Decimal('21000'),
            call: { kind: 'approve', spender: SPENDER },
        })
    })

    it('reads a plain value transfer as a transfer', async () => {
        node(evmRpcTransaction({ hash: HASH, value: '0xde0b6b3a7640000' }))

        const view = readEthereumNative((await read())!)

        expect(view).toMatchObject({
            kind: 'transfer',
            value: new Decimal('1000000000000000000'),
        })
        expect(view).not.toHaveProperty('feePaid')
    })

    it('reads a contract creation, which has no recipient', async () => {
        node(evmRpcTransaction({ hash: HASH, to: null, input: '0x6080' }))

        const view = readEthereumNative((await read())!)

        expect(view.kind).toBe('contract-call')
        expect(view.to).toBeUndefined()
        expect(view).not.toHaveProperty('call')
    })

    it('leaves calldata that is not exactly a standard call undecoded', async () => {
        node(
            evmRpcTransaction({
                hash: HASH,
                to: USDC,
                input: `${encodeFunctionData({
                    abi: erc20Abi,
                    functionName: 'approve',
                    args: [SPENDER, 1n],
                })}00`,
            }),
        )

        expect(readEthereumNative((await read())!)).not.toHaveProperty('call')
    })

    it('returns null for a transaction the node does not hold', async () => {
        node(null)

        expect(await read()).toBeNull()
    })

    it("returns null, without asking the node, for an id that isn't a transaction hash", async () => {
        // No RPC handler is registered, so a request would fail the test.
        await expect(
            readEvmTransactionDetail(
                testChainContext(),
                ETHEREUM,
                SCOPE,
                'withdrawal:42',
            ),
        ).resolves.toBeNull()
    })

    it('rejects when the node fails', async () => {
        node(new EvmRpcErrorFixture(-32_000, 'boom'))

        await expect(read()).rejects.toThrow()
    })
})
