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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { InFlightSpend } from '@perawallet/wallet-core-transactions'

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

import { readEthereumSpendableBalance } from '../spendable-balance'

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
            asset: typeof ETH | typeof TOKEN,
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
                    // Lowercased, as a decoded dApp request may spell it.
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
