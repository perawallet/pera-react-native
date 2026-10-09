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

// @vitest-environment node
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
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { computeGroupID, generateAccount, Transaction } from 'algosdk'
import '../../__tests__/registerAlgorandAccounts'
import {
    useAccountChainStateStore,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    scopeForLegacyNetwork,
    type AssetRef,
    type ChainId,
    type PeraTransaction,
    type TransferIntent,
} from '@perawallet/wallet-core-chain-contract'
import { InvalidSendParamsError } from '@perawallet/wallet-core-transactions'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import { groupTransactions } from '../../blockchain'
import { mockAlgodTransactionParams } from '../../test-handlers'
import { makeTestAssetTransferTx } from '../../signing/__tests__/transactions'

const mocks = vi.hoisted(() => ({ buildOptInTxs: vi.fn() }))

vi.mock('../builders', async importOriginal => {
    const actual = await importOriginal<typeof import('../builders')>()
    mocks.buildOptInTxs.mockImplementation(actual.buildOptInTxs)
    return { ...actual, buildOptInTxs: mocks.buildOptInTxs }
})

vi.mock('../../blockchain/fees/getMinimumFeeConfig', () => ({
    getMinimumFeeConfig: () => ({
        minTxnFee: 1000n,
        pqMultiplier: 3n,
        assetMbr: 100_000n,
        baseAccountMbr: 100_000n,
    }),
}))

import { buildAlgorandTransfer } from '../transfer-builder'

const SENDER = generateAccount().addr
const RECEIVER = generateAccount().addr.toString()
const QUANTUM = generateAccount().addr

const quantum = {
    id: 'q1',
    address: QUANTUM.toString(),
    custody: { kind: 'local', seed: 'quantum' },
    keyPairId: 'kp-quantum',
} as WalletAccount

const context = { scope: scopeForLegacyNetwork('testnet') }
const ALGO: AssetRef = { chainId: 'algorand' as ChainId, assetId: '0' }
const USDC: AssetRef = { chainId: 'algorand' as ChainId, assetId: '31566704' }

const send = (overrides: Partial<TransferIntent> = {}): TransferIntent => ({
    kind: 'transfer',
    from: SENDER.toString(),
    to: RECEIVER,
    assetRef: ALGO,
    amount: new Decimal(5),
    ...overrides,
})

