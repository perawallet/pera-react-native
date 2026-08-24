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

import { groupTransactions } from '@perawallet/wallet-core-blockchain/utils/transact'

import {
    createAlgo25Account,
    fundAccount,
    type ConformanceAccount,
} from '../../harness/accounts'
import { expectConformant } from '../../harness/assert/roundTrip'
import {
    buildTxn,
    signWithKeystore,
    submitAndConfirm,
} from '../../harness/build'
import {
    createConformanceKeyStore,
    type ConformanceKeyStore,
} from '../../harness/keystore'

describe('atomic group construction conformance', () => {
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

    it('groups two independently-built transactions and confirms both', async () => {
        const amountA = 100_000n
        const amountB = 200_000n

        // Each leg is built as its own single-transaction composer call, then
        // grouped explicitly via `groupTransactions` — the shape the app uses
        // to assemble an ARC-0001 group out of independently-built legs
        // (see wc-sign-quantum-fee.test.tsx's buildGroupEntries), distinct from
        // a single `newGroup().addX().addY()` composer chain.
        const legA = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiverA.address,
                amount: microAlgo(amountA),
            })
        })
        const legB = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiverB.address,
                amount: microAlgo(amountB),
            })
        })

        const [g0, g1] = groupTransactions([legA, legB])

        expect(g0.group).toBeDefined()
        expect(g1.group).toEqual(g0.group)

        const signed = [
            await signWithKeystore(keyStore, sender, g0),
            await signWithKeystore(keyStore, sender, g1),
        ]
        const { txIds } = await submitAndConfirm(signed)

        const baseIntent = {
            type: 'pay' as const,
            sender: sender.address,
            groupSize: 2,
        }

        await expectConformant({
            intent: {
                ...baseIntent,
                receiver: receiverA.address,
                amount: amountA,
                fee: g0.fee,
            },
            signedBytes: signed[0],
            txId: txIds[0],
        })
        await expectConformant({
            intent: {
                ...baseIntent,
                receiver: receiverB.address,
                amount: amountB,
                fee: g1.fee,
            },
            signedBytes: signed[1],
            txId: txIds[1],
        })
    })

    it('rejects a group whose members disagree on the group id', async () => {
        const legA = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiverA.address,
                amount: microAlgo(50_000n),
            })
        })
        const legB = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiverB.address,
                amount: microAlgo(60_000n),
            })
        })

        const [g0, g1] = groupTransactions([legA, legB])
        // Corrupt AFTER grouping, before signing, so each leg's own signature
        // is still valid over the bytes it signs — a rejection here can only
        // be algod's group-hash check catching the mismatch, not a bad
        // signature on an individual transaction.
        g1.group = crypto.getRandomValues(new Uint8Array(32))

        const signed = [
            await signWithKeystore(keyStore, sender, g0),
            await signWithKeystore(keyStore, sender, g1),
        ]

        await expect(submitAndConfirm(signed)).rejects.toThrow(
            /inconsistent group values/,
        )
    })
})
