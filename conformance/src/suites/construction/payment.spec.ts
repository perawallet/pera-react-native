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
    createAlgo25Account,
    fundAccount,
    type ConformanceAccount,
} from '../../harness/accounts'
import type { TxnIntent } from '../../harness/assert/intent'
import { expectConformant } from '../../harness/assert/roundTrip'
import {
    buildTxn,
    signWithKeystore,
    submitAndConfirm,
} from '../../harness/build'
import { balanceOf } from '../../harness/client'
import {
    createConformanceKeyStore,
    type ConformanceKeyStore,
} from '../../harness/keystore'

describe('payment construction conformance', () => {
    let keyStore: ConformanceKeyStore
    let sender: ConformanceAccount
    let receiver: ConformanceAccount

    beforeAll(async () => {
        keyStore = await createConformanceKeyStore()
        sender = await createAlgo25Account(keyStore)
        receiver = await createAlgo25Account(keyStore)
        await fundAccount(sender.address, 10_000_000n)
    })

    it('submits a simple payment', async () => {
        const senderBalanceBefore = await balanceOf(sender.address)
        const amount = 250_000n

        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(amount),
            })
        })
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

        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: closer.address,
                receiver: target.address,
                amount: microAlgo(0n),
                closeRemainderTo: target.address,
            })
        })
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
        const note = new TextEncoder().encode('conformance payment note')

        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(amount),
                note,
            })
        })
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
