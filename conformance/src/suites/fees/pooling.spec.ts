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
import { expectConformant } from '../../harness/assert/roundTrip'
import {
    buildGroup,
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
            senderBalanceBefore,
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
            senderBalanceBefore,
        })

        // Load-bearing: the total charged across the group, read off the
        // CONFIRMED transactions (not restated from the intents above), equals
        // the group's independently-computed fee floor — proving pooling, not
        // just that each leg individually matched a number this test picked.
        const totalCharged = confirmedA.txn.txn.fee + confirmedB.txn.txn.fee
        expect(totalCharged).toBe(groupMinFee)

        const senderBalanceAfter = await balanceOf(sender.address)
        const expectedTotalDelta = -(totalCharged + amountA + amountB)
        expect(senderBalanceAfter - senderBalanceBefore).toBe(
            expectedTotalDelta,
        )
    })
})
