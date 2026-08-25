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
    FALLBACK_MIN_TXN_FEE,
    FALLBACK_PQ_MULTIPLIER,
} from '@perawallet/wallet-core-blockchain/constants'
import {
    AlgodErrorCode,
    toAlgodError,
} from '@perawallet/wallet-core-blockchain/errors'
import { calculateMinTxnFee } from '@perawallet/wallet-core-blockchain/fees/feeCalculator'
import {
    assignMinimumFeesToGroup,
    groupHasQuantumSigner,
} from '@perawallet/wallet-core-signing/pipeline/sources/assignMinimumFeesToGroup'

import {
    createAlgo25Account,
    createQuantumAccount,
    fundAccount,
    type ConformanceAccount,
} from '../../harness/accounts'
import { expectConformant } from '../../harness/assert/roundTrip'
import {
    buildGroup,
    signWithKeystore,
    submitAndConfirm,
} from '../../harness/build'
import { balanceOf, getConformanceClient } from '../../harness/client'
import {
    createConformanceKeyStore,
    type ConformanceKeyStore,
} from '../../harness/keystore'

describe('fee pooling conformance', () => {
    let keyStore: ConformanceKeyStore
    let sender: ConformanceAccount
    let receiverA: ConformanceAccount
    let receiverB: ConformanceAccount

    beforeAll(async () => {
        keyStore = await createConformanceKeyStore()
        sender = await createAlgo25Account(keyStore)
        receiverA = await createAlgo25Account(keyStore)
        receiverB = await createAlgo25Account(keyStore)
        await fundAccount(sender.address, 10_000_000n)
    })

    it('accepts a group where one leg pays zero fee and a sibling covers it, and charges the pooled total', async () => {
        const senderBalanceBefore = await balanceOf(sender.address)
        const amountA = 111_000n
        const amountB = 222_000n

        const { minFee } = await getConformanceClient()
            .client.algod.getTransactionParams()
            .do()
        const baseMinFee = BigInt(minFee)
        // The group's fee floor is the sum of what each of its two legs would
        // owe alone — derived from algod's own minimum, never from either
        // built transaction. Leg B alone is made to cover the whole floor.
        const groupMinFee = baseMinFee * 2n
        const zeroFee = 0n
        const overpayFee = groupMinFee

        const [legA, legB] = await buildGroup(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiverA.address,
                amount: microAlgo(amountA),
                staticFee: microAlgo(zeroFee),
            })
            composer.addPayment({
                sender: sender.address,
                receiver: receiverB.address,
                amount: microAlgo(amountB),
                staticFee: microAlgo(overpayFee),
            })
        })

        const signed = [
            await signWithKeystore(keyStore, sender, legA),
            await signWithKeystore(keyStore, sender, legB),
        ]
        const { txIds } = await submitAndConfirm(signed)

        const baseIntent = {
            type: 'pay' as const,
            sender: sender.address,
            groupSize: 2,
        }

        const confirmedA = await expectConformant({
            intent: {
                ...baseIntent,
                receiver: receiverA.address,
                amount: amountA,
                fee: zeroFee,
            },
            signedBytes: signed[0],
            txId: txIds[0],
        })
        const confirmedB = await expectConformant({
            intent: {
                ...baseIntent,
                receiver: receiverB.address,
                amount: amountB,
                fee: overpayFee,
            },
            signedBytes: signed[1],
            txId: txIds[1],
        })

        // `totalCharged` is provably `0n + groupMinFee` from the two
        // `staticFee` values above, without querying the chain — this
        // equality is arithmetic, not evidence. The actual proof that pooling
        // works as the app assumes already happened: leg A alone underpays
        // its own per-transaction minimum, so if pooling did NOT work,
        // `submitAndConfirm` above would have thrown (or `expectConformant`
        // would have failed matching leg A's confirmed fee to 0) instead of
        // this line ever being reached. What the two checks below add is that
        // the group's ALGO cost lands exactly where the group's own
        // (independently-computed) fee floor says it should, cross-checked
        // against the sender's real balance movement.
        const totalCharged = confirmedA.txn.txn.fee + confirmedB.txn.txn.fee
        expect(totalCharged).toBe(groupMinFee)

        const senderBalanceAfter = await balanceOf(sender.address)
        const expectedTotalDelta = -(totalCharged + amountA + amountB)
        expect(senderBalanceAfter - senderBalanceBefore).toBe(
            expectedTotalDelta,
        )
    })
})

