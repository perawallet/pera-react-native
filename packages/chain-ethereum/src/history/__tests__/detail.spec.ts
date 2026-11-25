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
    encodeFunctionData,
    erc20Abi,
    keccak256,
    maxUint256,
    serializeTransaction,
    type Hex,
    type TransactionSerializable,
} from 'viem'
import { setupServer } from 'msw/node'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    EvmRpcErrorFixture,
    evmRpcHandlers,
    evmRpcTransaction,
    evmSignedRpcTransaction,
    type EvmRpcResponder,
} from '../../blockchain/msw-handlers'
import { TEST_RPC_URL, testChainContext } from '../../__tests__/context'
import { ETHEREUM } from '../../__tests__/evm-chains'
import { readEthereumNative } from '../../signing/transaction-view'
import { readEvmTransactionDetail } from '../detail'

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const SPENDER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

const approve = (amount: bigint) =>
    encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [SPENDER, amount],
    })

const PRE_EIP1559 = { maxFeePerGas: undefined, maxPriorityFeePerGas: undefined }

const call = (
    fields: Partial<TransactionSerializable> = {},
): TransactionSerializable =>
    ({
        type: 'eip1559',
        chainId: 1,
        nonce: 7,
        to: USDC,
        gas: 60_000n,
        maxFeePerGas: 2_000_000_000n,
        maxPriorityFeePerGas: 1_000_000_000n,
        ...fields,
    }) as TransactionSerializable

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

const read = (hash: string, feePaid?: Decimal) =>
    readEvmTransactionDetail(testChainContext(), ETHEREUM, SCOPE, hash, feePaid)

const HASH = `0x${'ab'.repeat(32)}` as Hex

