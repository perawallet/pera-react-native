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

import { microAlgo } from '@algorandfoundation/algokit-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import {
    computeBalanceImpacts,
    type IndexerTransactionLike,
} from '@perawallet/wallet-core-transactions/api/history/indexer/balance-impacts'
import {
    collectAssetIds,
    transformIndexerTransactions,
    type AssetLookup,
} from '@perawallet/wallet-core-transactions/api/history/indexer/transformers'

import {
    createAlgo25Account,
    fundAccount,
    type ConformanceAccount,
} from '../../harness/accounts'
import {
    buildTxn,
    createTestAsset,
    signWithKeystore,
    submitAndConfirm,
} from '../../harness/build'
import { balanceOf, fetchIndexerTransactionsFor } from '../../harness/client'
import {
    createConformanceKeyStore,
    type ConformanceKeyStore,
} from '../../harness/keystore'
import { assertIndexerCaughtUp } from '../../harness/localnet'

/**
 * The app reads transaction history off the chain's own indexer on every
 * network whose Pera services are borrowed, and every row goes through
 * `transformIndexerTransactions` (strict zod on the envelope, per-row
 * `safeParse`) and `computeBalanceImpacts`. Both are pure app code whose only
 * existing tests feed them hand-written fixtures — fixtures written from the
 * same reading of the indexer's schema that the code encodes, so the two
 * agree by construction and a real field-shape change is invisible to them.
 *
 * These tests feed them the real indexer's real output for transactions this
 * suite just submitted, with the expected values taken from the declared
 * intent rather than from the response being parsed.
 */
describe('indexer history transformer conformance', () => {
    let keyStore: ConformanceKeyStore
    let sender: ConformanceAccount
    let receiver: ConformanceAccount

    beforeAll(async () => {
        keyStore = await createConformanceKeyStore()
        sender = await createAlgo25Account(keyStore)
        receiver = await createAlgo25Account(keyStore)
        await fundAccount(sender.address, 10_000_000n)
        await fundAccount(receiver.address, 1_000_000n)
        // Funding advanced the chain, so the indexer now has something to be
        // behind on — fail here, once and diagnosably, rather than three times
        // as a per-transaction timeout.
        await assertIndexerCaughtUp()
    })

    const rowFor = (
        page: { transactions: unknown[] },
        txId: string,
    ): IndexerTransactionLike =>
        page.transactions.find(
            txn => (txn as { id?: string }).id === txId,
        ) as IndexerTransactionLike

    it("maps a payment the node just confirmed onto the app's history model", async () => {
        const amount = 234_000n
        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(amount),
            })
        })
        const { txId } = await submitAndConfirm(
            await signWithKeystore(keyStore, sender, txn),
        )

        const page = await fetchIndexerTransactionsFor(sender.address, txId)

        // No asset facts needed for a payment; an empty lookup is what the
        // app itself passes when a page references no assets.
        const history = transformIndexerTransactions(
            page,
            sender.address,
            new Map() as AssetLookup,
        )

        const row = history.results.find(result => result.id === txId)
        expect(row).toBeDefined()
        expect(row?.tx_type).toBe('pay')
        expect(row?.sender).toBe(sender.address)
        expect(row?.receiver).toBe(receiver.address)
        expect(row?.amount).toBe(amount.toString())
        expect(row?.fee).toBe(txn.fee.toString())
        expect(row?.confirmed_round).toBeGreaterThan(0)
        // A close-out was never declared, so the chain must not report one.
        expect(row?.close_to).toBeNull()
        expect(row?.asset).toBeNull()
    })

    it("computes a payment's ALGO impact to the exact microAlgo the chain moved", async () => {
        const amount = 111_000n
        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(amount),
            })
        })

        const senderBefore = await balanceOf(sender.address)
        const receiverBefore = await balanceOf(receiver.address)
        const { txId } = await submitAndConfirm(
            await signWithKeystore(keyStore, sender, txn),
        )
        const senderDelta = (await balanceOf(sender.address)) - senderBefore
        const receiverDelta =
            (await balanceOf(receiver.address)) - receiverBefore

        const senderRow = rowFor(
            await fetchIndexerTransactionsFor(sender.address, txId),
            txId,
        )
        const receiverRow = rowFor(
            await fetchIndexerTransactionsFor(receiver.address, txId),
            txId,
        )

        // The measured deltas are the ground truth the arithmetic has to
        // reproduce — including the fee on the sender's side, which is the
        // half a fixture-based test is most likely to get wrong.
        expect(computeBalanceImpacts(senderRow, sender.address)).toEqual([
            { assetId: '0', amount: senderDelta },
        ])
        expect(computeBalanceImpacts(receiverRow, receiver.address)).toEqual([
            { assetId: '0', amount: receiverDelta },
        ])
        expect(senderDelta).toBe(-(amount + txn.fee))
        expect(receiverDelta).toBe(amount)
    })

    it('maps an asset transfer and reports both the ALGO fee and the asset movement', async () => {
        const assetId = await createTestAsset(keyStore, sender, {
            total: 1_000_000n,
            decimals: 2,
            assetName: 'Conformance',
            unitName: 'CONF',
        })

        const optIn = await buildTxn(composer => {
            composer.addAssetOptIn({ sender: receiver.address, assetId })
        })
        await submitAndConfirm(
            await signWithKeystore(keyStore, receiver, optIn),
        )

        const amount = 4200n
        const transfer = await buildTxn(composer => {
            composer.addAssetTransfer({
                sender: sender.address,
                receiver: receiver.address,
                assetId,
                amount,
            })
        })

        const senderBefore = await balanceOf(sender.address)
        const { txId } = await submitAndConfirm(
            await signWithKeystore(keyStore, sender, transfer),
        )
        const senderAlgoDelta = (await balanceOf(sender.address)) - senderBefore

        const page = await fetchIndexerTransactionsFor(sender.address, txId)

        expect(collectAssetIds(page)).toContain(assetId.toString())

        const assets: AssetLookup = new Map([
            [
                assetId.toString(),
                { name: 'Conformance', unitName: 'CONF', decimals: 2 },
            ],
        ])
        const history = transformIndexerTransactions(
            page,
            sender.address,
            assets,
        )
        const row = history.results.find(result => result.id === txId)

        expect(row?.tx_type).toBe('axfer')
        expect(row?.amount).toBe(amount.toString())
        expect(row?.asset?.asset_id).toBe(assetId.toString())
        // The decimals the app renders with come from the lookup, not from the
        // indexer row — a wrong wiring here misprices every amount on screen.
        expect(row?.asset?.decimals).toBe(2)
        expect(row?.asset?.unit_name).toBe('CONF')
        // The per-row impact list the UI renders is built by the same
        // arithmetic, and carries ALGO's own unit facts without a lookup.
        expect(row?.balance_impacts).toEqual([
            {
                asset_id: '0',
                unit_name: 'ALGO',
                fraction_decimals: 6,
                amount: senderAlgoDelta.toString(),
            },
            {
                asset_id: assetId.toString(),
                unit_name: 'CONF',
                fraction_decimals: 2,
                amount: (-amount).toString(),
            },
        ])

        // Two impacts, and only the ALGO one is the fee: an asset transfer
        // moves no ALGO beyond what it costs to send.
        expect(
            computeBalanceImpacts(rowFor(page, txId), sender.address),
        ).toEqual([
            { assetId: '0', amount: senderAlgoDelta },
            { assetId: assetId.toString(), amount: -amount },
        ])
        expect(senderAlgoDelta).toBe(-transfer.fee)
    })
})
