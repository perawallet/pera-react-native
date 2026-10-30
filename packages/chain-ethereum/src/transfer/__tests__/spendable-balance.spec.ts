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
import { Decimal } from 'decimal.js'
import { setupServer } from 'msw/node'
import { hexToBytes, keccak256, parseTransaction } from 'viem'
import type { TransactionSerializableEIP1559 } from 'viem'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    getInFlightSpends,
    type InFlightSpend,
} from '@perawallet/wallet-core-transactions'
import {
    initializeDatabase,
    resetDatabase,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'

const mocks = vi.hoisted(() => ({
    getAccountChainStateRow: vi.fn(),
    getAccountHoldings: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    ...mocks,
}))

import { createEvmSpendableBalance } from '../spendable-balance'
import { createEvmBroadcasterAdapter } from '../broadcaster'
import { evmRpcHandlers } from '../../blockchain/msw-handlers'
import { TEST_RPC_URL, testChainContext } from '../../__tests__/context'
import { BASE, ETHEREUM, evmScopeOf } from '../../__tests__/evm-chains'
import {
    SENDER as SIGNER,
    VIEM_TRANSFER_NONCE_0,
} from '../../signing/__tests__/fixtures'
import { opStackOracleResponder, unsignedEncodingOf } from './op-stack-oracle'

const readEthereumSpendableBalance = createEvmSpendableBalance(ETHEREUM)

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const SENDER = '0x00000000000000000000000000000000000000aa'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const ACCOUNT: WalletAccount = {
    id: 'sender',
    custody: { kind: 'watch' },
    chains: { ethereum: { address: SENDER } },
}

describe('readEthereumSpendableBalance', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('offers the whole token holding, since gas is paid in ether', async () => {
        mocks.getAccountHoldings.mockResolvedValue([
            { assetId: USDC, amount: new Decimal(250), native: null },
        ])

        const result = await readEthereumSpendableBalance({
            account: ACCOUNT,
            asset: { chainId: 'ethereum', assetId: USDC },
            scope: SCOPE,
            fee: new Decimal(21_000),
        })

        expect(result).toEqual({
            balance: new Decimal(250),
            max: new Decimal(250),
            reserved: new Decimal(0),
        })
    })

    it('never offers a negative amount of ether when the fee exceeds the balance', async () => {
        mocks.getAccountChainStateRow.mockResolvedValue({
            accountAddress: SENDER,
            nativeBalance: new Decimal(10),
            chainData: { family: 'evm', nonce: { latest: 0, pending: 0 } },
        })

        const result = await readEthereumSpendableBalance({
            account: ACCOUNT,
            asset: { chainId: 'ethereum', assetId: 'native' },
            scope: SCOPE,
            fee: new Decimal(21_000),
        })

        expect(result.max).toEqual(new Decimal(0))
    })

    describe('with open sends', () => {
        const ETH = { chainId: 'ethereum', assetId: 'native' } as const
        const TOKEN = { chainId: 'ethereum', assetId: USDC } as const
        const NFT = {
            chainId: 'ethereum',
            assetId: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D/7',
        } as const
        const FEE = new Decimal(21)

        const givenNativeBalance = (amount: number, latestNonce = 0) => {
            mocks.getAccountChainStateRow.mockResolvedValue({
                accountAddress: SENDER,
                nativeBalance: new Decimal(amount),
                chainData: {
                    family: 'evm',
                    nonce: { latest: latestNonce, pending: latestNonce },
                },
            })
        }

        const read = (
            asset: typeof ETH | typeof TOKEN | typeof NFT,
            inFlight: InFlightSpend[],
        ) =>
            readEthereumSpendableBalance({
                account: ACCOUNT,
                asset,
                scope: SCOPE,
                fee: FEE,
                inFlight,
            })

        it("holds back an open ether send's value and max fee", async () => {
            givenNativeBalance(1000)

            const result = await read(ETH, [
                {
                    nonce: 0,
                    outflows: [{ assetRef: ETH, value: new Decimal(100) }],
                    maxFee: new Decimal(30),
                },
            ])

            expect(result).toEqual({
                balance: new Decimal(1000),
                max: new Decimal(849),
                reserved: new Decimal(130),
            })
        })

        it("holds back an open token send's amount from the token and its gas from ether", async () => {
            givenNativeBalance(1000)
            mocks.getAccountHoldings.mockResolvedValue([
                { assetId: USDC, amount: new Decimal(250), native: null },
            ])
            const inFlight: InFlightSpend[] = [
                {
                    nonce: 0,
                    outflows: [
                        {
                            assetRef: { ...TOKEN, assetId: USDC.toLowerCase() },
                            value: new Decimal(40),
                        },
                    ],
                    maxFee: new Decimal(30),
                },
            ]

            const token = await read(TOKEN, inFlight)
            const ether = await read(ETH, inFlight)

            expect(token).toEqual({
                balance: new Decimal(250),
                max: new Decimal(210),
                reserved: new Decimal(40),
            })
            expect(ether.max).toEqual(new Decimal(949))
        })

        it("holds back an open NFT send's quantity from that NFT's holding", async () => {
            givenNativeBalance(1000)
            mocks.getAccountHoldings.mockResolvedValue([
                { assetId: NFT.assetId, amount: new Decimal(3), native: null },
            ])

            const result = await read(NFT, [
                {
                    nonce: 0,
                    outflows: [{ assetRef: NFT, value: new Decimal(2) }],
                    maxFee: new Decimal(30),
                },
            ])

            expect(result).toEqual({
                balance: new Decimal(3),
                max: new Decimal(1),
                reserved: new Decimal(2),
            })
        })

        it('matches the holding and the open send to the token whatever their casing', async () => {
            givenNativeBalance(1000)
            mocks.getAccountHoldings.mockResolvedValue([
                {
                    assetId: USDC.toLowerCase(),
                    amount: new Decimal(250),
                    native: null,
                },
            ])

            const result = await read(TOKEN, [
                {
                    nonce: 0,
                    outflows: [
                        {
                            assetRef: { ...TOKEN, assetId: USDC.toUpperCase() },
                            value: new Decimal(40),
                        },
                    ],
                },
            ])

            expect(result).toEqual({
                balance: new Decimal(250),
                max: new Decimal(210),
                reserved: new Decimal(40),
            })
        })

        it('does not hold back a send mined in the block the balance was read at', async () => {
            givenNativeBalance(1000, 5)

            const result = await read(ETH, [
                {
                    nonce: 4,
                    outflows: [{ assetRef: ETH, value: new Decimal(100) }],
                    maxFee: new Decimal(30),
                },
                {
                    nonce: 5,
                    outflows: [{ assetRef: ETH, value: new Decimal(200) }],
                    maxFee: new Decimal(30),
                },
            ])

            expect(result.reserved).toEqual(new Decimal(230))
        })

        it('holds back only the fee of a send with no summary, and nothing when the fee is unknown', async () => {
            givenNativeBalance(1000)

            const withFee = await read(ETH, [
                { nonce: 0, outflows: [], maxFee: new Decimal(30) },
            ])
            const withoutFee = await read(ETH, [{ nonce: 1, outflows: [] }])

            expect(withFee.reserved).toEqual(new Decimal(30))
            expect(withoutFee.reserved).toEqual(new Decimal(0))
        })

        it('never offers a negative amount when open sends spend more than the balance', async () => {
            givenNativeBalance(100)

            const result = await read(ETH, [
                {
                    nonce: 0,
                    outflows: [{ assetRef: ETH, value: new Decimal(100) }],
                    maxFee: new Decimal(30),
                },
            ])

            expect(result.max).toEqual(new Decimal(0))
        })
    })
})

