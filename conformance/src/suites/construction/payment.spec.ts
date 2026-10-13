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

import { beforeAll, describe, expect, it } from 'vitest'

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { buildTransferTxs } from '@perawallet/wallet-core-chain-algorand/transactions/builders'
import { algorandDescriptor } from '@perawallet/wallet-core-chain-algorand/descriptor'

import {
    createAlgo25Account,
    fundAccount,
    type ConformanceAccount,
} from '../../harness/accounts'
import type { TxnIntent } from '../../harness/assert/intent'
import { expectConformant } from '../../harness/assert/roundTrip'
import {
    onlyTxn,
    signWithKeystore,
    submitAndConfirm,
} from '../../harness/build'
import { balanceOf } from '../../harness/client'
import {
    createConformanceKeyStore,
    type ConformanceKeyStore,
} from '../../harness/keystore'
import { localNetScope } from '../../harness/scope'

// Built by the app's send-flow builder, the one `useTransactionSendFlow`
// reaches through the chain adapter, so a regression there fails here.
describe('payment construction conformance', () => {
    let scope: ChainScope
    let keyStore: ConformanceKeyStore
    let sender: ConformanceAccount
    let receiver: ConformanceAccount

    beforeAll(async () => {
        scope = await localNetScope()
        keyStore = await createConformanceKeyStore()
        sender = await createAlgo25Account(keyStore)
        receiver = await createAlgo25Account(keyStore)
        await fundAccount(sender.address, 10_000_000n)
    })

    it('submits a simple payment', async () => {
        const senderBalanceBefore = await balanceOf(sender.address)
        const amount = 250_000n

        const txn = onlyTxn(
            await buildTransferTxs({
                scope,
                sender: sender.address,
                receiver: receiver.address,
                assetId: algorandDescriptor.nativeAsset.ref.assetId,
                amount,
            }),
        )
        const signedBytes = await signWithKeystore(keyStore, sender, txn)
        const { txId } = await submitAndConfirm(signedBytes)

        const intent: TxnIntent = {
            type: 'pay',
            sender: sender.address,
            receiver: receiver.address,
            amount,
            fee: txn.fee,
        }

        await expectConformant({
            intent,
            signedBytes,
            txId,
            senderBalanceBefore,
        })
    })

    it('sends MAX as a close-out, not a fee-math trick', async () => {
        const closer = await createAlgo25Account(keyStore)
        const target = await createAlgo25Account(keyStore)
        await fundAccount(closer.address, 5_000_000n)
        const closerBalanceBefore = await balanceOf(closer.address)

        // The amount is ignored on a close-out: the builder must send 0 and
        // let closeRemainderTo carry the balance.
        const txn = onlyTxn(
            await buildTransferTxs({
                scope,
                sender: closer.address,
                receiver: target.address,
                assetId: algorandDescriptor.nativeAsset.ref.assetId,
                amount: 1234n,
                isCloseAccount: true,
            }),
        )
        const signedBytes = await signWithKeystore(keyStore, closer, txn)
        const { txId } = await submitAndConfirm(signedBytes)

        const intent: TxnIntent = {
            type: 'pay',
            sender: closer.address,
            receiver: target.address,
            amount: 0n,
            closeRemainderTo: target.address,
            fee: txn.fee,
        }

        await expectConformant({
            intent,
            signedBytes,
            txId,
            senderBalanceBefore: closerBalanceBefore,
        })

        // expectConformant only verifies the sender's side of the sweep;
        // the close destination is this test's own assertion.
        expect(await balanceOf(closer.address)).toBe(0n)
        expect(await balanceOf(target.address)).toBe(
            closerBalanceBefore - txn.fee,
        )
    })

    it('carries a note that survives byte-identically to the confirmed transaction', async () => {
        const senderBalanceBefore = await balanceOf(sender.address)
        const amount = 10_000n
        const noteText = 'conformance payment note'
        const note = new TextEncoder().encode(noteText)

        const txn = onlyTxn(
            await buildTransferTxs({
                scope,
                sender: sender.address,
                receiver: receiver.address,
                assetId: algorandDescriptor.nativeAsset.ref.assetId,
                amount,
                note: noteText,
            }),
        )
        const signedBytes = await signWithKeystore(keyStore, sender, txn)
        const { txId } = await submitAndConfirm(signedBytes)

        const intent: TxnIntent = {
            type: 'pay',
            sender: sender.address,
            receiver: receiver.address,
            amount,
            note,
            fee: txn.fee,
        }

        await expectConformant({
            intent,
            signedBytes,
            txId,
            senderBalanceBefore,
        })
    })
})
