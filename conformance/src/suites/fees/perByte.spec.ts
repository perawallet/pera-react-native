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
import { getConformanceClient } from '../../harness/client'
import {
    createConformanceKeyStore,
    type ConformanceKeyStore,
} from '../../harness/keystore'

const balanceOf = async (address: string): Promise<bigint> =>
    (await getConformanceClient().account.getInformation(address)).balance
        .microAlgo

// Probed directly against the running LocalNet (algod 5.0.0-stable,
// dockernet-v1) before writing this suite:
//   - `/v2/transactions/params` reports `fee: 0` (algod's suggested per-byte
//     rate) and `min-fee: 1000`.
//   - A 1-byte-note and a 900-byte-note payment submitted at fee 999 both
//     reject with the IDENTICAL pool error: "txgroup with 999uA fees is less
//     than 1mA (usage=1.000000 * base=1mA)" — `usage` does not move with size.
//   - The composer's own (unpinned) computed fee is 1000 for both note sizes.
// LocalNet never leaves the flat-min-fee regime, so real per-byte fee
// *pricing* cannot be exercised here — there is no size-sensitive floor to
// probe, and pinning a synthetic fee via `staticFee` and asserting the node
// charged it back is a tautology (Algorand charges exactly the declared fee
// whenever it clears the floor, so *any* above-floor value would "pass").
// What this suite CAN verify against the live node: the composer's own fee
// computation, left to run rather than pinned, matches an
// independently-predicted value (`max(baseMinFee, feePerByte * size)`, fed
// from algod's own suggested params, never read off either built
// transaction) for both a small and a large note — and that the two sizes
// are charged identically, because `feePerByte` is 0.
describe('per-byte fee conformance', () => {
    let keyStore: ConformanceKeyStore
    let sender: ConformanceAccount
    let receiver: ConformanceAccount

    beforeAll(async () => {
        keyStore = await createConformanceKeyStore()
        sender = await createAlgo25Account(keyStore)
        receiver = await createAlgo25Account(keyStore)
        await fundAccount(sender.address, 10_000_000n)
    })

    it("matches the composer's own unpinned fee for a small and a large note against an independent prediction, and documents that LocalNet charges both identically", async () => {
        const amount = 250_000n
        const smallNote = new TextEncoder().encode('c')
        const largeNote = new TextEncoder().encode('c'.repeat(900))

        const { minFee, fee } = await getConformanceClient()
            .client.algod.getTransactionParams()
            .do()
        const baseMinFee = BigInt(minFee)
        const feePerByte = BigInt(fee)
        // This test's size-independent expectation only holds while LocalNet
        // reports no per-byte suggestion; assert it so a future change to
        // LocalNet's congestion state fails loudly here instead of silently
        // invalidating `expectedFee` below.
        expect(feePerByte).toBe(0n)
        // Independent of either built transaction: algod's real per-byte rate
        // is 0, so `max(baseMinFee, feePerByte * size)` collapses to the flat
        // minimum regardless of note size.
        const expectedFee = feePerByte > baseMinFee ? feePerByte : baseMinFee

        const senderBalanceBeforeSmall = await balanceOf(sender.address)
        const smallTxn = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(amount),
                note: smallNote,
            })
        })
        const smallSignedBytes = await signWithKeystore(
            keyStore,
            sender,
            smallTxn,
        )
        const { txId: smallTxId } = await submitAndConfirm(smallSignedBytes)

        const smallIntent: TxnIntent = {
            type: 'pay',
            sender: sender.address,
            receiver: receiver.address,
            amount,
            note: smallNote,
            fee: expectedFee,
        }
        // Load-bearing: `expectedFee` is predicted from algod's own suggested
        // params before either transaction was built, and compared against
        // what the composer actually produced and what the chain actually
        // charged — never a value pinned via `staticFee` and echoed back.
        await expectConformant({
            intent: smallIntent,
            signedBytes: smallSignedBytes,
            txId: smallTxId,
            senderBalanceBefore: senderBalanceBeforeSmall,
        })

        const senderBalanceBeforeLarge = await balanceOf(sender.address)
        const largeTxn = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(amount),
                note: largeNote,
            })
        })
        const largeSignedBytes = await signWithKeystore(
            keyStore,
            sender,
            largeTxn,
        )
        const { txId: largeTxId } = await submitAndConfirm(largeSignedBytes)

        const largeIntent: TxnIntent = {
            type: 'pay',
            sender: sender.address,
            receiver: receiver.address,
            amount,
            note: largeNote,
            fee: expectedFee,
        }
        await expectConformant({
            intent: largeIntent,
            signedBytes: largeSignedBytes,
            txId: largeTxId,
            senderBalanceBefore: senderBalanceBeforeLarge,
        })

        // Documents the finding rather than claiming to prove scaling: on
        // this network the composer produces the SAME fee for a 1-byte and a
        // 900-byte note, because algod's per-byte suggestion is 0. Real
        // per-byte pricing is not exercisable against LocalNet — see the
        // probe evidence in this file's header comment.
        expect(largeTxn.fee).toBe(smallTxn.fee)
    })
})