describe('with an open Base send', () => {
    const BASE_SCOPE = evmScopeOf(BASE)
    const BASE_ACCOUNT: WalletAccount = {
        id: 'sender',
        custody: { kind: 'watch' },
        chains: { base: { address: SIGNER } },
    }
    const SEND_VALUE = 10n ** 18n
    const GAS_FEE = 420_000_000_000_000n
    const L1_FEE = 5_000_000_000n
    const OPERATOR_FEE = 7_000n
    const NEXT_FEE = new Decimal(1_000_000)
    const BALANCE = new Decimal((5n * 10n ** 18n).toString())

    const server = setupServer()
    let db: Database
    let teardown: () => void

    beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
    afterAll(() => server.close())

    beforeEach(async () => {
        vi.clearAllMocks()
        const result = createTestDatabase()
        db = result.db
        teardown = result.teardown
        await initializeDatabase({
            getDatabase: async () => db,
        } as unknown as Parameters<typeof initializeDatabase>[0])
        server.use(
            ...evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: {
                    eth_call: opStackOracleResponder({
                        l1Fees: new Map([
                            [
                                unsignedEncodingOf(
                                    parseTransaction(
                                        VIEM_TRANSFER_NONCE_0,
                                    ) as TransactionSerializableEIP1559,
                                ),
                                L1_FEE,
                            ],
                        ]),
                        operatorFee: OPERATOR_FEE,
                    }),
                },
            }),
        )
    })

    afterEach(() => {
        server.resetHandlers()
        resetDatabase()
        teardown()
    })

    const givenBalanceAt = (latestNonce: number) => {
        mocks.getAccountChainStateRow.mockResolvedValue({
            accountAddress: SIGNER,
            nativeBalance: BALANCE,
            chainData: {
                family: 'evm',
                nonce: { latest: latestNonce, pending: latestNonce },
            },
        })
    }

    const submitOpenSend = () =>
        createEvmBroadcasterAdapter(
            testChainContext({ chain: BASE }),
            BASE,
        ).submitAndAutoRefresh(BASE_SCOPE, [
            {
                scope: BASE_SCOPE,
                id: keccak256(VIEM_TRANSFER_NONCE_0),
                bytes: hexToBytes(VIEM_TRANSFER_NONCE_0),
            },
        ])

    const readNextSend = async () =>
        createEvmSpendableBalance(BASE)({
            account: BASE_ACCOUNT,
            asset: { chainId: 'base', assetId: 'native' },
            scope: BASE_SCOPE,
            fee: NEXT_FEE,
            inFlight: await getInFlightSpends({
                address: SIGNER,
                scope: BASE_SCOPE,
            }),
        })

    it("leaves room on MAX for the open send's value, gas and L1 fee, and for the next send's fee", async () => {
        givenBalanceAt(0)
        await submitOpenSend()

        const result = await readNextSend()

        const reserved = new Decimal(
            (SEND_VALUE + GAS_FEE + L1_FEE + OPERATOR_FEE).toString(),
        )
        expect(result.reserved).toEqual(reserved)
        expect(result.max).toEqual(BALANCE.sub(reserved).sub(NEXT_FEE))
    })

    it('holds nothing back once the synced nonce has passed the send', async () => {
        givenBalanceAt(1)
        await submitOpenSend()

        const result = await readNextSend()

        expect(result.reserved).toEqual(new Decimal(0))
        expect(result.max).toEqual(BALANCE.sub(NEXT_FEE))
    })
})
