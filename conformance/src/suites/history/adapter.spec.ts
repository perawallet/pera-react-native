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

import { Decimal } from 'decimal.js'
import { beforeAll, describe, expect, it } from 'vitest'

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { algorandNetworkOf } from '@perawallet/wallet-core-chain-algorand/legacy-network'
import { buildTransferTxs } from '@perawallet/wallet-core-chain-algorand/transactions/builders'
import {
    fetchMoreTransactions,
    fetchTransactionHistory,
} from '@perawallet/wallet-core-chain-algorand/transactions/history'
import { fetchIndexerCloseAmount } from '@perawallet/wallet-core-chain-algorand/transactions/history/indexer/endpoints'
import type { Network } from '@perawallet/wallet-core-shared'
import { algorandDescriptor } from '@perawallet/wallet-core-chain-algorand/descriptor'

import {
    createAlgo25Account,
    fundAccount,
    type ConformanceAccount,
} from '../../harness/accounts'
import {
    onlyTxn,
    signWithKeystore,
    submitAndConfirm,
} from '../../harness/build'
import { balanceOf, fetchIndexerTransactionsFor } from '../../harness/client'
import {
    createConformanceKeyStore,
    type ConformanceKeyStore,
} from '../../harness/keystore'
import { assertIndexerCaughtUp } from '../../harness/localnet'
import { localNetScope } from '../../harness/scope'

/**
 * The functions `algorandHistoryAdapter` wires, called with the network it
 * derives from the scope. (The adapter module itself drags the generated
 * ARC-59 client into this package's typecheck.) The `custom` scope has no Pera
 * backend, so history reads the chain's own indexer, the path every
 * indexer-backed network takes. Paging and the close amount are what a fixture
 * cannot pin: the next-token and `close-amount` are the indexer's to produce.
 */
describe('history adapter conformance', () => {
    let scope: ChainScope
    let network: Network
    let keyStore: ConformanceKeyStore
    let sender: ConformanceAccount
    let receiver: ConformanceAccount

    const send = async (
        from: ConformanceAccount,
        to: ConformanceAccount,
        amount: bigint,
        isCloseAccount = false,
    ) => {
        const txn = onlyTxn(
            await buildTransferTxs({
                scope,
                sender: from.address,
                receiver: to.address,
                assetId: algorandDescriptor.nativeAsset.ref.assetId,
                amount,
                isCloseAccount,
            }),
        )
        const { txId } = await submitAndConfirm(
            await signWithKeystore(keyStore, from, txn),
        )
        await fetchIndexerTransactionsFor(from.address, txId)
        return { txId, fee: txn.fee }
    }

    beforeAll(async () => {
        scope = await localNetScope()
        network = algorandNetworkOf(scope)
        keyStore = await createConformanceKeyStore()
        sender = await createAlgo25Account(keyStore)
        receiver = await createAlgo25Account(keyStore)
        await fundAccount(sender.address, 10_000_000n)
        await fundAccount(receiver.address, 1_000_000n)
        await assertIndexerCaughtUp()
    })

    it('pages newest-first and follows the next-token to the older page', async () => {
        const older = await send(sender, receiver, 71_000n)
        const newer = await send(sender, receiver, 72_000n)

        const first = await fetchTransactionHistory({
            network,
            accountAddress: sender.address,
            limit: 1,
        })
        expect(first.transactions.map(txn => txn.id)).toEqual([newer.txId])
        expect(first.transactions[0].amount).toEqual(new Decimal(72_000))
        expect(first.transactions[0].fee).toEqual(new Decimal(newer.fee))
        expect(first.pagination.hasNextPage).toBe(true)
        expect(first.pagination.nextUrl).not.toBeNull()

        const second = await fetchMoreTransactions({
            network,
            url: first.pagination.nextUrl as string,
            accountAddress: sender.address,
        })
        // The next-token carries no limit, so this page is default-sized.
        const secondIds = second.transactions.map(txn => txn.id)
        expect(secondIds[0]).toBe(older.txId)
        expect(secondIds).not.toContain(newer.txId)
        expect(second.transactions[0].amount).toEqual(new Decimal(71_000))
    })

    it('reports the swept balance of a close-out, and zero for a plain payment', async () => {
        const closer = await createAlgo25Account(keyStore)
        await fundAccount(closer.address, 3_000_000n)
        const closerBalanceBefore = await balanceOf(closer.address)

        const plain = await send(closer, receiver, 5000n)
        const close = await send(closer, receiver, 0n, true)
        const swept = closerBalanceBefore - 5000n - plain.fee - close.fee

        await expect(
            fetchIndexerCloseAmount(close.txId, network),
        ).resolves.toBe(swept.toString())
        // The indexer reports close-amount 0, not an absent field, on a payment
        // with no close leg; the backfill only looks up rows with a close-to.
        await expect(
            fetchIndexerCloseAmount(plain.txId, network),
        ).resolves.toBe('0')

        const { transactions } = await fetchTransactionHistory({
            network,
            accountAddress: closer.address,
        })
        const closeRow = transactions.find(txn => txn.id === close.txId)
        expect(closeRow?.closeTo).toBe(receiver.address)
        expect(closeRow?.amount).toEqual(new Decimal(0))
        expect(closeRow?.closeAmount).toEqual(new Decimal(swept.toString()))
    })
})