describe('readEvmTransactionDetail', () => {
    it("reads an unlimited approval's calldata from the node, mined and with the fee paid", async () => {
        const tx = await evmSignedRpcTransaction(
            call({ data: approve(maxUint256) }),
        )
        node(tx)

        const native = await read(tx.hash, new Decimal('21000'))

        expect(native?.family).toBe('evm')
        expect(readEthereumNative(native!)).toMatchObject({
            kind: 'contract-call',
            isMined: true,
            feePaid: new Decimal('21000'),
            call: { kind: 'approve', spender: SPENDER },
        })
    })

    it.each([
        [
            'legacy, pre-EIP-155',
            {
                ...PRE_EIP1559,
                type: 'legacy',
                chainId: undefined,
                gasPrice: 1n,
            },
        ],
        ['legacy, EIP-155', { ...PRE_EIP1559, type: 'legacy', gasPrice: 1n }],
        [
            'EIP-2930',
            {
                ...PRE_EIP1559,
                type: 'eip2930',
                gasPrice: 1n,
                accessList: [{ address: USDC, storageKeys: [HASH] }],
            },
        ],
        [
            'EIP-4844',
            {
                type: 'eip4844',
                maxFeePerBlobGas: 1n,
                blobVersionedHashes: [`0x01${'cd'.repeat(31)}`],
            },
        ],
        [
            'EIP-7702',
            {
                type: 'eip7702',
                authorizationList: [
                    {
                        address: USDC,
                        chainId: 1,
                        nonce: 1,
                        r: HASH,
                        s: HASH,
                        yParity: 0,
                    },
                ],
            },
        ],
    ] as const)('reads a %s transaction', async (_, fields) => {
        const tx = await evmSignedRpcTransaction(
            call({
                ...fields,
                data: approve(maxUint256),
            } as Partial<TransactionSerializable>),
        )
        node(tx)

        const view = readEthereumNative((await read(tx.hash))!)

        expect(view).toMatchObject({ call: { kind: 'approve' } })
    })

    it('reads a plain value transfer as a transfer', async () => {
        const tx = await evmSignedRpcTransaction(
            call({ to: SPENDER, value: 10n ** 18n }),
        )
        node(tx)

        const view = readEthereumNative((await read(tx.hash))!)

        expect(view).toMatchObject({
            kind: 'transfer',
            value: new Decimal('1000000000000000000'),
        })
        expect(view).not.toHaveProperty('feePaid')
    })

    it('reads a contract creation, which has no recipient', async () => {
        const tx = await evmSignedRpcTransaction(
            call({ to: undefined, data: '0x6080' }),
        )
        node(tx)

        const view = readEthereumNative((await read(tx.hash))!)

        expect(view.kind).toBe('contract-call')
        expect(view.to).toBeUndefined()
        expect(view).not.toHaveProperty('call')
    })

    it('leaves calldata that is not exactly a standard call undecoded', async () => {
        const tx = await evmSignedRpcTransaction(
            call({ data: `${approve(1n)}00` }),
        )
        node(tx)

        expect(readEthereumNative((await read(tx.hash))!)).not.toHaveProperty(
            'call',
        )
    })

    it('returns null for another transaction the node answers with', async () => {
        node(await evmSignedRpcTransaction(call({ data: approve(0n) })))

        expect(await read(HASH)).toBeNull()
    })

    it('returns null for another transaction answered under the requested hash', async () => {
        const grant = await evmSignedRpcTransaction(
            call({ data: approve(maxUint256) }),
        )
        const revoke = await evmSignedRpcTransaction(
            call({ data: approve(0n) }),
        )
        node({ ...revoke, hash: grant.hash })

        expect(await read(grant.hash)).toBeNull()
    })

    it.each([
        ['an OP-stack deposit', '0x7e'],
        ['an Arbitrum internal transaction', '0x6a'],
    ] as const)(
        'returns null for %s, which viem cannot rebuild',
        async (_, type) => {
            node(
                evmRpcTransaction({
                    hash: HASH,
                    type: type as '0x0',
                    v: '0x0',
                    r: '0x0',
                    s: '0x0',
                }),
            )

            expect(await read(HASH)).toBeNull()
        },
    )

    it('returns null for a transaction whose signature recovers no sender', async () => {
        const raw = serializeTransaction(
            call({ ...PRE_EIP1559, type: 'legacy', gasPrice: 1n }),
            { r: '0x0', s: '0x1', v: 27n },
        )
        const hash = keccak256(raw)
        node(
            evmRpcTransaction({
                hash,
                chainId: '0x1',
                nonce: '0x7',
                to: USDC,
                gas: '0xea60',
                gasPrice: '0x1',
                v: '0x25',
                r: '0x0',
                s: '0x1',
            }),
        )

        expect(await read(hash)).toBeNull()
    })

    it('takes the sender from the signature, not from the node', async () => {
        const tx = await evmSignedRpcTransaction(
            call({ data: approve(maxUint256) }),
        )
        node({ ...tx, from: SPENDER })

        const view = readEthereumNative((await read(tx.hash))!)

        expect(view.from).toBe(tx.from)
    })

    it('returns null for a transaction the node does not hold', async () => {
        node(null)

        expect(await read(HASH)).toBeNull()
    })

    it("returns null, without asking the node, for an id that isn't a transaction hash", async () => {
        // No RPC handler is registered, so a request would fail the test.
        await expect(read('withdrawal:42')).resolves.toBeNull()
    })

    it('rejects when the node fails', async () => {
        node(new EvmRpcErrorFixture(-32_000, 'boom'))

        await expect(read(HASH)).rejects.toThrow()
    })

    it("carries a type-2 transaction's nonce, gas limit and fee caps, and no single gas price", async () => {
        const tx = await evmSignedRpcTransaction(call({ data: approve(1n) }))
        node(tx)

        const view = readEthereumNative((await read(tx.hash))!)

        expect(view).toMatchObject({
            onChain: {
                nonce: 7,
                gas: 60_000n,
                maxFeePerGas: new Decimal('2000000000'),
                maxPriorityFeePerGas: new Decimal('1000000000'),
            },
        })
        expect('onChain' in view && view.onChain?.gasPrice).toBeUndefined()
    })

    it("carries a legacy transaction's single gas price, and no fee caps", async () => {
        const tx = await evmSignedRpcTransaction(
            call({
                ...PRE_EIP1559,
                type: 'legacy',
                gasPrice: 3_000_000_000n,
                data: approve(1n),
            }),
        )
        node(tx)

        const view = readEthereumNative((await read(tx.hash))!)

        expect(view).toMatchObject({
            onChain: {
                nonce: 7,
                gas: 60_000n,
                gasPrice: new Decimal('3000000000'),
            },
        })
        expect('onChain' in view && view.onChain?.maxFeePerGas).toBeUndefined()
    })
})