/**
 * The app does not take a dApp's group fees as given: `assignMinimumFeesToGroup`
 * raises the fee on every slot a quantum key will sign, then re-groups the
 * affected partitions so the new `grp` is what algod verifies. Its own unit
 * tests assert the arithmetic against the same constants the code uses — they
 * cannot say whether the resulting group is one a node accepts.
 *
 * These tests let the node adjudicate: the app assigns the fees, and the
 * group is submitted exactly as the app produced it. The one-microAlgo-under
 * case is the falsifier — without it, a function that simply overpaid would
 * pass too.
 */
describe('app fee assignment conformance', () => {
    let keyStore: ConformanceKeyStore
    let quantumSender: ConformanceAccount
    let algo25Sender: ConformanceAccount
    let receiver: ConformanceAccount

    beforeAll(async () => {
        keyStore = await createConformanceKeyStore()
        quantumSender = await createQuantumAccount(keyStore)
        algo25Sender = await createAlgo25Account(keyStore)
        receiver = await createAlgo25Account(keyStore)
        await fundAccount(quantumSender.address, 10_000_000n)
        await fundAccount(algo25Sender.address, 10_000_000n)
        // Above the 100_000 microAlgo minimum balance, or every payment below
        // is rejected for the receiver's MBR rather than for its fee.
        await fundAccount(receiver.address, 1_000_000n)
    })

    const suggestedMinFee = async (): Promise<bigint> => {
        const { minFee } = await getConformanceClient()
            .client.algod.getTransactionParams()
            .do()
        return BigInt(minFee)
    }

    it('raises only the quantum leg of a mixed group, and the node accepts the result', async () => {
        const baseMinFee = await suggestedMinFee()
        const accounts = [
            quantumSender.walletAccount,
            algo25Sender.walletAccount,
        ]

        // Built at the plain floor on both legs, as a dApp would hand them
        // over — the quantum leg is underpriced until the app raises it.
        const transactions = await buildGroup(composer => {
            composer.addPayment({
                sender: quantumSender.address,
                receiver: receiver.address,
                amount: microAlgo(11_000n),
                staticFee: microAlgo(baseMinFee),
            })
            composer.addPayment({
                sender: algo25Sender.address,
                receiver: receiver.address,
                amount: microAlgo(12_000n),
                staticFee: microAlgo(baseMinFee),
            })
        })
        const signableIndices = [0, 1]

        expect(
            groupHasQuantumSigner({ transactions, signableIndices, accounts }),
        ).toBe(true)

        const { transactions: assigned, adjustments } =
            assignMinimumFeesToGroup({
                transactions,
                signableIndices,
                accounts,
                suggestedMinFee: baseMinFee,
                configMinTxnFee: FALLBACK_MIN_TXN_FEE,
                pqMultiplier: FALLBACK_PQ_MULTIPLIER,
            })

        // Only the quantum slot is repriced. The Ed25519 leg is still
        // replaced by a clone — it shares a group partition with the adjusted
        // transaction, and the whole partition is re-grouped so the new `grp`
        // is the one algod verifies — but its fee is untouched.
        expect(adjustments.map(adjustment => adjustment.index)).toEqual([0])
        expect(assigned[1].fee).toBe(baseMinFee)
        expect(assigned[0].fee).toBe(
            calculateMinTxnFee({
                baseMinFee,
                isPQSigner: true,
                pqMultiplier: FALLBACK_PQ_MULTIPLIER,
            }),
        )
        // Re-grouped, not merely re-priced: a group id left over from the
        // pre-adjustment payload would not cover the new fees.
        expect(assigned[0].group).toEqual(assigned[1].group)
        expect(assigned[0].group).not.toEqual(transactions[0].group)

        const signed = [
            await signWithKeystore(keyStore, quantumSender, assigned[0]),
            await signWithKeystore(keyStore, algo25Sender, assigned[1]),
        ]

        // The proof the app's own unit tests cannot give: a real node accepts
        // the re-grouped, re-priced payload.
        const { confirmed } = await submitAndConfirm(signed)
        expect(confirmed.confirmedRound).toBeGreaterThan(0n)
    })

    it('rejects the same group one microAlgo below what the app assigned', async () => {
        const baseMinFee = await suggestedMinFee()
        const accounts = [quantumSender.walletAccount]

        const transactions = await buildGroup(composer => {
            composer.addPayment({
                sender: quantumSender.address,
                receiver: receiver.address,
                // A distinct amount from the test above: two identical
                // payments in the same dev round would collide on txID.
                amount: microAlgo(13_000n),
                staticFee: microAlgo(baseMinFee),
            })
            composer.addPayment({
                sender: quantumSender.address,
                receiver: receiver.address,
                amount: microAlgo(14_000n),
                staticFee: microAlgo(baseMinFee),
            })
        })

        const { transactions: assigned } = assignMinimumFeesToGroup({
            transactions,
            signableIndices: [0, 1],
            accounts,
            suggestedMinFee: baseMinFee,
            configMinTxnFee: FALLBACK_MIN_TXN_FEE,
            pqMultiplier: FALLBACK_PQ_MULTIPLIER,
        })
        const assignedTotal = assigned[0].fee + assigned[1].fee

        // Submit the assigned group first, so this test brackets the floor for
        // one composition rather than only showing that something below it is
        // rejected — an assignment that overpaid would clear this half too, and
        // only the shaved group below can tell the difference.
        await submitAndConfirm([
            await signWithKeystore(keyStore, quantumSender, assigned[0]),
            await signWithKeystore(keyStore, quantumSender, assigned[1]),
        ])

        // Rebuild the same group with one microAlgo shaved off the pooled
        // total. Fees pool, so where the microAlgo is taken from does not
        // matter — only that the group total falls short.
        const underpriced = await buildGroup(composer => {
            composer.addPayment({
                sender: quantumSender.address,
                receiver: receiver.address,
                amount: microAlgo(13_000n),
                staticFee: microAlgo(assigned[0].fee - 1n),
            })
            composer.addPayment({
                sender: quantumSender.address,
                receiver: receiver.address,
                amount: microAlgo(14_000n),
                staticFee: microAlgo(assigned[1].fee),
            })
        })
        expect(underpriced[0].fee + underpriced[1].fee).toBe(assignedTotal - 1n)

        const signed = [
            await signWithKeystore(keyStore, quantumSender, underpriced[0]),
            await signWithKeystore(keyStore, quantumSender, underpriced[1]),
        ]

        // algod's own words, not a paraphrase: the group is rejected for its
        // pooled fee, which is what makes the assigned total a floor rather
        // than an overpayment.
        const rejection = await submitAndConfirm(signed).then(
            () => null,
            (error: unknown) => error,
        )
        expect(rejection).not.toBeNull()
        expect((rejection as Error).message).toMatch(
            /txgroup with .* fees is less than/,
        )

        // And the app classifies it. This is the assertion that would have
        // caught the bug this test found: algod 5.0.0-stable renders the two
        // figures in a scaled unit, which the old `GROUP_FEE_RE` could not
        // match, so a definitive rejection was reaching
        // `classifySubmitFailure` as `unknown_node_error` — one of its
        // `NO_NODE_VERDICT_CODES` — and burning a verification retry cycle
        // before surfacing "outcome unknown".
        expect(toAlgodError(rejection).code).toBe(
            AlgodErrorCode.GROUP_FEE_TOO_SMALL,
        )
    })
})
