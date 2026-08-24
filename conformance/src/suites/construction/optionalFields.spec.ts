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
import { balanceOf, getConformanceClient } from '../../harness/client'
import {
    createConformanceKeyStore,
    type ConformanceKeyStore,
} from '../../harness/keystore'

/**
 * One case per optional payment field. `note`, `rekeyTo`, and the MAX-send
 * shape of `closeRemainderTo` (in payment.spec.ts) each mirror a concrete app
 * builder call site; `lease` does not — see the comment on that case. Each
 * field is exercised on a dedicated, single-use account: `rekeyTo` and
 * `closeRemainderTo` permanently change or empty the account they act on, so
 * reusing an account across cases here would make a later case's outcome
 * depend on an earlier one's mutation instead of on the field under test.
 */
describe('optional-field construction conformance', () => {
    let keyStore: ConformanceKeyStore
    let receiver: ConformanceAccount

    beforeAll(async () => {
        keyStore = await createConformanceKeyStore()
        receiver = await createAlgo25Account(keyStore)
        // Below the 100_000 microAlgo minimum balance, a brand-new account
        // cannot hold the small payment amounts these cases send it.
        await fundAccount(receiver.address, 500_000n)
    })

    it('note: survives to the confirmed transaction', async () => {
        const sender = await createAlgo25Account(keyStore)
        await fundAccount(sender.address, 5_000_000n)
        const senderBalanceBefore = await balanceOf(sender.address)
        const note = new TextEncoder().encode('optional-field note conformance')

        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(1000n),
                note,
            })
        })
        const signedBytes = await signWithKeystore(keyStore, sender, txn)
        const { txId } = await submitAndConfirm(signedBytes)

        const intent: TxnIntent = {
            type: 'pay',
            sender: sender.address,
            receiver: receiver.address,
            amount: 1000n,
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

    // No app builder sets `lease` today — the only hit for the field
    // (packages/blockchain/src/utils/transactions.ts:54) only reads it for
    // display. This case pins the harness's round-trip handling of the field
    // for the day a builder starts setting one, not an existing app path.
    it('lease: survives to the confirmed transaction', async () => {
        const sender = await createAlgo25Account(keyStore)
        await fundAccount(sender.address, 5_000_000n)
        const senderBalanceBefore = await balanceOf(sender.address)
        const lease = crypto.getRandomValues(new Uint8Array(32))

        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(1000n),
                lease,
            })
        })
        const signedBytes = await signWithKeystore(keyStore, sender, txn)
        const { txId } = await submitAndConfirm(signedBytes)

        const intent: TxnIntent = {
            type: 'pay',
            sender: sender.address,
            receiver: receiver.address,
            amount: 1000n,
            lease,
            fee: txn.fee,
        }

        await expectConformant({
            intent,
            signedBytes,
            txId,
            senderBalanceBefore,
        })
    })

    it('rekeyTo: survives to the confirmed transaction, mirroring the app rekey shape (0-amount self-payment)', async () => {
        const source = await createAlgo25Account(keyStore)
        const newAuth = await createAlgo25Account(keyStore)
        await fundAccount(source.address, 5_000_000n)
        const senderBalanceBefore = await balanceOf(source.address)

        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: source.address,
                receiver: source.address,
                amount: microAlgo(0n),
                rekeyTo: newAuth.address,
            })
        })
        const signedBytes = await signWithKeystore(keyStore, source, txn)
        const { txId } = await submitAndConfirm(signedBytes)

        const intent: TxnIntent = {
            type: 'pay',
            sender: source.address,
            receiver: source.address,
            amount: 0n,
            rekeyTo: newAuth.address,
            fee: txn.fee,
        }

        await expectConformant({
            intent,
            signedBytes,
            txId,
            senderBalanceBefore,
        })

        const info = await getConformanceClient()
            .client.algod.accountInformation(source.address)
            .do()
        expect(info.authAddr?.toString()).toBe(newAuth.address)
    })

    // The app's only closeRemainderTo call site (useTransactionSendFlow.ts:249,
    // MAX send) always sets closeRemainderTo === receiver — that shape is covered
    // by payment.spec.ts's MAX-send case. This distinct-target case exercises the
    // harness's general handling of the field, not an additional app path.
    it('closeRemainderTo: sweeps the remainder to a third account distinct from the payment receiver', async () => {
        const closer = await createAlgo25Account(keyStore)
        const remainderTarget = await createAlgo25Account(keyStore)
        await fundAccount(closer.address, 5_000_000n)
        const closerBalanceBefore = await balanceOf(closer.address)
        const amount = 1_000_000n

        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: closer.address,
                receiver: receiver.address,
                amount: microAlgo(amount),
                closeRemainderTo: remainderTarget.address,
            })
        })
        const signedBytes = await signWithKeystore(keyStore, closer, txn)
        const { txId } = await submitAndConfirm(signedBytes)

        const intent: TxnIntent = {
            type: 'pay',
            sender: closer.address,
            receiver: receiver.address,
            amount,
            closeRemainderTo: remainderTarget.address,
            fee: txn.fee,
        }

        await expectConformant({
            intent,
            signedBytes,
            txId,
            senderBalanceBefore: closerBalanceBefore,
        })

        expect(await balanceOf(closer.address)).toBe(0n)
        expect(await balanceOf(remainderTarget.address)).toBe(
            closerBalanceBefore - txn.fee - amount,
        )
    })
})
