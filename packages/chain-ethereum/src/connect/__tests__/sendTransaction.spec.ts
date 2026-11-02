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
import {
    getAddress,
    parseGwei,
    parseTransaction,
    serializeTransaction,
    toHex,
    type RpcFeeHistory,
} from 'viem'
import type { ReviewContext } from '@perawallet/wallet-core-chain-contract'
import { getOpenSubmissionAttempts } from '@perawallet/wallet-core-signing'
import { EvmErrorCode, isEvmError } from '../../blockchain/errors'
import {
    EvmRpcErrorFixture,
    evmRpcHandlers,
    type EvmRpcFixtures,
} from '../../blockchain/msw-handlers'
import { evmCapabilityDefaults as ethereumCapabilityDefaults } from '../../capability-defaults'
import {
    readEvmTransaction,
    type EthereumTransactionPayload,
} from '../../signing/adapter'
import { createEthereumReviewer, ethereumViewOf } from '../../signing/review'
import { ETHEREUM, POLYGON } from '../../__tests__/evm-chains'
import { TEST_RPC_URL, testChainContext } from '../../__tests__/context'
import {
    buildEthereumSendTransaction,
    validateEthereumSendTransaction,
    type EthereumSendTransactionRequest,
} from '../sendTransaction'

const ethereumReviewerAdapter = createEthereumReviewer({ chain: ETHEREUM })

// The empty pool by default, so the node's pending count decides the nonce.
vi.mock('@perawallet/wallet-core-signing', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-signing')
    >()),
    getOpenSubmissionAttempts: vi.fn(async () => []),
}))

const FROM = getAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')
const TO = getAddress('0x2c7536E3605D9C16a7a3D7b1898e529396a65c23')
const STORAGE_KEY = `0x${'11'.repeat(32)}` as const
const session = { authorizedAccounts: [FROM], eip155ChainId: 1 }

const validate = (params: unknown, own = session) =>
    validateEthereumSendTransaction(params, own)

const ok = { from: FROM, to: TO }

