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
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'

const mocks = vi.hoisted(() => {
    const calls: Array<[string, Record<string, unknown>]> = []
    const composer = {
        addPayment: vi.fn(),
        addAssetTransfer: vi.fn(),
        addAssetOptIn: vi.fn(),
        build: vi.fn(),
    }
    return {
        calls,
        composer,
        payment: vi.fn(),
        offlineKeyRegistration: vi.fn(),
        onlineKeyRegistration: vi.fn(),
        createWalletAlgorandClient: vi.fn(),
    }
})

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-blockchain')
    >()),
    createWalletAlgorandClient: mocks.createWalletAlgorandClient,
}))

import {
    buildExpressTransferTxs,
    buildKeyRegistrationTx,
    buildOptInTxs,
    buildOptOutTxs,
    buildRekeyTx,
    buildTransferTxs,
} from '../builders'

const scope = scopeForLegacyNetwork('testnet')
const TXNS = [{ id: 'one' }, { id: 'two' }]

// Every composer call is recorded in order so group layout can be asserted.
const record = (name: string) =>
    vi.fn((params: Record<string, unknown>) => {
        mocks.calls.push([name, params])
        return mocks.composer
    })

const micro = (value: unknown) => (value as { microAlgos: bigint }).microAlgos

describe('Algorand transaction builders', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.calls.length = 0
        mocks.composer.addPayment.mockImplementation(record('payment'))
        mocks.composer.addAssetTransfer.mockImplementation(record('transfer'))
        mocks.composer.addAssetOptIn.mockImplementation(record('optIn'))
        mocks.composer.build.mockResolvedValue({
            transactions: TXNS.map(txn => ({ txn })),
        })
        mocks.createWalletAlgorandClient.mockReturnValue({
            newGroup: () => mocks.composer,
            createTransaction: {
                payment: mocks.payment,
                offlineKeyRegistration: mocks.offlineKeyRegistration,
                onlineKeyRegistration: mocks.onlineKeyRegistration,
            },
        })
    })

    it("builds against the scope's network client", async () => {
        await buildOptInTxs({ scope, sender: 'S', assetId: 1n })

        expect(mocks.createWalletAlgorandClient).toHaveBeenCalledWith('testnet')
    })

    describe('buildTransferTxs', () => {
        const base = { scope, sender: 'S', receiver: 'R', amount: 5n }

        it('sends ALGO as a payment carrying the note and no fee key by default', async () => {
            const result = await buildTransferTxs({
                ...base,
                assetId: '0',
                note: 'hi',
            })

            expect(result).toEqual(TXNS)
            const [name, params] = mocks.calls[0]
            expect(name).toBe('payment')
            expect(params).toMatchObject({
                sender: 'S',
                receiver: 'R',
                note: 'hi',
            })
            expect(micro(params.amount)).toBe(5n)
            expect(params).not.toHaveProperty('staticFee')
            expect(params).not.toHaveProperty('closeRemainderTo')
        })

        it('sweeps the balance with a zero-amount payment when closing the account', async () => {
            await buildTransferTxs({
                ...base,
                assetId: '0',
                isCloseAccount: true,
            })

            const [, params] = mocks.calls[0]
            expect(params).toMatchObject({ closeRemainderTo: 'R' })
            expect(micro(params.amount)).toBe(0n)
        })

        it('sends a token as an asset transfer', async () => {
            await buildTransferTxs({ ...base, assetId: '99' })

            const [name, params] = mocks.calls[0]
            expect(name).toBe('transfer')
            expect(params).toMatchObject({ assetId: 99n, amount: 5n })
        })

        it('forces the fee only when the caller passes one', async () => {
            await buildTransferTxs({ ...base, assetId: '0', fee: 3000n })

            expect(micro(mocks.calls[0][1].staticFee)).toBe(3000n)
        })
    })

    describe('buildExpressTransferTxs', () => {
        const base = {
            scope,
            sender: 'S',
            receiver: 'R',
            assetId: 99n,
            amount: 5n,
        }

        it('funds the receiver, opts it in, then transfers', async () => {
            await buildExpressTransferTxs({ ...base, funding: 201000n })

            expect(mocks.calls.map(([name]) => name)).toEqual([
                'payment',
                'optIn',
                'transfer',
            ])
            expect(micro(mocks.calls[0][1].amount)).toBe(201000n)
            expect(mocks.calls[1][1]).toMatchObject({
                sender: 'R',
                assetId: 99n,
            })
        })

        it('skips the funding payment when nothing is needed', async () => {
            await buildExpressTransferTxs({ ...base, funding: 0n })

            expect(mocks.calls.map(([name]) => name)).toEqual([
                'optIn',
                'transfer',
            ])
        })

        it('applies each party its own fee override', async () => {
            await buildExpressTransferTxs({
                ...base,
                funding: 1n,
                senderFee: 3000n,
                receiverFee: undefined,
            })

            const [payment, optIn, transfer] = mocks.calls.map(([, p]) => p)
            expect(micro(payment.staticFee)).toBe(3000n)
            expect(optIn).not.toHaveProperty('staticFee')
            expect(micro(transfer.staticFee)).toBe(3000n)
        })
    })

    it('opts out of every asset in one group, closing each holding to its creator', async () => {
        await buildOptOutTxs({
            scope,
            optOuts: [
                { sender: 'S', assetId: 1n, creator: 'C1' },
                { sender: 'S', assetId: 2n, creator: 'C2' },
            ],
        })

        expect(mocks.calls.map(([, p]) => p)).toEqual([
            {
                sender: 'S',
                receiver: 'S',
                assetId: 1n,
                amount: 0n,
                closeAssetTo: 'C1',
            },
            {
                sender: 'S',
                receiver: 'S',
                assetId: 2n,
                amount: 0n,
                closeAssetTo: 'C2',
            },
        ])
    })

    describe('buildRekeyTx', () => {
        const params = {
            scope,
            sourceAddress: 'SRC',
            rekeyToAddress: 'TGT',
        }

        it('keeps the auto-sized transaction when it already pays the minimum', async () => {
            const draft = { id: 'draft', fee: 2000n }
            mocks.payment.mockResolvedValueOnce(draft)

            const result = await buildRekeyTx({ ...params, minFee: 1500n })

            expect(result).toBe(draft)
            expect(mocks.payment).toHaveBeenCalledTimes(1)
            expect(mocks.payment.mock.calls[0][0]).toMatchObject({
                sender: 'SRC',
                receiver: 'SRC',
                rekeyTo: 'TGT',
            })
            expect(mocks.payment.mock.calls[0][0]).not.toHaveProperty(
                'staticFee',
            )
        })

        it('rebuilds with the minimum fee when the auto-sized fee falls short', async () => {
            const rebuilt = { id: 'rebuilt' }
            mocks.payment
                .mockResolvedValueOnce({ id: 'draft', fee: 1000n })
                .mockResolvedValueOnce(rebuilt)

            const result = await buildRekeyTx({ ...params, minFee: 3000n })

            expect(result).toBe(rebuilt)
            expect(mocks.payment).toHaveBeenCalledTimes(2)
            expect(micro(mocks.payment.mock.calls[1][0].staticFee)).toBe(3000n)
        })
    })

    describe('buildKeyRegistrationTx', () => {
        const note = new Uint8Array([1])

        it('builds an offline registration with the fee and note', async () => {
            const tx = { id: 'offline' }
            mocks.offlineKeyRegistration.mockResolvedValueOnce(tx)

            const result = await buildKeyRegistrationTx({
                kind: 'offline',
                scope,
                sender: 'S',
                note,
                fee: 2000n,
            })

            expect(result).toBe(tx)
            const arg = mocks.offlineKeyRegistration.mock.calls[0][0]
            expect(arg).toMatchObject({ sender: 'S', note })
            expect(micro(arg.staticFee)).toBe(2000n)
        })

        it('forwards every participation field of an online registration', async () => {
            const keys = {
                voteKey: new Uint8Array([1]),
                selectionKey: new Uint8Array([2]),
                stateProofKey: new Uint8Array([3]),
            }
            mocks.onlineKeyRegistration.mockResolvedValueOnce({ id: 'online' })

            await buildKeyRegistrationTx({
                kind: 'online',
                scope,
                sender: 'S',
                ...keys,
                voteFirst: 10n,
                voteLast: 20n,
                voteKeyDilution: 5n,
            })

            const arg = mocks.onlineKeyRegistration.mock.calls[0][0]
            expect(arg).toMatchObject({
                sender: 'S',
                ...keys,
                voteFirst: 10n,
                voteLast: 20n,
                voteKeyDilution: 5n,
                staticFee: undefined,
            })
        })
    })
})