const payloadOf = (built: { payload: unknown }) =>
    built.payload as PeraTransaction

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('buildAlgorandTransfer', () => {
    beforeEach(() => {
        useAccountChainStateStore.getState().resetState()
        useAccountsStore.setState({ accounts: [quantum] })
        server.use(mockAlgodTransactionParams())
    })

    it('builds an ALGO payment summarised as an outgoing transfer', async () => {
        const [built] = await buildAlgorandTransfer(
            send({ note: 'hi' }),
            context,
        )

        expect(built.scope).toEqual(context.scope)
        expect(built.summary).toEqual({
            kind: 'transfer',
            title: { key: 'transactions.list_item.send' },
            direction: 'out',
            icon: 'send',
            counterparty: RECEIVER,
            amount: { assetRef: ALGO, value: new Decimal(5) },
        })
        expect(built.chainData).toEqual({
            family: 'algorand',
            groupId: undefined,
        })
        const payment = payloadOf(built)
        expect(payment.type).toBe('pay')
        expect(payment.payment?.amount).toBe(5n)
        expect(new TextDecoder().decode(payment.note)).toBe('hi')
    })

    it('builds an asset transfer summarised as a token transfer', async () => {
        const [built] = await buildAlgorandTransfer(
            send({ assetRef: USDC }),
            context,
        )

        expect(built.summary).toMatchObject({
            kind: 'token-transfer',
            amount: { assetRef: USDC },
        })
        expect(payloadOf(built).assetTransfer?.assetIndex).toBe(31566704n)
    })

    it('summarises a send to oneself as a self transfer', async () => {
        const [built] = await buildAlgorandTransfer(
            send({ to: SENDER.toString() }),
            context,
        )

        expect(built.summary).toMatchObject({
            direction: 'self',
            icon: 'self',
        })
    })

    it('builds an asset opt-in that moves nothing', async () => {
        const [built] = await buildAlgorandTransfer(
            {
                kind: 'asset-opt-in',
                account: SENDER.toString(),
                assetRef: USDC,
            },
            context,
        )

        expect(built.summary).toEqual({
            kind: 'chain-specific',
            title: { key: 'transactions.list_item.opt_in' },
            direction: 'none',
            icon: 'opt-in',
        })
        const optIn = payloadOf(built)
        expect(optIn.assetTransfer?.assetIndex).toBe(31566704n)
        expect(optIn.assetTransfer?.receiver.toString()).toBe(SENDER.toString())
    })

    it('refuses a scope that is not Algorand', async () => {
        await expect(
            buildAlgorandTransfer(send(), {
                scope: { chainId: 'ethereum', networkId: 'mainnet' },
            }),
        ).rejects.toThrow('Not an Algorand scope')
    })

    it.each([
        [
            'an asset from another chain',
            send({ assetRef: { ...USDC, chainId: 'ethereum' } }),
        ],
        [
            'a fractional amount of base units',
            send({ amount: new Decimal('0.5') }),
        ],
        ['a negative amount', send({ amount: new Decimal(-1) })],
    ])('refuses %s', async (_, intent) => {
        await expect(buildAlgorandTransfer(intent, context)).rejects.toThrow(
            InvalidSendParamsError,
        )
    })

    it('refuses an opt-in to ALGO itself', async () => {
        await expect(
            buildAlgorandTransfer(
                {
                    kind: 'asset-opt-in',
                    account: SENDER.toString(),
                    assetRef: ALGO,
                },
                context,
            ),
        ).rejects.toThrow(InvalidSendParamsError)
    })

    it('fails a transfer when the node cannot be asked for its minimum fee', async () => {
        server.use(
            http.get('*/v2/transactions/params', () => HttpResponse.error()),
        )

        await expect(buildAlgorandTransfer(send(), context)).rejects.toThrow()
    })

    it('regroups after raising fees, so every member carries the group of its final bytes', async () => {
        const draft = groupTransactions([
            makeTestAssetTransferTx(QUANTUM, {
                assetIndex: 1n,
                receiver: QUANTUM,
            }),
            makeTestAssetTransferTx(QUANTUM, {
                assetIndex: 2n,
                receiver: QUANTUM,
            }),
        ])
        const draftGroup = draft[0].group as Uint8Array
        mocks.buildOptInTxs.mockResolvedValueOnce(draft)

        const built = await buildAlgorandTransfer(
            {
                kind: 'asset-opt-in',
                account: QUANTUM.toString(),
                assetRef: USDC,
            },
            context,
        )

        const payloads = built.map(payloadOf)
        const ungrouped = payloads.map(tx => {
            const clone = Transaction.fromEncodingData(tx.toEncodingData())
            clone.group = undefined
            return clone
        })
        const finalGroup = computeGroupID(ungrouped)
        expect(encodeToBase64(finalGroup)).not.toBe(encodeToBase64(draftGroup))
        for (const [index, transaction] of built.entries()) {
            expect(payloads[index].fee).toBeGreaterThan(draft[index].fee)
            expect(encodeToBase64(payloads[index].group as Uint8Array)).toBe(
                encodeToBase64(finalGroup),
            )
            expect(transaction.chainData).toEqual({
                family: 'algorand',
                groupId: encodeToBase64(finalGroup),
            })
        }
    })

    it('still builds an opt-in when the node cannot be asked for its minimum fee', async () => {
        server.use(
            http.get('*/v2/transactions/params', () => HttpResponse.error()),
        )
        const draft = [
            makeTestAssetTransferTx(QUANTUM, {
                assetIndex: 1n,
                receiver: QUANTUM,
            }),
        ]
        mocks.buildOptInTxs.mockResolvedValueOnce(draft)

        const [built] = await buildAlgorandTransfer(
            {
                kind: 'asset-opt-in',
                account: QUANTUM.toString(),
                assetRef: USDC,
            },
            context,
        )

        // The base fee falls back to the configured 1000 µAlgo, so the
        // surcharge is two more of it.
        expect(payloadOf(built).fee).toBe(draft[0].fee + 2000n)
    })
})