describe('validateEthereumSendTransaction', () => {
    it('refuses params that are not an object', () => {
        expect(validate([ok])).toMatchObject({
            ok: false,
            failure: 'invalid-params',
        })
        expect(validate(undefined)).toMatchObject({ ok: false })
    })

    it('refuses a from the session does not hold as an unauthorized account', () => {
        expect(validate({ ...ok, from: TO })).toMatchObject({
            ok: false,
            failure: 'unauthorized-account',
        })
        expect(validate({ to: TO })).toMatchObject({
            ok: false,
            failure: 'unauthorized-account',
        })
        expect(validate({ ...ok, from: 'nope' })).toMatchObject({
            ok: false,
            failure: 'unauthorized-account',
        })
    })

    it('accepts a from in another case than the session account', () => {
        const result = validate(
            { ...ok, from: FROM.toLowerCase() },
            {
                ...session,
                authorizedAccounts: [FROM.toUpperCase().replace('0X', '0x')],
            },
        )

        expect(result).toMatchObject({ ok: true, request: { from: FROM } })
    })

    it('refuses a chainId other than the active chain, and accepts the active one or none', () => {
        expect(validate({ ...ok, chainId: '0xaa36a7' })).toMatchObject({
            ok: false,
            failure: 'invalid-params',
        })
        expect(validate({ ...ok, chainId: 1 })).toMatchObject({ ok: false })
        expect(validate({ ...ok, chainId: '0x1' })).toMatchObject({ ok: true })
        expect(validate(ok)).toMatchObject({ ok: true })
    })

    it('refuses a chainId when the active network has no EIP-155 id', () => {
        expect(
            validate(
                { ...ok, chainId: '0x1' },
                { ...session, eip155ChainId: undefined },
            ),
        ).toMatchObject({ ok: false, failure: 'invalid-params' })
    })

    it('uses to, value and data as given', () => {
        expect(
            validate({ ...ok, value: '0xde0b6b3a7640000', data: '0xa9059cbb' }),
        ).toEqual({
            ok: true,
            request: {
                from: FROM,
                to: TO,
                value: 10n ** 18n,
                data: '0xa9059cbb',
            },
        })
    })

    it('defaults an absent value to zero and absent data to empty', () => {
        expect(validate(ok)).toEqual({
            ok: true,
            request: { from: FROM, to: TO, value: 0n, data: '0x' },
        })
    })

    it.each([
        ['absent', {}],
        ['null', { to: null }],
        ['not an address', { to: '0x123' }],
    ])(
        'refuses a transaction whose to is %s, since a deployment has no review',
        (_, fields) => {
            expect(validate({ from: FROM, ...fields })).toMatchObject({
                ok: false,
                failure: 'invalid-params',
            })
        },
    )

    it.each([
        ['a decimal number', 5],
        ['not hex', 'ten'],
        ['above uint256', `0x1${'0'.repeat(64)}`],
    ])('refuses a value that is %s', (_, value) => {
        expect(validate({ ...ok, value })).toMatchObject({
            ok: false,
            failure: 'invalid-params',
        })
    })

    it('refuses odd-length or non-hex data', () => {
        expect(validate({ ...ok, data: '0xabc' })).toMatchObject({ ok: false })
        expect(validate({ ...ok, data: 'abcd' })).toMatchObject({ ok: false })
    })

    it('reads input when data is absent, and refuses the two disagreeing', () => {
        expect(validate({ ...ok, input: '0xabcd' })).toMatchObject({
            ok: true,
            request: { data: '0xabcd' },
        })
        expect(
            validate({ ...ok, data: '0xABCD', input: '0xabcd' }),
        ).toMatchObject({ ok: true })
        expect(
            validate({ ...ok, data: '0xabcd', input: '0xabce' }),
        ).toMatchObject({ ok: false, failure: 'invalid-params' })
    })

    it('keeps a gas the dApp gave, and refuses zero or malformed gas', () => {
        expect(validate({ ...ok, gas: '0x30d40' })).toMatchObject({
            ok: true,
            request: { gas: 200_000n },
        })
        expect(validate({ ...ok, gas: '0x0' })).toMatchObject({ ok: false })
        expect(validate({ ...ok, gas: 21000 })).toMatchObject({ ok: false })
    })

    it('drops a nonce', () => {
        const result = validate({ ...ok, nonce: '0x99' })

        expect(result).toMatchObject({ ok: true })
        expect(result.ok && result.request).not.toHaveProperty('nonce')
    })

    it.each([undefined, '0x2', '0x0', '0x1', '0x02'])(
        'accepts type %s, all built as EIP-1559',
        type => {
            expect(validate({ ...ok, type })).toMatchObject({ ok: true })
        },
    )

    it('keeps the EIP-1559 fee fields the dApp gave', () => {
        const result = validate({
            ...ok,
            maxFeePerGas: '0x77359400',
            maxPriorityFeePerGas: '0x3b9aca00',
        })

        expect(result).toMatchObject({
            ok: true,
            request: {
                maxFeePerGas: 2_000_000_000n,
                maxPriorityFeePerGas: 1_000_000_000n,
            },
        })
    })

    it('reads a legacy gasPrice as both fee fields', () => {
        const result = validate({ ...ok, type: '0x0', gasPrice: '0x3b9aca00' })

        expect(result).toMatchObject({
            ok: true,
            request: {
                maxFeePerGas: 1_000_000_000n,
                maxPriorityFeePerGas: 1_000_000_000n,
            },
        })
        expect(result.ok && result.request).not.toHaveProperty('gasPrice')
    })

    it('carries no fee field when the dApp gave none', () => {
        const result = validate(ok)

        expect(result.ok && result.request).not.toHaveProperty('maxFeePerGas')
        expect(result.ok && result.request).not.toHaveProperty(
            'maxPriorityFeePerGas',
        )
    })

    it.each([
        ['maxFeePerGas', 5],
        ['maxPriorityFeePerGas', 'ten'],
        ['gasPrice', `0x1${'0'.repeat(64)}`],
    ])('refuses a %s that is not a valid quantity', (field, value) => {
        expect(validate({ ...ok, [field]: value })).toMatchObject({
            ok: false,
            failure: 'invalid-params',
        })
    })

    it.each(['maxFeePerGas', 'maxPriorityFeePerGas'])(
        'refuses gasPrice together with %s',
        field => {
            expect(
                validate({ ...ok, gasPrice: '0x1', [field]: '0x1' }),
            ).toMatchObject({ ok: false, failure: 'invalid-params' })
        },
    )

    it('keeps a well-formed accessList and refuses a malformed one', () => {
        const accessList = [{ address: TO, storageKeys: [STORAGE_KEY] }]

        expect(validate({ ...ok, accessList })).toMatchObject({
            ok: true,
            request: { accessList },
        })
        expect(validate({ ...ok, accessList: 'x' })).toMatchObject({
            ok: false,
        })
        expect(
            validate({
                ...ok,
                accessList: [{ address: TO, storageKeys: ['0x01'] }],
            }),
        ).toMatchObject({ ok: false })
        expect(
            validate({
                ...ok,
                accessList: [{ address: 'nope', storageKeys: [] }],
            }),
        ).toMatchObject({ ok: false })
    })

    it.each([
        ['type 0x3', { type: '0x3' }],
        ['blobVersionedHashes', { blobVersionedHashes: [STORAGE_KEY] }],
        ['maxFeePerBlobGas', { maxFeePerBlobGas: '0x1' }],
        ['blobs', { blobs: ['0x00'] }],
    ])('refuses EIP-4844 blob fields: %s', (_, fields) => {
        expect(validate({ ...ok, ...fields })).toMatchObject({
            ok: false,
            failure: 'invalid-params',
        })
    })

    it.each([
        ['type 0x4', { type: '0x4' }],
        ['an authorizationList', { authorizationList: [] }],
    ])('refuses EIP-7702 delegation: %s', (_, fields) => {
        expect(validate({ ...ok, ...fields })).toMatchObject({
            ok: false,
            failure: 'invalid-params',
        })
    })

    it.each(['0x5', 'two', 2, '0x'])('refuses any other type: %s', type => {
        expect(validate({ ...ok, type })).toMatchObject({
            ok: false,
            failure: 'invalid-params',
        })
    })
})

const feeHistory = (): RpcFeeHistory => ({
    oldestBlock: '0x1',
    baseFeePerGas: [toHex(parseGwei('1')), toHex(parseGwei('2'))],
    gasUsedRatio: [0.5],
    reward: [
        [parseGwei('0.5'), parseGwei('1'), parseGwei('2')].map(tip =>
            toHex(tip),
        ),
    ],
})

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ctx = testChainContext()

const useRpc = (responses: NonNullable<EvmRpcFixtures['responses']> = {}) =>
    server.use(
        ...evmRpcHandlers({
            rpcUrl: TEST_RPC_URL,
            responses: {
                eth_getTransactionCount: '0x4',
                eth_feeHistory: feeHistory(),
                ...responses,
            },
        }),
    )

const request = (
    fields: Partial<EthereumSendTransactionRequest> = {},
): EthereumSendTransactionRequest => ({
    from: FROM,
    to: TO,
    value: 10n ** 18n,
    data: '0x',
    ...fields,
})

const payloadOf = (built: { payload: unknown }) =>
    (built.payload as EthereumTransactionPayload).transaction

describe('buildEthereumSendTransaction', () => {
    beforeEach(() => {
        vi.mocked(getOpenSubmissionAttempts).mockResolvedValue([])
    })

    it('builds an EIP-1559 transaction on the context network with the normal fee preset', async () => {
        useRpc()

        const built = await buildEthereumSendTransaction(
            ctx,
            ETHEREUM,
            request(),
        )

        expect(built.scope).toEqual({
            chainId: 'ethereum',
            networkId: 'mainnet',
        })
        expect(built.chainData).toEqual({ family: 'evm' })
        expect(built.payload).toEqual({
            from: FROM,
            transaction: {
                type: 'eip1559',
                chainId: 1,
                nonce: 4,
                to: TO,
                value: 10n ** 18n,
                data: '0x',
                gas: 21_000n,
                maxFeePerGas: parseGwei('5'),
                maxPriorityFeePerGas: parseGwei('1'),
            },
        })
    })

    it("takes the broadcaster's nonce, never one the dApp chose", async () => {
        useRpc()
        const dappRequest = {
            ...request(),
            nonce: '0x99',
        } as EthereumSendTransactionRequest

        const built = await buildEthereumSendTransaction(
            ctx,
            ETHEREUM,
            dappRequest,
        )

        expect(payloadOf(built).nonce).toBe(4)
    })

    it('signs the padded estimate when the dApp gave less gas', async () => {
        const estimates = vi.fn(() => '0xfde8' as const)
        useRpc({ eth_estimateGas: estimates })

        const built = await buildEthereumSendTransaction(
            ctx,
            ETHEREUM,
            request({ data: '0xa9059cbb', gas: 30_000n }),
        )

        expect(estimates).toHaveBeenCalled()
        expect(payloadOf(built).gas).toBe(78_000n)
    })

    it('signs the dApp gas when it exceeds the padded estimate', async () => {
        useRpc({ eth_estimateGas: '0xfde8' })

        const built = await buildEthereumSendTransaction(
            ctx,
            ETHEREUM,
            request({ data: '0xa9059cbb', gas: 300_000n }),
        )

        expect(payloadOf(built).gas).toBe(300_000n)
    })

    it('estimates the gas when the dApp gave none', async () => {
        useRpc({ eth_estimateGas: '0xfde8' })

        const built = await buildEthereumSendTransaction(
            ctx,
            ETHEREUM,
            request(),
        )

        expect(payloadOf(built).gas).toBe(78_000n)
    })

    it('pads a call with calldata, and a send to a recipient that ran code, but not a send to an account with no code', async () => {
        useRpc({ eth_estimateGas: '0xfde8' })
        const call = await buildEthereumSendTransaction(
            ctx,
            ETHEREUM,
            request({ value: 0n, data: '0xa9059cbb' }),
        )
        const toContract = await buildEthereumSendTransaction(
            ctx,
            ETHEREUM,
            request(),
        )
        useRpc()
        const toAccount = await buildEthereumSendTransaction(
            ctx,
            ETHEREUM,
            request(),
        )

        expect(payloadOf(call).gas).toBe(78_000n)
        expect(payloadOf(toContract).gas).toBe(78_000n)
        expect(payloadOf(toAccount).gas).toBe(21_000n)
    })

    it("signs the dApp's fees when they exceed the normal preset", async () => {
        useRpc()

        const built = await buildEthereumSendTransaction(
            ctx,
            ETHEREUM,
            request({
                maxFeePerGas: parseGwei('8'),
                maxPriorityFeePerGas: parseGwei('3'),
            }),
        )

        expect(payloadOf(built)).toMatchObject({
            maxFeePerGas: parseGwei('8'),
            maxPriorityFeePerGas: parseGwei('3'),
        })
    })

    it("signs the wallet's own fees where the dApp asked for less", async () => {
        useRpc()

        const built = await buildEthereumSendTransaction(
            ctx,
            ETHEREUM,
            request({
                maxFeePerGas: parseGwei('1'),
                maxPriorityFeePerGas: parseGwei('0.1'),
            }),
        )

        expect(payloadOf(built)).toMatchObject({
            maxFeePerGas: parseGwei('5'),
            maxPriorityFeePerGas: parseGwei('1'),
        })
    })

    it('prices a legacy gasPrice request at the higher of that price and the presets', async () => {
        useRpc()
        const params = validate({
            ...ok,
            type: '0x0',
            gasPrice: '0xffffffffff',
        })
        if (!params.ok) throw new Error('expected the request to validate')

        const built = await buildEthereumSendTransaction(
            ctx,
            ETHEREUM,
            params.request,
        )

        expect(payloadOf(built)).toMatchObject({
            type: 'eip1559',
            // Exactly the price the dApp named: its tip is what that leaves above the 2 gwei base fee.
            maxFeePerGas: 0xff_ffff_ffffn,
            maxPriorityFeePerGas: 0xff_ffff_ffffn - parseGwei('2'),
        })
    })

    it('charges a legacy gasPrice near the market price that price, and no more', async () => {
        useRpc()
        const params = validate({ ...ok, type: '0x0', gasPrice: '0xb2d05e00' })
        if (!params.ok) throw new Error('expected the request to validate')

        const built = await buildEthereumSendTransaction(
            ctx,
            ETHEREUM,
            params.request,
        )

        // 3 gwei against a 2 gwei base fee: a 1 gwei tip, under the 5 gwei cap.
        expect(payloadOf(built)).toMatchObject({
            maxFeePerGas: parseGwei('5'),
            maxPriorityFeePerGas: parseGwei('1'),
        })
    })

    it('flags a dApp gas limit far above the estimate for review', async () => {
        useRpc()

        const built = await buildEthereumSendTransaction(
            ctx,
            ETHEREUM,
            request({ gas: 10_000_000n }),
        )
        const view = ethereumViewOf(built, ETHEREUM)

        expect(built.payload).toMatchObject({ hasHighFee: true })
        expect(view).toMatchObject({ hasHighFee: true })
    })

    it('flags a legacy gasPrice just under twice the preset max fee, which would still cost several times the normal price', async () => {
        useRpc()
        const params = validate({
            ...ok,
            type: '0x0',
            gasPrice: toHex(parseGwei('9.5')),
        })
        if (!params.ok) throw new Error('expected the request to validate')

        const built = await buildEthereumSendTransaction(
            ctx,
            ETHEREUM,
            params.request,
        )

        // 9.5 gwei against a 3 gwei normal price: under twice the 5 gwei cap, over three times the cost.
        expect(payloadOf(built).maxFeePerGas).toBe(parseGwei('9.5'))
        expect(built.payload).toMatchObject({ hasHighFee: true })
    })

    it('flags dApp fees far above the preset for review', async () => {
        useRpc()

        const built = await buildEthereumSendTransaction(
            ctx,
            ETHEREUM,
            request({ maxFeePerGas: parseGwei('500') }),
        )

        expect(built.payload).toMatchObject({ hasHighFee: true })
    })

    it("flags nothing on a request at the wallet's own pricing, or one modestly above it", async () => {
        useRpc({ eth_estimateGas: '0xfde8' })

        const own = await buildEthereumSendTransaction(
            ctx,
            ETHEREUM,
            request({ data: '0xa9059cbb' }),
        )
        const modest = await buildEthereumSendTransaction(
            ctx,
            ETHEREUM,
            request({
                data: '0xa9059cbb',
                gas: 80_000n,
                maxFeePerGas: parseGwei('8'),
            }),
        )

        expect(own.payload).not.toHaveProperty('hasHighFee')
        expect(modest.payload).not.toHaveProperty('hasHighFee')
        expect(ethereumViewOf(own, ETHEREUM)).not.toHaveProperty('hasHighFee')
    })

    it('carries the accessList into the serialised transaction', async () => {
        useRpc()
        const accessList = [{ address: TO, storageKeys: [STORAGE_KEY] }]

        const built = await buildEthereumSendTransaction(
            ctx,
            ETHEREUM,
            request({ accessList }),
        )
        const { from, transaction } = readEvmTransaction(built, ETHEREUM)
        const parsed = parseTransaction(serializeTransaction(transaction))

        expect(from).toBe(FROM)
        expect(parsed).toMatchObject({
            accessList: [
                { address: TO.toLowerCase(), storageKeys: [STORAGE_KEY] },
            ],
        })
    })

    it('builds a transaction the reviewer decodes: empty data is a transfer', async () => {
        useRpc()

        const built = await buildEthereumSendTransaction(
            ctx,
            ETHEREUM,
            request(),
        )
        const decoded = await ethereumReviewerAdapter.decoder.decode(
            [built],
            reviewContext,
        )

        expect(decoded.signableAddresses).toEqual([FROM])
        expect(decoded.transactions[0].summary.kind).toBe('transfer')
        expect(decoded.transactions[0].summary).toEqual(built.summary)
    })

    it('builds a transaction the reviewer warns about: calldata is an unknown contract call', async () => {
        useRpc({ eth_estimateGas: '0xfde8' })

        const built = await buildEthereumSendTransaction(
            ctx,
            ETHEREUM,
            request({ value: 0n, data: '0xa9059cbb' }),
        )
        const decoded = await ethereumReviewerAdapter.decoder.decode(
            [built],
            reviewContext,
        )
        const warnings = ethereumReviewerAdapter.warnings.detect(
            [built],
            decoded,
            reviewContext,
        )

        expect(decoded.transactions[0].summary.kind).toBe('contract-call')
        expect(built.summary.kind).toBe('contract-call')
        expect(warnings).toEqual([
            expect.objectContaining({ type: 'unknown-contract' }),
        ])
    })

    it("refuses a call the node says would revert, even when the dApp gave its own gas, with the revert's reason", async () => {
        useRpc({
            eth_estimateGas: new EvmRpcErrorFixture(
                3,
                'execution reverted: ERC20: transfer amount exceeds balance',
            ),
        })

        const error = await buildEthereumSendTransaction(
            ctx,
            ETHEREUM,
            request({ data: '0xa9059cbb', gas: 500_000n }),
        ).catch((e: unknown) => e)

        expect(error).toMatchObject({
            code: EvmErrorCode.REVERTED_WITH_REASON,
            params: { reason: 'ERC20: transfer amount exceeds balance' },
        })
    })

    it('rejects with an EvmError when the node reverts the estimate', async () => {
        useRpc({
            eth_estimateGas: new EvmRpcErrorFixture(3, 'execution reverted'),
        })

        const error = await buildEthereumSendTransaction(
            ctx,
            ETHEREUM,
            request({ data: '0xa9059cbb' }),
        ).catch((e: unknown) => e)

        expect(isEvmError(error)).toBe(true)
    })

    it('rejects with an insufficient-funds EvmError when the sender cannot cover gas', async () => {
        useRpc({
            eth_estimateGas: new EvmRpcErrorFixture(
                -32000,
                'insufficient funds for gas * price + value',
            ),
        })

        const error = await buildEthereumSendTransaction(
            ctx,
            ETHEREUM,
            request(),
        ).catch((e: unknown) => e)

        expect(error).toMatchObject({ code: EvmErrorCode.INSUFFICIENT_FUNDS })
    })
})

const reviewContext: ReviewContext = {
    scope: { chainId: 'ethereum', networkId: 'mainnet' },
    heldAddresses: [FROM],
    isWalletBuilt: false,
    capabilities: ethereumCapabilityDefaults,
}

describe('buildEthereumSendTransaction on Polygon', () => {
    beforeEach(() => {
        vi.mocked(getOpenSubmissionAttempts).mockResolvedValue([])
    })

    it("raises the dApp send's tip to the network minimum", async () => {
        useRpc()

        const built = await buildEthereumSendTransaction(
            testChainContext({ chain: POLYGON }),
            POLYGON,
            request(),
        )

        expect(built.scope).toEqual({
            chainId: 'polygon',
            networkId: 'mainnet',
        })
        expect(payloadOf(built).chainId).toBe(137)
        expect(payloadOf(built).maxPriorityFeePerGas).toBe(25_000_000_000n)
    })
})
